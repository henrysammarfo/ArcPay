import { ArcPaySdkError, createQvacLocalClient, makeTreasuryDecision } from "@arcpay/sdk";

const DEFAULT_BALANCE = 500;
const DEFAULT_CURRENT_RATE = 1.002;
const DEFAULT_KAMINO_APY = 5.2;
const DEFAULT_TIMEOUT_MS = 180_000;

export interface QvacProofEnvironment {
  readonly modelSrc?: string;
  readonly sdkPath?: string;
  readonly modelConfigJson?: string;
  readonly balance: number;
  readonly currentRate: number;
  readonly kaminoAPY: number;
  readonly pendingPaymentsJson: string;
  readonly requireLiveQvac: boolean;
  readonly timeoutMs: number;
}

export interface QvacProofResult {
  readonly status: "passed" | "skipped" | "failed";
  readonly message: string;
  readonly decision?: {
    readonly action: string;
    readonly confidence: number;
    readonly reason: string;
  };
}

/**
 * Loads QVAC live-proof environment values without requiring secrets.
 */
export function loadQvacProofEnvironment(source: NodeJS.ProcessEnv = process.env): QvacProofEnvironment {
  return {
    modelSrc: cleanString(source.QVAC_MODEL_SRC),
    sdkPath: cleanString(source.QVAC_SDK_PATH),
    modelConfigJson: cleanString(source.QVAC_MODEL_CONFIG_JSON),
    balance: readNumber(source.QVAC_BALANCE, DEFAULT_BALANCE),
    currentRate: readNumber(source.QVAC_CURRENT_RATE, DEFAULT_CURRENT_RATE),
    kaminoAPY: readNumber(source.QVAC_KAMINO_APY, DEFAULT_KAMINO_APY),
    pendingPaymentsJson: cleanString(source.QVAC_PENDING_PAYMENTS_JSON) ?? "[]",
    requireLiveQvac: source.ARCPAY_REQUIRE_LIVE_QVAC === "true",
    timeoutMs: readNumber(source.QVAC_PROOF_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

/**
 * Runs one real local QVAC treasury decision. Development adapters do not count.
 */
export async function runQvacProof(
  env: QvacProofEnvironment = loadQvacProofEnvironment(),
): Promise<QvacProofResult> {
  if (!env.requireLiveQvac) {
    return {
      status: "skipped",
      message: "ARCPAY_REQUIRE_LIVE_QVAC is not true.",
    };
  }

  try {
    const pendingPayments = JSON.parse(env.pendingPaymentsJson) as [];
    const modelConfig = readOptionalJsonObject(env.modelConfigJson, "QVAC_MODEL_CONFIG_JSON");
    const qvac = createQvacLocalClient({
      modelSrc: env.modelSrc,
      sdkPath: env.sdkPath,
      modelConfig,
      onProgress: (progress) => {
        console.error(`QVAC load progress: ${JSON.stringify(progress)}`);
      },
    });
    console.error(`QVAC proof starting with ${env.timeoutMs}ms timeout.`);
    const decision = await withTimeout(
      makeTreasuryDecision({
        qvac,
        balance: env.balance,
        currentRate: env.currentRate,
        pendingPayments,
        kaminoAPY: env.kaminoAPY,
      }),
      env.timeoutMs,
    );

    return {
      status: "passed",
      message: `QVAC returned live treasury decision ${decision.action}.`,
      decision,
    };
  } catch (error) {
    return {
      status: "failed",
      message: safeErrorMessage(error),
    };
  }
}

async function main(): Promise<void> {
  const result = await runQvacProof();
  const suffix = result.decision ? ` Decision: ${JSON.stringify(result.decision)}` : "";
  console.log(`${result.status.toUpperCase()} QVAC: ${result.message}${suffix}`);

  if (result.status === "failed") {
    process.exitCode = 1;
  }
}

function cleanString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: string | undefined, fallback: number): number {
  const trimmed = cleanString(value);

  if (!trimmed) {
    return fallback;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed)) {
    throw new ArcPaySdkError("VALIDATION_ERROR", "QVAC numeric env values must be finite numbers.");
  }

  return parsed;
}

function readOptionalJsonObject(value: string | undefined, name: string): Record<string, unknown> | undefined {
  const trimmed = cleanString(value);

  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${name} must be a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ArcPaySdkError("VALIDATION_ERROR", "QVAC_PROOF_TIMEOUT_MS must be a positive number.");
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(
            new ArcPaySdkError(
              "EXTERNAL_SERVICE_ERROR",
              `QVAC proof timed out after ${timeoutMs}ms while loading or running the local model.`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function safeErrorMessage(error: unknown): string {
  const cause = readCause(error);
  const causeMessage = cause ? ` Cause: ${safeErrorMessage(cause)}` : "";

  if (error instanceof ArcPaySdkError) {
    return `${error.code}: ${error.message}${causeMessage}`;
  }

  if (error instanceof Error) {
    return `${error.message}${causeMessage}`;
  }

  return "Unknown error.";
}

function readCause(error: unknown): unknown {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { readonly cause?: unknown }).cause;
}

const executedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : undefined;

if (import.meta.url === executedPath) {
  void main();
}
