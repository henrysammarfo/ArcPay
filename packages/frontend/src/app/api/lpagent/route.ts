import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

const DEFAULT_LP_AGENT_API_BASE_URL = "https://api.lpagent.io/open-api/v1";

export async function GET(request: Request) {
  const apiKey = process.env.LP_AGENT_API_KEY;
  const baseUrl = normalizeBaseUrl(process.env.LP_AGENT_API_BASE_URL ?? DEFAULT_LP_AGENT_API_BASE_URL);

  if (!apiKey) {
    return NextResponse.json(
      { error: "LP_AGENT_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const owner = url.searchParams.get("owner")?.trim() ?? "";
  const poolId = url.searchParams.get("poolId")?.trim() ?? "";

  if (owner) {
    const invalid = validateSolanaAddress(owner, "owner");
    if (invalid) return invalid;

    return proxyLpAgent(`${baseUrl}/lp-positions/opening?owner=${encodeURIComponent(owner)}`, apiKey);
  }

  if (poolId) {
    return proxyLpAgent(`${baseUrl}/pools/${encodeURIComponent(poolId)}/info`, apiKey);
  }

  return NextResponse.json({ error: "Provide owner or poolId." }, { status: 400 });
}

export async function POST(request: Request) {
  const apiKey = process.env.LP_AGENT_API_KEY;
  const baseUrl = normalizeBaseUrl(process.env.LP_AGENT_API_BASE_URL ?? DEFAULT_LP_AGENT_API_BASE_URL);

  if (!apiKey) {
    return NextResponse.json(
      { error: "LP_AGENT_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    poolId?: unknown;
    owner?: unknown;
    inputSOL?: unknown;
    percentX?: unknown;
    slippageBps?: unknown;
  } | null;
  const poolId = typeof body?.poolId === "string" ? body.poolId.trim() : "";
  const owner = typeof body?.owner === "string" ? body.owner.trim() : "";
  const inputSOL = typeof body?.inputSOL === "number" ? body.inputSOL : Number(body?.inputSOL);
  const percentX = body?.percentX === undefined ? undefined : Number(body.percentX);
  const slippageBps = body?.slippageBps === undefined ? 50 : Number(body.slippageBps);

  if (!poolId) return NextResponse.json({ error: "poolId is required." }, { status: 400 });
  const invalid = validateSolanaAddress(owner, "owner");
  if (invalid) return invalid;
  if (!Number.isFinite(inputSOL) || inputSOL <= 0) {
    return NextResponse.json({ error: "inputSOL must be a positive number." }, { status: 400 });
  }
  if (percentX !== undefined && (!Number.isFinite(percentX) || percentX < 0 || percentX > 1)) {
    return NextResponse.json({ error: "percentX must be between 0 and 1." }, { status: 400 });
  }
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10_000) {
    return NextResponse.json({ error: "slippageBps must be an integer from 0 to 10000." }, { status: 400 });
  }

  return proxyLpAgent(`${baseUrl}/pools/${encodeURIComponent(poolId)}/add-tx`, apiKey, {
    method: "POST",
    body: JSON.stringify({
      inputSOL,
      mode: "zap-in",
      owner,
      percentX,
      provider: "JUPITER_ULTRA",
      slippage_bps: slippageBps,
      stratergy: "Spot",
    }),
  });
}

async function proxyLpAgent(url: string, apiKey: string, init: RequestInit = {}) {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        "x-api-key": apiKey,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      cache: "no-store",
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      return NextResponse.json(
        { error: `LP Agent responded with HTTP ${response.status}.`, details: payload },
        { status: response.status },
      );
    }

    return NextResponse.json({
      positionCount: countPositions(payload),
      transactionCount: countTransactions(payload),
      raw: payload,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "LP Agent request failed." },
      { status: 502 },
    );
  }
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function validateSolanaAddress(address: string, label: string) {
  if (!address) return NextResponse.json({ error: `${label} is required.` }, { status: 400 });

  try {
    new PublicKey(address);
    return null;
  } catch {
    return NextResponse.json({ error: `Invalid ${label} Solana address.` }, { status: 400 });
  }
}

function countPositions(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (isRecord(raw)) {
    if (typeof raw.count === "number") return raw.count;
    if (Array.isArray(raw.data)) return raw.data.length;
    if (Array.isArray(raw.positions)) return raw.positions.length;
  }
  return 0;
}

function countTransactions(raw: unknown): number {
  return collectTransactionCandidates(raw).filter((candidate) => typeof candidate === "string" && candidate.trim()).length;
}

function collectTransactionCandidates(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(collectTransactionCandidates);
  if (!isRecord(value)) return [];

  const candidates = [
    value.transaction,
    value.transactions,
    value.tx,
    value.txs,
    value.serializedTransaction,
    value.serializedTransactions,
    value.swapTxsWithJito,
    value.addLiquidityTxsWithJito,
  ];
  return candidates.flatMap((candidate) => (Array.isArray(candidate) ? candidate : [candidate])).concat(collectTransactionCandidates(value.data));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
