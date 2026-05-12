import { createQvacLocalClient, makeTreasuryDecision, type TreasuryDecision } from "@arcpay/sdk";

const DEFAULT_BALANCE = 500;
const DEFAULT_CURRENT_RATE = 1.002;
const DEFAULT_KAMINO_APY = 5.2;
const DEFAULT_TIMEOUT_MS = 300_000;

type QvacLiveStatus =
  | {
      readonly source: "qvac-local";
      readonly liveProof: true;
      readonly status: "passed";
      readonly decision: TreasuryDecision;
      readonly modelSrcConfigured: boolean;
      readonly sdkPathConfigured: boolean;
      readonly generatedAt: string;
    }
  | {
      readonly source: "qvac-local";
      readonly liveProof: false;
      readonly status: "unavailable" | "failed";
      readonly message: string;
      readonly modelSrcConfigured: boolean;
      readonly sdkPathConfigured: boolean;
      readonly generatedAt: string;
    };

export async function readLiveQvacDecision(env: NodeJS.ProcessEnv = process.env): Promise<QvacLiveStatus> {
  const sdkPath = cleanString(env.QVAC_SDK_PATH);
  const modelSrc = cleanString(env.QVAC_MODEL_SRC);
  const modelConfig = readOptionalJsonObject(env.QVAC_MODEL_CONFIG_JSON);
  const generatedAt = new Date().toISOString();

  if (!sdkPath && env.ARCPAY_REQUIRE_LIVE_QVAC !== "true") {
    return {
      source: "qvac-local",
      liveProof: false,
      status: "unavailable",
      message: "QVAC runtime is not configured on this backend.",
      modelSrcConfigured: Boolean(modelSrc),
      sdkPathConfigured: false,
      generatedAt,
    };
  }

  try {
    const pendingPayments = JSON.parse(cleanString(env.QVAC_PENDING_PAYMENTS_JSON) ?? "[]") as [];
    const qvac = createQvacLocalClient({
      modelSrc,
      sdkPath,
      modelConfig,
    });
    const decision = await withTimeout(
      makeTreasuryDecision({
        qvac,
        balance: readNumber(env.QVAC_BALANCE, DEFAULT_BALANCE),
        currentRate: readNumber(env.QVAC_CURRENT_RATE, DEFAULT_CURRENT_RATE),
        kaminoAPY: readNumber(env.QVAC_KAMINO_APY, DEFAULT_KAMINO_APY),
        pendingPayments,
      }),
      readNumber(env.QVAC_PROOF_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    );

    return {
      source: "qvac-local",
      liveProof: true,
      status: "passed",
      decision,
      modelSrcConfigured: Boolean(modelSrc),
      sdkPathConfigured: Boolean(sdkPath),
      generatedAt,
    };
  } catch (error) {
    return {
      source: "qvac-local",
      liveProof: false,
      status: "failed",
      message: error instanceof Error ? error.message : "QVAC decision failed.",
      modelSrcConfigured: Boolean(modelSrc),
      sdkPathConfigured: Boolean(sdkPath),
      generatedAt,
    };
  }
}

function cleanString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readNumber(value: string | undefined, fallback: number): number {
  const clean = cleanString(value);
  if (!clean) return fallback;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOptionalJsonObject(value: string | undefined): Record<string, unknown> | undefined {
  const clean = cleanString(value);
  if (!clean) return undefined;

  const parsed = JSON.parse(clean) as unknown;
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`QVAC timed out after ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
