import { ArcPaySdkError, createTorqueCustomEventClient } from "@arcpay/sdk";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_TORQUE_EVENT_API_URL = "https://ingest.torque.so/events";
const DEFAULT_TORQUE_EVENT_NAME = "arcpay_wallet_connected";
const DEFAULT_TORQUE_EVENT_SOURCE = "arcpay-dashboard";
const DEFAULT_TORQUE_AGENT_ID = "ada-research-agent-01";
const DEFAULT_TORQUE_PROOF_TYPE = "wallet_connected";
const PLACEHOLDER_VALUES = new Set([
  "torque_xxxxxxxxxx",
  "tq_xxxxxxxxxx",
  "YourSolanaPublicKeyHere",
  "wallet_to_score",
]);

export type TorqueSmokeStatus = "passed" | "skipped" | "failed";

export interface TorqueSmokeEnvironment {
  readonly apiKey?: string;
  readonly eventApiUrl: string;
  readonly eventName: string;
  readonly userPubkey?: string;
  readonly source: string;
  readonly agentId: string;
  readonly proofType: string;
  readonly txSignature?: string;
  readonly amountUsd?: number;
  readonly requireLiveTorque: boolean;
}

export interface TorqueSmokeResult {
  readonly provider: "Torque";
  readonly status: TorqueSmokeStatus;
  readonly message: string;
  readonly response?: unknown;
}

/**
 * Loads the Torque live-proof environment without exposing API keys in output.
 */
export function loadTorqueSmokeEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): TorqueSmokeEnvironment {
  const env = loadEnvFile(source);
  return {
    apiKey: normalizeCredential(env.TORQUE_API_KEY),
    eventApiUrl: normalizeUrl(env.TORQUE_EVENT_API_URL) ?? DEFAULT_TORQUE_EVENT_API_URL,
    eventName: normalizeCredential(env.TORQUE_EVENT_NAME) ?? DEFAULT_TORQUE_EVENT_NAME,
    userPubkey:
      normalizeWallet(env.TORQUE_USER_PUBKEY) ??
      normalizeWallet(env.AGENT_WALLET_ADDRESS),
    source: normalizeCredential(env.TORQUE_EVENT_SOURCE) ?? DEFAULT_TORQUE_EVENT_SOURCE,
    agentId: normalizeCredential(env.TORQUE_AGENT_ID) ?? DEFAULT_TORQUE_AGENT_ID,
    proofType: normalizeCredential(env.TORQUE_PROOF_TYPE) ?? DEFAULT_TORQUE_PROOF_TYPE,
    txSignature: normalizeCredential(env.TORQUE_TX_SIGNATURE),
    amountUsd: normalizeOptionalNumber(env.TORQUE_AMOUNT_USD, "TORQUE_AMOUNT_USD"),
    requireLiveTorque: env.ARCPAY_REQUIRE_LIVE_TORQUE === "true",
  };
}

/**
 * Sends one real Torque custom event. This is the live-proof path for the
 * Torque track; development adapters do not count as completion.
 */
export async function runTorqueSmoke(
  env: TorqueSmokeEnvironment = loadTorqueSmokeEnvironment(),
  fetchImpl: typeof fetch = fetch,
): Promise<TorqueSmokeResult> {
  if (!env.apiKey) {
    return missingConfig("TORQUE_API_KEY", env.requireLiveTorque);
  }

  if (!env.userPubkey) {
    return missingConfig("TORQUE_USER_PUBKEY or AGENT_WALLET_ADDRESS", env.requireLiveTorque);
  }

  try {
    const client = createTorqueCustomEventClient({
      apiKey: env.apiKey,
      eventApiUrl: env.eventApiUrl,
      fetchImpl,
    });
    const result = await client.sendCustomEvent({
      eventName: env.eventName,
      userPubkey: env.userPubkey,
      data: {
        source: env.source,
        agentId: env.agentId,
        proofType: env.proofType,
        txSignature: env.txSignature ?? "",
        amountUsd: env.amountUsd ?? 0,
        liveProof: true,
      },
    });

    return {
      provider: "Torque",
      status: "passed",
      message: `Submitted Torque custom event ${result.eventName} for ${shortenWallet(result.userPubkey)}.`,
      response: result.response,
    };
  } catch (error) {
    return {
      provider: "Torque",
      status: "failed",
      message: safeErrorMessage(error),
    };
  }
}

async function main(): Promise<void> {
  const result = await runTorqueSmoke();
  const suffix = result.response ? ` Response: ${JSON.stringify(result.response)}` : "";
  console.log(`${result.status.toUpperCase()} ${result.provider}: ${result.message}${suffix}`);

  if (result.status === "failed") {
    process.exitCode = 1;
  }
}

function missingConfig(name: string, required: boolean): TorqueSmokeResult {
  return {
    provider: "Torque",
    status: required ? "failed" : "skipped",
    message: `${name} is not set.`,
  };
}

function normalizeCredential(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed || PLACEHOLDER_VALUES.has(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function normalizeWallet(value: string | undefined): string | undefined {
  const trimmed = normalizeCredential(value);

  if (!trimmed || trimmed.length < 32) {
    return undefined;
  }

  return trimmed;
}

function normalizeUrl(value: string | undefined): string | undefined {
  const trimmed = normalizeCredential(value);

  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) {
      return undefined;
    }
    return trimmed;
  } catch {
    return undefined;
  }
}

function normalizeOptionalNumber(value: string | undefined, fieldName: string): number | undefined {
  const trimmed = normalizeCredential(value);

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed)) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${fieldName} must be a finite number.`);
  }

  return parsed;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof ArcPaySdkError) {
    return `${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error.";
}

function shortenWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`;
}

const executedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : undefined;

if (import.meta.url === executedPath) {
  void main();
}
