import {
  ArcPaySdkError,
  autoDepositToKamino,
  createKaminoRestClient,
} from "@arcpay/sdk";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEFAULT_KAMINO_MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
const DEFAULT_KAMINO_USDC_RESERVE = "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59";
const DEFAULT_KAMINO_DEPOSIT_AMOUNT = 0.01;
const PLACEHOLDER_VALUES = new Set([
  "your_mainnet_wallet_public_key",
  "your_signing_wallet_public_key",
  "KaminoUsdcReserveAddressHere",
]);

export type KaminoSmokeStatus = "passed" | "skipped" | "failed";

export interface KaminoSmokeEnvironment {
  readonly agentWalletAddress?: string;
  readonly usdcMintAddress: string;
  readonly kaminoMarketAddress: string;
  readonly kaminoUsdcReserveAddress: string;
  readonly kaminoDepositAmount: number;
  readonly requireLiveKamino: boolean;
}

export interface KaminoSmokeResult {
  readonly status: KaminoSmokeStatus;
  readonly message: string;
}

/**
 * Loads environment values for the Kamino transaction-builder smoke check.
 *
 * This command only builds an unsigned transaction. It never signs, submits, or
 * logs transaction bytes.
 */
export function loadKaminoSmokeEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): KaminoSmokeEnvironment {
  const env = loadEnvFile(source);
  return {
    agentWalletAddress: normalizeRequiredAddress(env.AGENT_WALLET_ADDRESS),
    usdcMintAddress: normalizeAddress(env.USDC_MINT_ADDRESS) ?? DEFAULT_USDC_MINT,
    kaminoMarketAddress: normalizeAddress(env.KAMINO_MARKET_ADDRESS) ?? DEFAULT_KAMINO_MARKET,
    kaminoUsdcReserveAddress:
      normalizeAddress(env.KAMINO_USDC_RESERVE_ADDRESS) ?? DEFAULT_KAMINO_USDC_RESERVE,
    kaminoDepositAmount: normalizePositiveNumber(
      env.KAMINO_DEPOSIT_AMOUNT,
      "KAMINO_DEPOSIT_AMOUNT",
    ) ?? DEFAULT_KAMINO_DEPOSIT_AMOUNT,
    requireLiveKamino: env.ARCPAY_REQUIRE_LIVE_KAMINO === "true",
  };
}

/**
 * Verifies Kamino can build an unsigned USDC deposit transaction for the
 * configured wallet and reserve. No funds move in this smoke check.
 */
export async function runKaminoSmoke(
  env: KaminoSmokeEnvironment = loadKaminoSmokeEnvironment(),
  fetchImpl: typeof fetch = fetch,
): Promise<KaminoSmokeResult> {
  if (!env.agentWalletAddress) {
    return {
      status: env.requireLiveKamino ? "failed" : "skipped",
      message: "AGENT_WALLET_ADDRESS is not set to a real mainnet wallet public key.",
    };
  }

  try {
    const kamino = createKaminoRestClient({
      fetchImpl,
      reserveByMint: {
        [env.usdcMintAddress]: env.kaminoUsdcReserveAddress,
      },
    });
    const result = await autoDepositToKamino(kamino, {
      marketAddress: env.kaminoMarketAddress,
      mint: env.usdcMintAddress,
      amount: env.kaminoDepositAmount,
      agentWallet: env.agentWalletAddress,
    });

    if (!result.transaction) {
      throw new Error("Kamino did not return an unsigned transaction.");
    }

    return {
      status: "passed",
      message: `Validated unsigned Kamino deposit transaction for ${result.deposited} USDC.`,
    };
  } catch (error) {
    return {
      status: "failed",
      message: safeErrorMessage(error),
    };
  }
}

function normalizeRequiredAddress(value: string | undefined): string | undefined {
  const normalized = normalizeAddress(value);
  return normalized && !PLACEHOLDER_VALUES.has(normalized) ? normalized : undefined;
}

function normalizeAddress(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePositiveNumber(value: string | undefined, key: string): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${key} must be greater than zero.`);
  }

  return parsed;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof ArcPaySdkError) {
    const cause = error.cause instanceof Error ? ` Cause: ${error.cause.message}` : "";
    return `${error.code}: ${error.message}${cause}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown Kamino smoke failure.";
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  const result = await runKaminoSmoke();
  console.log(`${result.status.toUpperCase()} Kamino: ${result.message}`);

  if (result.status === "failed") {
    process.exitCode = 1;
  }
}
