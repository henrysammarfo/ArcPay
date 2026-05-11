import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

const DEFAULT_API_BASE_URL = "https://payments.magicblock.app";
const DEFAULT_CLUSTER = "devnet";
const DEFAULT_DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

type MagicBlockBody = {
  amount?: unknown;
  mint?: unknown;
  owner?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as MagicBlockBody | null;
  const apiBaseUrl = (process.env.MAGICBLOCK_PRIVATE_PAYMENTS_API_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  const cluster = process.env.MAGICBLOCK_CLUSTER ?? DEFAULT_CLUSTER;
  const owner = readString(body?.owner) ?? process.env.MAGICBLOCK_PAYMENT_OWNER_ADDRESS ?? process.env.AGENT_WALLET_ADDRESS;
  const mint = readString(body?.mint) ?? process.env.MAGICBLOCK_PAYMENT_MINT_ADDRESS ?? process.env.USDC_MINT_ADDRESS ?? DEFAULT_DEVNET_USDC;
  const amount = readInteger(body?.amount) ?? Number(process.env.MAGICBLOCK_PAYMENT_AMOUNT ?? 1_000_000);

  if (!owner) return NextResponse.json({ error: "owner is required." }, { status: 400 });
  const invalid = validateSolanaAddress(owner, "owner") ?? validateSolanaAddress(mint, "mint");
  if (invalid) return invalid;
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive integer in token base units." }, { status: 400 });
  }

  try {
    const health = await readJson(`${apiBaseUrl}/health`, { method: "GET" });
    const deposit = await readJson(`${apiBaseUrl}/v1/spl/deposit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        owner,
        mint,
        amount,
        cluster,
        initIfMissing: true,
        initVaultIfMissing: true,
        initAtasIfMissing: true,
        idempotent: true,
      }),
    });

    const transaction = findTransaction(deposit);
    return NextResponse.json({
      status: transaction ? "transaction_built" : "builder_reached",
      apiBaseUrl,
      cluster,
      health,
      owner,
      mint,
      amount,
      depositResponseKeys: deposit && typeof deposit === "object" ? Object.keys(deposit).sort() : [],
      transactionBytes: transaction ? Buffer.from(transaction, "base64").byteLength : undefined,
      transaction,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "MagicBlock Private Payments request failed." },
      { status: 502 },
    );
  }
}

async function readJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const text = await response.text();
  const payload = parseBody(text);
  if (!response.ok) {
    throw new Error(`MagicBlock responded with HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  return payload;
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
  for (const key of ["transactionBase64", "transaction", "tx", "serializedTransaction", "encodedTransaction"]) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  return findTransaction(record.data);
}

function parseBody(text: string) {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
