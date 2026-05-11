import {
  ArcPaySdkError,
  createGoldRushRestClient,
  scoreCounterparty,
  type CounterpartyRecommendation,
} from "@arcpay/sdk";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_SCORE_WALLET = "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz";
const DEFAULT_MIN_SCORE = 70;

export interface GoldRushProofEnvironment {
  readonly apiKey: string;
  readonly walletAddress: string;
  readonly minScore: number;
}

export interface GoldRushProof {
  readonly status: "passed";
  readonly walletAddress: string;
  readonly score: number;
  readonly txCount: number;
  readonly recommendation: CounterpartyRecommendation;
  readonly minScore: number;
  readonly policyDecision: "APPROVE" | "BLOCK";
}

export interface GoldRushProofDependencies {
  readonly fetchImpl?: typeof fetch;
}

export function loadGoldRushProofEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): GoldRushProofEnvironment {
  const env = loadEnvFile(source);
  return {
    apiKey: readRequiredSecret(env.GOLDRUSH_API_KEY, "GOLDRUSH_API_KEY"),
    walletAddress: readWallet(env.GOLDRUSH_SCORE_WALLET, DEFAULT_SCORE_WALLET),
    minScore: readScore(env.GOLDRUSH_MIN_SCORE, DEFAULT_MIN_SCORE, "GOLDRUSH_MIN_SCORE"),
  };
}

/**
 * Runs the GoldRush track proof as an ArcPay policy decision.
 *
 * This calls GoldRush Solana transaction history plus balance endpoints through
 * the SDK adapter, then applies ArcPay's counterparty-risk threshold.
 */
export async function runGoldRushProof(
  env: GoldRushProofEnvironment = loadGoldRushProofEnvironment(),
  deps: GoldRushProofDependencies = {},
): Promise<GoldRushProof> {
  const client = createGoldRushRestClient({
    apiKey: env.apiKey,
    fetchImpl: deps.fetchImpl ?? fetch,
  });
  const score = await scoreCounterparty(client, env.walletAddress);

  return {
    status: "passed",
    walletAddress: score.wallet,
    score: score.score,
    txCount: score.txCount,
    recommendation: score.recommendation,
    minScore: env.minScore,
    policyDecision: score.score >= env.minScore ? "APPROVE" : "BLOCK",
  };
}

function readRequiredSecret(value: string | undefined, key: string): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.startsWith("your_") || trimmed.includes("xxxxxxxx")) {
    throw new Error(`${key} must be set to a real value.`);
  }

  return trimmed;
}

function readWallet(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "wallet_to_score") {
    return fallback;
  }

  return trimmed;
}

function readScore(value: string | undefined, fallback: number, key: string): number {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${key} must be an integer from 0 to 100.`);
  }

  const score = Number(trimmed);
  if (score < 0 || score > 100) {
    throw new Error(`${key} must be an integer from 0 to 100.`);
  }

  return score;
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const proof = await runGoldRushProof();
    console.log("PASSED GoldRush risk proof:");
    console.log(`  Wallet: ${proof.walletAddress}`);
    console.log(`  Score: ${proof.score}`);
    console.log(`  Transactions sampled: ${proof.txCount}`);
    console.log(`  GoldRush recommendation: ${proof.recommendation}`);
    console.log(`  ArcPay minimum score: ${proof.minScore}`);
    console.log(`  ArcPay policy decision: ${proof.policyDecision}`);
  } catch (error) {
    const message = safeErrorMessage(error);
    console.error(`FAILED GoldRush risk proof: ${message}`);
    process.exitCode = 1;
  }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof ArcPaySdkError) {
    const cause = error.cause instanceof Error ? ` Cause: ${error.cause.message}` : "";
    return `${error.code}: ${error.message}${cause}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown GoldRush proof failure.";
}
