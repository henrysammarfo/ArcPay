import {
  loadTorqueSmokeEnvironment,
  runTorqueSmoke,
  type TorqueSmokeEnvironment,
  type TorqueSmokeResult,
} from "./torque-smoke.js";
import { loadEnvFile } from "./env-file.js";

const WALLET_CONNECTED_EVENT = "arcpay_wallet_connected";
const PAID_AGENT_REQUEST_EVENT = "arcpay_paid_agent_request";
const DEFAULT_AGENT_ID = "ada-research-agent-01";
const DEFAULT_PAYMENT_AMOUNT_USD = 0.01;

export interface TorqueProofEnvironment {
  readonly apiKey?: string;
  readonly eventApiUrl: string;
  readonly userPubkey?: string;
  readonly agentId: string;
  readonly walletEventSource: string;
  readonly paymentEventSource: string;
  readonly paymentTxSignature?: string;
  readonly paymentAmountUsd: number;
  readonly requireLiveTorque: boolean;
}

export interface TorqueProofResult {
  readonly status: "passed" | "failed" | "skipped";
  readonly events: readonly TorqueSmokeResult[];
  readonly message: string;
}

/**
 * Loads the two-event Torque proof environment without exposing API keys.
 */
export function loadTorqueProofEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): TorqueProofEnvironment {
  const env = loadEnvFile(source);
  const base = loadTorqueSmokeEnvironment(env);

  return {
    apiKey: base.apiKey,
    eventApiUrl: base.eventApiUrl,
    userPubkey: base.userPubkey,
    agentId: cleanString(env.TORQUE_AGENT_ID) ?? DEFAULT_AGENT_ID,
    walletEventSource: cleanString(env.TORQUE_WALLET_EVENT_SOURCE) ?? "arcpay-dashboard",
    paymentEventSource: cleanString(env.TORQUE_PAYMENT_EVENT_SOURCE) ?? "x402-server",
    paymentTxSignature:
      cleanString(env.TORQUE_PAYMENT_TX_SIGNATURE) ?? cleanString(env.TORQUE_TX_SIGNATURE),
    paymentAmountUsd:
      readOptionalNumber(env.TORQUE_PAYMENT_AMOUNT_USD ?? env.TORQUE_AMOUNT_USD) ??
      DEFAULT_PAYMENT_AMOUNT_USD,
    requireLiveTorque: env.ARCPAY_REQUIRE_LIVE_TORQUE === "true",
  };
}

/**
 * Submits ArcPay's required Torque proof events:
 * wallet connection and paid agent request.
 */
export async function runTorqueProof(
  env: TorqueProofEnvironment = loadTorqueProofEnvironment(),
  fetchImpl: typeof fetch = fetch,
): Promise<TorqueProofResult> {
  if (!env.paymentTxSignature) {
    return {
      status: env.requireLiveTorque ? "failed" : "skipped",
      events: [],
      message: "TORQUE_PAYMENT_TX_SIGNATURE or TORQUE_TX_SIGNATURE is not set.",
    };
  }

  const events: TorqueSmokeEnvironment[] = [
    {
      apiKey: env.apiKey,
      eventApiUrl: env.eventApiUrl,
      eventName: WALLET_CONNECTED_EVENT,
      userPubkey: env.userPubkey,
      source: env.walletEventSource,
      agentId: env.agentId,
      proofType: "wallet_connected",
      txSignature: "",
      amountUsd: 0,
      requireLiveTorque: env.requireLiveTorque,
    },
    {
      apiKey: env.apiKey,
      eventApiUrl: env.eventApiUrl,
      eventName: PAID_AGENT_REQUEST_EVENT,
      userPubkey: env.userPubkey,
      source: env.paymentEventSource,
      agentId: env.agentId,
      proofType: "solana-verified",
      txSignature: env.paymentTxSignature,
      amountUsd: env.paymentAmountUsd,
      requireLiveTorque: env.requireLiveTorque,
    },
  ];

  const results: TorqueSmokeResult[] = [];

  for (const event of events) {
    const result = await runTorqueSmoke(event, fetchImpl);
    results.push(result);

    if (result.status === "failed") {
      return {
        status: "failed",
        events: results,
        message: `Torque proof failed while submitting ${event.eventName}.`,
      };
    }
  }

  const skipped = results.find((result) => result.status === "skipped");

  if (skipped) {
    return {
      status: "skipped",
      events: results,
      message: skipped.message,
    };
  }

  return {
    status: "passed",
    events: results,
    message: "Submitted ArcPay wallet and paid-request Torque proof events.",
  };
}

async function main(): Promise<void> {
  const result = await runTorqueProof();

  console.log(`${result.status.toUpperCase()} Torque: ${result.message}`);
  for (const event of result.events) {
    const suffix = event.response ? ` Response: ${JSON.stringify(event.response)}` : "";
    console.log(`- ${event.status.toUpperCase()} ${event.message}${suffix}`);
  }

  if (result.status === "failed") {
    process.exitCode = 1;
  }
}

function cleanString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalNumber(value: string | undefined): number | undefined {
  const trimmed = cleanString(value);

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const executedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : undefined;

if (import.meta.url === executedPath) {
  void main();
}
