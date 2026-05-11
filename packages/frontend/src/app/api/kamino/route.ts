import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

const DEFAULT_KAMINO_API_BASE_URL = "https://api.kamino.finance";
const DEFAULT_MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
const DEFAULT_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEFAULT_USDC_RESERVE = "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59";
const DEFAULT_MINTS: Record<string, string> = {
  USDC: DEFAULT_USDC_MINT,
  SOL: "So11111111111111111111111111111111111111112",
  PUSD: "CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s",
};

type KaminoBody = {
  action?: unknown;
  amount?: unknown;
  mint?: unknown;
  wallet?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as KaminoBody | null;
  const wallet = readString(body?.wallet) ?? process.env.AGENT_WALLET_ADDRESS;
  const amount = readNumber(body?.amount);
  const action = readString(body?.action) === "withdraw" ? "withdraw" : "deposit";
  const mint = resolveMint(readString(body?.mint) ?? process.env.USDC_MINT_ADDRESS ?? DEFAULT_USDC_MINT);
  const market = process.env.KAMINO_MARKET_ADDRESS ?? DEFAULT_MARKET;
  const reserve = reserveForMint(mint);

  if (!wallet) return NextResponse.json({ error: "wallet is required." }, { status: 400 });
  const invalid = validateSolanaAddress(wallet, "wallet") ?? validateSolanaAddress(mint, "mint");
  if (invalid) return invalid;
  if (amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number." }, { status: 400 });
  }
  if (!reserve) {
    return NextResponse.json({ error: `No Kamino reserve configured for mint ${mint}.` }, { status: 400 });
  }

  const baseUrl = (process.env.KAMINO_API_BASE_URL ?? DEFAULT_KAMINO_API_BASE_URL).replace(/\/+$/, "");
  const path = action === "withdraw" ? "/ktx/klend/withdraw" : "/ktx/klend/deposit";

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wallet,
        market,
        reserve,
        amount: String(amount),
      }),
      cache: "no-store",
    });
    const text = await response.text();
    const payload = parseBody(text);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Kamino responded with HTTP ${response.status}.`, details: payload },
        { status: response.status },
      );
    }

    const transaction = findTransaction(payload);
    if (!transaction) {
      return NextResponse.json({ error: "Kamino did not return an unsigned transaction.", details: payload }, { status: 502 });
    }

    return NextResponse.json({
      status: "transaction_built",
      action,
      market,
      mint,
      reserve,
      transactionBytes: Buffer.from(transaction, "base64").byteLength,
      transaction,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kamino transaction build failed." },
      { status: 502 },
    );
  }
}

function reserveForMint(mint: string) {
  if (mint === (process.env.USDC_MINT_ADDRESS ?? DEFAULT_USDC_MINT)) {
    return process.env.KAMINO_USDC_RESERVE_ADDRESS ?? DEFAULT_USDC_RESERVE;
  }
  return process.env[`KAMINO_${mint}_RESERVE_ADDRESS`];
}

function resolveMint(value: string) {
  return DEFAULT_MINTS[value.toUpperCase()] ?? value;
}

function validateSolanaAddress(value: string, label: string) {
  try {
    new PublicKey(value);
    return null;
  } catch {
    return NextResponse.json({ error: `${label} must be a valid Solana address.` }, { status: 400 });
  }
}

function findTransaction(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["transaction", "tx", "serializedTransaction", "transactionBase64"]) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  return findTransaction(record.data);
}

function parseBody(text: string) {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
