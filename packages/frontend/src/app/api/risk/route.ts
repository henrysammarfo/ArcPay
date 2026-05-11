import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

const GOLDRUSH_BASE_URL = "https://api.covalenthq.com/v1";
const SOLANA_MAINNET_CHAIN_NAME = "solana-mainnet";

type GoldRushItemsResponse<T> = {
  data?: { items?: T[] };
  error?: boolean;
  error_message?: string;
};

type GoldRushBalanceItem = {
  contract_ticker_symbol?: string;
  balance?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.GOLDRUSH_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GOLDRUSH_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { wallet?: unknown } | null;
  const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";

  if (!wallet) {
    return NextResponse.json({ error: "Wallet address is required." }, { status: 400 });
  }

  try {
    new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "Invalid Solana wallet address." }, { status: 400 });
  }

  try {
    const [transactions, balances] = await Promise.all([
      fetchGoldRushItems<unknown>(
        `${GOLDRUSH_BASE_URL}/${SOLANA_MAINNET_CHAIN_NAME}/address/${encodeURIComponent(wallet)}/transactions_v3/?page-size=50&no-logs=true`,
        apiKey,
        true,
      ),
      fetchGoldRushItems<GoldRushBalanceItem>(
        `${GOLDRUSH_BASE_URL}/${SOLANA_MAINNET_CHAIN_NAME}/address/${encodeURIComponent(wallet)}/balances_v2/?no-spam=true`,
        apiKey,
        false,
      ),
    ]);

    const txCount = transactions.length;
    const score = calculateCounterpartyScore(txCount, balances);
    const recommendation = getRecommendation(score);

    return NextResponse.json({
      wallet,
      score,
      txCount,
      balanceCount: balances.length,
      recommendation,
      reasons: buildReasons(txCount, balances, score),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GoldRush lookup failed." },
      { status: 502 },
    );
  }
}

async function fetchGoldRushItems<T>(url: string, apiKey: string, allowUnsupported: boolean): Promise<T[]> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (allowUnsupported && response.status === 501) {
      return [];
    }

    throw new Error(`GoldRush responded with HTTP ${response.status}.`);
  }

  const parsed = (await response.json()) as GoldRushItemsResponse<T>;

  if (parsed.error) {
    throw new Error(parsed.error_message ?? "GoldRush returned an error response.");
  }

  const items = parsed.data?.items;

  if (!Array.isArray(items)) {
    throw new Error("GoldRush response did not include items.");
  }

  return items;
}

function calculateCounterpartyScore(txCount: number, balances: readonly GoldRushBalanceItem[]): number {
  let score = 50;

  if (txCount > 100) score += 20;
  if (txCount > 500) score += 10;
  if (txCount < 5) score -= 30;

  const hasStableBalance = balances.some(
    (balance) => balance.contract_ticker_symbol === "USDC" && Number(balance.balance ?? 0) > 0,
  );

  if (hasStableBalance) score += 15;

  return Math.min(100, Math.max(0, score));
}

function getRecommendation(score: number): "APPROVE" | "REVIEW" | "REJECT" {
  if (score >= 70) return "APPROVE";
  if (score >= 40) return "REVIEW";
  return "REJECT";
}

function buildReasons(txCount: number, balances: readonly GoldRushBalanceItem[], score: number): string[] {
  const reasons = [`GoldRush returned ${txCount} recent transactions.`];

  if (txCount < 5) {
    reasons.push("Very low observed history, so policy review is recommended.");
  } else if (txCount > 500) {
    reasons.push("High transaction history improves confidence.");
  } else if (txCount > 100) {
    reasons.push("Established transaction history improves confidence.");
  }

  if (balances.some((balance) => balance.contract_ticker_symbol === "USDC" && Number(balance.balance ?? 0) > 0)) {
    reasons.push("USDC balance detected by GoldRush.");
  }

  reasons.push(`Policy recommendation: ${getRecommendation(score)}.`);
  return reasons;
}
