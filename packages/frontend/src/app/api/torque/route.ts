import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

const DEFAULT_TORQUE_EVENT_API_URL = "https://ingest.torque.so/events";
const DEFAULT_AGENT_ID = "ada-research-agent-01";

type TorqueBody = {
  amountUsd?: unknown;
  eventName?: unknown;
  proofType?: unknown;
  source?: unknown;
  txSignature?: unknown;
  userPubkey?: unknown;
};

export async function POST(request: Request) {
  const apiKey = process.env.TORQUE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      status: "skipped",
      reason: "TORQUE_API_KEY is not configured on the server.",
    });
  }

  const body = (await request.json().catch(() => null)) as TorqueBody | null;
  const userPubkey = readString(body?.userPubkey) ?? process.env.TORQUE_USER_PUBKEY ?? process.env.AGENT_WALLET_ADDRESS;
  const eventName = readString(body?.eventName) ?? "arcpay_paid_agent_request";

  if (!userPubkey) {
    return NextResponse.json({ error: "userPubkey is required for Torque custom events." }, { status: 400 });
  }

  const invalidWallet = validateSolanaAddress(userPubkey);
  if (invalidWallet) return invalidWallet;

  const eventApiUrl = (process.env.TORQUE_EVENT_API_URL ?? DEFAULT_TORQUE_EVENT_API_URL).trim();
  const payload = {
    timestamp: Date.now(),
    userPubkey,
    eventName,
    data: {
      agentId: process.env.TORQUE_AGENT_ID ?? DEFAULT_AGENT_ID,
      amountUsd: readNumber(body?.amountUsd) ?? Number(process.env.TORQUE_PAYMENT_AMOUNT_USD ?? 0),
      proofType: readString(body?.proofType) ?? "frontend_payment_request",
      source: readString(body?.source) ?? "arcpay-frontend",
      txSignature: readString(body?.txSignature) ?? process.env.TORQUE_PAYMENT_TX_SIGNATURE ?? "",
    },
  };

  try {
    const response = await fetch(eventApiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const text = await response.text();
    const result = parseBody(text);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Torque responded with HTTP ${response.status}.`, details: result },
        { status: response.status },
      );
    }

    return NextResponse.json({ status: "submitted", eventName, response: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Torque custom event failed." },
      { status: 502 },
    );
  }
}

function validateSolanaAddress(value: string) {
  try {
    new PublicKey(value);
    return null;
  } catch {
    return NextResponse.json({ error: "userPubkey must be a valid Solana address." }, { status: 400 });
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBody(text: string) {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
