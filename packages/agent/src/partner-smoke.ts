import {
  ArcPaySdkError,
  createDFlowRestClient,
  createGoldRushRestClient,
  createLpAgentRestClient,
  getOptimalRate,
} from "@arcpay/sdk";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_AUDD_MINT = "HJiQv34JpPDZHt9g5yCRpFqMTCBhSMuSudYCABiXGBEX";
const DEFAULT_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEFAULT_BIRDEYE_PRICE_MINT = "So11111111111111111111111111111111111111112";
const DEFAULT_DFLOW_API_BASE_URL = "https://dev-quote-api.dflow.net";
const DEFAULT_DFLOW_INPUT_MINT = "So11111111111111111111111111111111111111112";
const DEFAULT_DFLOW_QUOTE_AMOUNT = "1000000";
const DEFAULT_SCORE_WALLET = "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz";
const DEFAULT_LP_AGENT_API_BASE_URL = "https://api.lpagent.io/open-api/v1";
const DEFAULT_LP_AGENT_ZAP_IN_SLIPPAGE_BPS = 50;
const PLACEHOLDER_VALUES = new Set([
  "your_birdeye_key",
  "dflow_xxxxxxxxxx",
  "your_goldrush_key",
  "wallet_to_score",
  "lp_xxxxxxxxxx",
]);

export type PartnerSmokeStatus = "passed" | "skipped" | "failed";

export interface PartnerSmokeEnvironment {
  readonly auddMintAddress: string;
  readonly usdcMintAddress: string;
  readonly birdeyePriceMintAddress: string;
  readonly dflowApiKey?: string;
  readonly dflowApiBaseUrl: string;
  readonly dflowInputMintAddress: string;
  readonly dflowOutputMintAddress: string;
  readonly dflowQuoteAmount: bigint;
  readonly birdeyeApiKey?: string;
  readonly goldRushApiKey?: string;
  readonly goldRushScoreWallet: string;
  readonly lpAgentApiKey?: string;
  readonly lpAgentApiBaseUrl: string;
  readonly lpAgentPoolId?: string;
  readonly lpAgentOwnerAddress?: string;
  readonly lpAgentZapInPoolId?: string;
  readonly lpAgentZapInWalletAddress?: string;
  readonly lpAgentZapInInputSol?: number;
  readonly lpAgentZapInPercentX?: number;
  readonly lpAgentZapInSlippageBps: number;
  readonly requireLivePartners: boolean;
  readonly requireLiveDFlow: boolean;
  readonly requireLiveLpAgent: boolean;
}

export interface PartnerSmokeCheck {
  readonly provider: "Birdeye" | "GoldRush" | "DFlow" | "LP Agent";
  readonly status: PartnerSmokeStatus;
  readonly message: string;
}

export interface PartnerSmokeResult {
  readonly checks: readonly PartnerSmokeCheck[];
  readonly passed: boolean;
}

/**
 * Loads environment values for live read-only partner smoke checks.
 *
 * Secrets are only read from environment variables and are never included in
 * returned check messages.
 */
