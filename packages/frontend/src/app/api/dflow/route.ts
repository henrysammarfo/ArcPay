import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

const DEFAULT_DFLOW_API_BASE_URL = "https://dev-quote-api.dflow.net";

const TOKEN_DECIMALS: Record<string, number> = {
  AUDD: 6,
  PUSD: 6,
  SOL: 9,
  USDC: 6,
  USDT: 6,
};

const DEFAULT_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoRbc3d7M6Qia4A4A3K",
};

type DFlowOrderResponse = {
  contextSlot?: number;
  executionMode?: "sync" | "async";
  inAmount?: string;
  inputMint?: string;
  minOutAmount?: string;
  outAmount?: string;
  outputMint?: string;
  priceImpactPct?: string;
  slippageBps?: number;
  transaction?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    amount?: unknown;
    from?: unknown;
    priority?: unknown;
    slippageBps?: unknown;
    to?: unknown;
    userPublicKey?: unknown;
  } | null;

  const from = typeof body?.from === "string" ? body.from.trim().toUpperCase() : "";
  const to = typeof body?.to === "string" ? body.to.trim().toUpperCase() : "";
  const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  const slippageBps = body?.slippageBps === "auto" ? "auto" : Number(body?.slippageBps ?? 50);
  const userPublicKey = typeof body?.userPublicKey === "string" ? body.userPublicKey.trim() : "";
  const priority = typeof body?.priority === "string" ? body.priority : "balanced";

  if (!from || !to || from === to) {
    return NextResponse.json({ error: "Select different input and output tokens." }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be positive." }, { status: 400 });
  }

  if (slippageBps !== "auto" && (!Number.isFinite(slippageBps) || slippageBps < 0 || slippageBps > 10_000)) {
    return NextResponse.json({ error: "Slippage must be between 0 and 10000 bps." }, { status: 400 });
  }

  if (userPublicKey) {
    const invalid = validateSolanaAddress(userPublicKey, "userPublicKey");
    if (invalid) return invalid;
  }

  const inputMint = getMint(from);
  const outputMint = getMint(to);

  if (!inputMint || !outputMint) {
    return NextResponse.json(
      { error: `Missing mint configuration for ${!inputMint ? from : to}. Set ${!inputMint ? from : to}_MINT_ADDRESS.` },
      { status: 400 },
    );
  }

  const baseUrl = (process.env.DFLOW_API_BASE_URL ?? DEFAULT_DFLOW_API_BASE_URL).replace(/\/+$/, "");
  const query = new URLSearchParams({
    amount: toBaseUnits(amount, TOKEN_DECIMALS[from] ?? 6),
    includeAddressLookupTables: "false",
    inputMint,
    outputMint,
    slippageBps: String(slippageBps),
  });

  if (userPublicKey) query.set("userPublicKey", userPublicKey);
  if (priority === "fast") query.set("prioritizationFeeLamports", "high");
  if (priority === "cheapest") query.set("prioritizationFeeLamports", "disabled");

  try {
    const response = await fetch(`${baseUrl}/order?${query.toString()}`, {
      headers: process.env.DFLOW_API_KEY ? { "x-api-key": process.env.DFLOW_API_KEY } : undefined,
      cache: "no-store",
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) as DFlowOrderResponse : null;

    if (!response.ok || !payload) {
      return NextResponse.json(
        { error: `DFlow responded with HTTP ${response.status}.`, details: payload },
        { status: response.status || 502 },
      );
    }

    return NextResponse.json({
      contextSlot: payload.contextSlot,
      executionMode: payload.executionMode,
      inAmount: payload.inAmount,
      inputMint: payload.inputMint,
      minOutAmount: payload.minOutAmount,
      outAmount: payload.outAmount,
      outputMint: payload.outputMint,
      priceImpactPct: payload.priceImpactPct,
      slippageBps: payload.slippageBps,
      signable: Boolean(payload.transaction),
      transaction: payload.transaction,
      uiOutAmount: fromBaseUnits(payload.outAmount ?? "0", TOKEN_DECIMALS[to] ?? 6),
      uiMinOutAmount: fromBaseUnits(payload.minOutAmount ?? payload.outAmount ?? "0", TOKEN_DECIMALS[to] ?? 6),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DFlow quote failed." },
      { status: 502 },
    );
  }
}

function getMint(symbol: string) {
  return process.env[`${symbol}_MINT_ADDRESS`] ?? DEFAULT_MINTS[symbol];
}

function validateSolanaAddress(address: string, label: string) {
  try {
    new PublicKey(address);
    return null;
  } catch {
    return NextResponse.json({ error: `Invalid ${label}.` }, { status: 400 });
  }
}

function toBaseUnits(value: number, decimals: number) {
  const scaled = Math.round(value * 10 ** decimals);
  return String(scaled);
}

function fromBaseUnits(value: string, decimals: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return (numeric / 10 ** decimals).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
  });
}