export function loadPartnerSmokeEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): PartnerSmokeEnvironment {
  const env = loadEnvFile(source);
  return {
    auddMintAddress: env.AUDD_MINT_ADDRESS ?? DEFAULT_AUDD_MINT,
    usdcMintAddress: env.USDC_MINT_ADDRESS ?? DEFAULT_USDC_MINT,
    birdeyePriceMintAddress: normalizeWallet(env.BIRDEYE_PRICE_MINT_ADDRESS) ?? DEFAULT_BIRDEYE_PRICE_MINT,
    birdeyeApiKey: normalizeCredential(env.BIRDEYE_API_KEY),
    dflowApiKey: normalizeCredential(env.DFLOW_API_KEY),
    dflowApiBaseUrl: normalizeUrl(env.DFLOW_API_BASE_URL) ?? DEFAULT_DFLOW_API_BASE_URL,
    dflowInputMintAddress: normalizeWallet(env.DFLOW_INPUT_MINT_ADDRESS) ?? DEFAULT_DFLOW_INPUT_MINT,
    dflowOutputMintAddress: normalizeWallet(env.DFLOW_OUTPUT_MINT_ADDRESS) ?? (env.USDC_MINT_ADDRESS ?? DEFAULT_USDC_MINT),
    dflowQuoteAmount: normalizeBigIntAmount(env.DFLOW_QUOTE_AMOUNT, "DFLOW_QUOTE_AMOUNT") ?? BigInt(DEFAULT_DFLOW_QUOTE_AMOUNT),
    goldRushApiKey: normalizeCredential(env.GOLDRUSH_API_KEY),
    goldRushScoreWallet: normalizeWallet(env.GOLDRUSH_SCORE_WALLET) ?? DEFAULT_SCORE_WALLET,
    lpAgentApiKey: normalizeCredential(env.LP_AGENT_API_KEY),
    lpAgentApiBaseUrl: normalizeUrl(env.LP_AGENT_API_BASE_URL) ?? DEFAULT_LP_AGENT_API_BASE_URL,
    lpAgentPoolId: normalizeCredential(env.LP_AGENT_POOL_ID),
    lpAgentOwnerAddress: normalizeWallet(env.LP_AGENT_OWNER_ADDRESS),
    lpAgentZapInPoolId: normalizeCredential(env.LP_AGENT_ZAP_IN_POOL_ID),
    lpAgentZapInWalletAddress: normalizeWallet(env.LP_AGENT_ZAP_IN_WALLET_ADDRESS),
    lpAgentZapInInputSol: normalizePositiveNumber(env.LP_AGENT_ZAP_IN_INPUT_SOL, "LP_AGENT_ZAP_IN_INPUT_SOL"),
    lpAgentZapInPercentX: normalizeOptionalPercentage(env.LP_AGENT_ZAP_IN_PERCENT_X, "LP_AGENT_ZAP_IN_PERCENT_X"),
    lpAgentZapInSlippageBps:
      normalizeInteger(env.LP_AGENT_ZAP_IN_SLIPPAGE_BPS, "LP_AGENT_ZAP_IN_SLIPPAGE_BPS") ??
      DEFAULT_LP_AGENT_ZAP_IN_SLIPPAGE_BPS,
    requireLivePartners: env.ARCPAY_REQUIRE_LIVE_PARTNERS === "true",
    requireLiveDFlow: env.ARCPAY_REQUIRE_LIVE_DFLOW === "true",
    requireLiveLpAgent: env.ARCPAY_REQUIRE_LIVE_LP_AGENT === "true",
  };
}

/**
 * Runs live read-only checks against partner APIs without submitting
 * transactions or settlement requests.
 */
export async function runPartnerSmoke(
  env: PartnerSmokeEnvironment = loadPartnerSmokeEnvironment(),
  fetchImpl: typeof fetch = fetch,
): Promise<PartnerSmokeResult> {
  const checks = await Promise.all([
    smokeBirdeye(env, fetchImpl),
    smokeGoldRush(env, fetchImpl),
    smokeDFlow(env, fetchImpl),
    smokeLpAgent(env, fetchImpl),
  ]);

  return {
    checks,
    passed: checks.every((check) => check.status !== "failed"),
  };
}

async function smokeLpAgent(
  env: PartnerSmokeEnvironment,
  fetchImpl: typeof fetch,
): Promise<PartnerSmokeCheck> {
  if (!env.lpAgentApiKey) {
    return missingCredentialCheck("LP Agent", "LP_AGENT_API_KEY", env.requireLiveLpAgent);
  }

  const hasZapInConfig =
    env.lpAgentZapInPoolId &&
    env.lpAgentZapInWalletAddress &&
    env.lpAgentZapInInputSol;

  if (!hasZapInConfig && !env.lpAgentPoolId && !env.lpAgentOwnerAddress) {
    return {
      provider: "LP Agent",
      status: env.requireLiveLpAgent ? "failed" : "skipped",
      message:
        "LP_AGENT_ZAP_IN_* values are required for track completion; LP_AGENT_POOL_ID or LP_AGENT_OWNER_ADDRESS can be used for read-only proof.",
    };
  }

  try {
    const client = createLpAgentRestClient({
      apiKey: env.lpAgentApiKey,
      baseUrl: env.lpAgentApiBaseUrl,
      fetchImpl,
    });

    if (hasZapInConfig) {
      const zap = await client.generateZapInTransaction({
        poolId: env.lpAgentZapInPoolId!,
        ownerAddress: env.lpAgentZapInWalletAddress!,
        inputSol: env.lpAgentZapInInputSol!,
        percentX: env.lpAgentZapInPercentX,
        slippageBps: env.lpAgentZapInSlippageBps,
      });
      return {
        provider: "LP Agent",
        status: "passed",
        message: `Validated LP Agent Zap-In transaction generation for ${zap.poolId} with ${zap.transactionCount} unsigned transactions.`,
      };
    }

    if (env.lpAgentPoolId) {
      const pool = await client.getPoolInfo({ poolId: env.lpAgentPoolId });
      return {
        provider: "LP Agent",
        status: "passed",
        message: `Validated Meteora pool info for ${pool.poolId}; Zap-In or Zap-Out is still required for LP Agent track completion.`,
      };
    }

    const positions = await client.getPositions({
      ownerAddress: env.lpAgentOwnerAddress!,
    });

    return {
      provider: "LP Agent",
      status: "passed",
      message: `Validated LP Agent positions access with ${positions.positionCount} positions; Zap-In or Zap-Out is still required for LP Agent track completion.`,
    };
  } catch (error) {
    return {
      provider: "LP Agent",
      status: "failed",
      message: safeErrorMessage(error),
    };
  }
}

async function smokeDFlow(
  env: PartnerSmokeEnvironment,
  fetchImpl: typeof fetch,
): Promise<PartnerSmokeCheck> {
  if (!env.requireLiveDFlow && !env.dflowApiKey) {
    return missingCredentialCheck("DFlow", "DFLOW_API_KEY", false);
  }

  try {
    const dflow = createDFlowRestClient({
      apiKey: env.dflowApiKey,
      baseUrl: env.dflowApiBaseUrl,
      fetchImpl,
    });
    const order = await dflow.getOrder({
      inputMint: env.dflowInputMintAddress,
      outputMint: env.dflowOutputMintAddress,
      amount: env.dflowQuoteAmount,
      slippageBps: 50,
      includeAddressLookupTables: false,
    });

    return {
      provider: "DFlow",
      status: "passed",
      message: `Validated DFlow order quote ${order.inAmount} -> ${order.outAmount} at slot ${order.contextSlot}.`,
    };
  } catch (error) {
    return {
      provider: "DFlow",
      status: "failed",
      message: safeErrorMessage(error),
    };
  }
}

async function smokeBirdeye(
  env: PartnerSmokeEnvironment,
  fetchImpl: typeof fetch,
): Promise<PartnerSmokeCheck> {
  if (!env.birdeyeApiKey) {
    return missingCredentialCheck("Birdeye", "BIRDEYE_API_KEY", env.requireLivePartners);
  }

  try {
    const quote = await getOptimalRate({
      fromMint: env.birdeyePriceMintAddress,
      toMint: env.usdcMintAddress,
      apiKey: env.birdeyeApiKey,
      fetchImpl,
    });

    return {
      provider: "Birdeye",
      status: "passed",
      message: `Validated token price ${quote.price} updated at ${quote.updateTime}.`,
    };
  } catch (error) {
    return {
      provider: "Birdeye",
      status: "failed",
      message: safeErrorMessage(error),
    };
  }
}

async function smokeGoldRush(
  env: PartnerSmokeEnvironment,
  fetchImpl: typeof fetch,
): Promise<PartnerSmokeCheck> {
  if (!env.goldRushApiKey) {
    return missingCredentialCheck("GoldRush", "GOLDRUSH_API_KEY", env.requireLivePartners);
  }

  try {
    const client = createGoldRushRestClient({
      apiKey: env.goldRushApiKey,
      fetchImpl,
    });
    const balances = await client.BalanceService.getTokenBalancesForWalletAddress(
      "solana-mainnet",
      env.goldRushScoreWallet,
    );
    const balanceCount = balances.data?.items?.length ?? 0;

    return {
      provider: "GoldRush",
      status: "passed",
      message: `Validated Solana balances access with ${balanceCount} balance items.`,
    };
  } catch (error) {
    return {
      provider: "GoldRush",
      status: "failed",
      message: safeErrorMessage(error),
    };
  }
}

function missingCredentialCheck(
  provider: PartnerSmokeCheck["provider"],
  key: string,
  requireLivePartners: boolean,
): PartnerSmokeCheck {
  return {
    provider,
    status: requireLivePartners ? "failed" : "skipped",
    message: `${key} is not set.`,
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
  const trimmed = value?.trim();
  if (!trimmed || PLACEHOLDER_VALUES.has(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function normalizeUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || PLACEHOLDER_VALUES.has(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function normalizeBigIntAmount(value: string | undefined, key: string): bigint | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!/^[1-9]\d*$/.test(trimmed)) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${key} must be a positive integer string.`);
  }

  return BigInt(trimmed);
}

function normalizePositiveNumber(
  value: string | undefined,
  key: string,
): number | undefined {
  const trimmed = normalizeCredential(value);
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${key} must be a positive number.`);
  }

  return parsed;
}

function normalizeInteger(value: string | undefined, key: string): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${key} must be an integer string.`);
  }

  return Number(trimmed);
}

function normalizeOptionalPercentage(value: string | undefined, key: string): number | undefined {
  const trimmed = normalizeCredential(value);
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${key} must be a number from 0 to 1.`);
  }

  return parsed;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof ArcPaySdkError) {
    const cause = getNestedErrorMessage(error.cause);
    return cause ? `${error.code}: ${error.message} Cause: ${cause}` : `${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown partner smoke failure.";
}

function getNestedErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  return undefined;
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  const result = await runPartnerSmoke();

  for (const check of result.checks) {
    console.log(`${check.status.toUpperCase()} ${check.provider}: ${check.message}`);
  }

  if (!result.passed) {
    process.exitCode = 1;
  }
}
