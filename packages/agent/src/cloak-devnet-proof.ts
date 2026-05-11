import {
  ArcPaySdkError,
  runCloakDevnetSolDepositProof,
  type CloakDevnetDepositProofResult,
} from "@arcpay/sdk";
import { Connection, Keypair } from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_CLOAK_RELAY_URL = "https://api.devnet.cloak.ag";
const DEFAULT_CLOAK_DEPOSIT_LAMPORTS = "10000000";
const DEFAULT_CLOAK_PROOF_TIMEOUT_MS = 900_000;

export interface CloakDevnetProofEnvironment {
  readonly rpcUrl: string;
  readonly signerKeypairPath: string;
  readonly relayUrl: string;
  readonly depositLamports: bigint;
  readonly sdkPath?: string;
  readonly timeoutMs: number;
  readonly skipBalancePreflight: boolean;
  readonly verboseProgress: boolean;
}

export type CloakDevnetProof =
  | ({
      readonly status: "submitted";
      readonly source: "cloak-devnet";
      readonly liveProof: true;
    } & CloakDevnetDepositProofResult)
  | {
      readonly status: "needs_funds";
      readonly source: "cloak-devnet";
      readonly liveProof: false;
      readonly signer: string;
      readonly network: "devnet";
      readonly relayUrl: string;
      readonly amountLamports: string;
      readonly message: string;
    };

export function loadCloakDevnetProofEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): CloakDevnetProofEnvironment {
  const loadedSource = loadEnvFile(source);
  return {
    rpcUrl: requireEnv(loadedSource, "QUICKNODE_RPC_URL"),
    signerKeypairPath: expandHome(
      loadedSource.ARCPAY_SIGNER_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json",
    ),
    relayUrl: loadedSource.CLOAK_RELAY_URL?.trim() || DEFAULT_CLOAK_RELAY_URL,
    depositLamports: readPositiveBigInt(
      loadedSource.CLOAK_DEPOSIT_LAMPORTS,
      DEFAULT_CLOAK_DEPOSIT_LAMPORTS,
      "CLOAK_DEPOSIT_LAMPORTS",
    ),
    sdkPath: normalizeOptional(loadedSource.CLOAK_SDK_PATH),
    timeoutMs: readPositiveInteger(
      loadedSource.CLOAK_PROOF_TIMEOUT_MS,
      DEFAULT_CLOAK_PROOF_TIMEOUT_MS,
      "CLOAK_PROOF_TIMEOUT_MS",
    ),
    skipBalancePreflight: loadedSource.CLOAK_SKIP_BALANCE_PREFLIGHT === "true",
    verboseProgress: loadedSource.CLOAK_VERBOSE_PROGRESS !== "false",
  };
}

export async function runCloakDevnetProof(
  env: CloakDevnetProofEnvironment = loadCloakDevnetProofEnvironment(),
): Promise<CloakDevnetProof> {
  const signer = await readKeypair(env.signerKeypairPath);
  const connection = new Connection(env.rpcUrl, "confirmed");

  try {
    const result = await withTimeout(
      runCloakDevnetSolDepositProof({
        connection,
        signer,
        amountLamports: env.depositLamports,
        relayUrl: env.relayUrl,
        sdkPath: env.sdkPath,
        skipBalancePreflight: env.skipBalancePreflight,
        onProgress: env.verboseProgress
          ? (status: string) => console.error(`[cloak] ${status}`)
          : undefined,
        onProofProgress: env.verboseProgress
          ? (percent: number) => console.error(`[cloak] proof ${percent}%`)
          : undefined,
      }),
      env.timeoutMs,
    );

    return {
      status: "submitted",
      source: "cloak-devnet",
      liveProof: true,
      ...result,
    };
  } catch (error) {
    if (isInsufficientFundsError(error)) {
      return {
        status: "needs_funds",
        source: "cloak-devnet",
        liveProof: false,
        signer: signer.publicKey.toBase58(),
        network: "devnet",
        relayUrl: env.relayUrl,
        amountLamports: env.depositLamports.toString(),
        message: error instanceof Error ? error.message : "Cloak devnet proof needs faucet funding.",
      };
    }

    throw error;
  }
}

async function readKeypair(path: string): Promise<Keypair> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;

  if (!Array.isArray(parsed) || !parsed.every((value) => Number.isInteger(value))) {
    throw new Error(`Solana keypair file ${path} must contain a byte array.`);
  }

  return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
}

function requireEnv(source: NodeJS.ProcessEnv, key: string): string {
  const value = source[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readPositiveBigInt(value: string | undefined, fallback: string, fieldName: string): bigint {
  const normalized = value?.trim() || fallback;
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${fieldName} must be a positive integer string.`);
  }

  return BigInt(normalized);
}

function readPositiveInteger(value: string | undefined, fallback: number, fieldName: string): number {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${fieldName} must be a positive integer string.`);
  }

  return Number(normalized);
}

function expandHome(path: string): string {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return resolve(homedir(), path.slice(2));
  }

  return resolve(path);
}

function isInsufficientFundsError(error: unknown): boolean {
  if (error instanceof ArcPaySdkError && error.code === "VALIDATION_ERROR") {
    return /insufficient|balance|fund/i.test(error.message);
  }

  if (error instanceof Error) {
    return /insufficient|balance|fund/i.test(error.message);
  }

  return false;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Cloak devnet proof timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const result = await runCloakDevnetProof();
    const verb = result.status === "submitted" ? "PASSED" : "NEEDS_FUNDS";
    console.log(`${verb} Cloak devnet proof:`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = formatErrorChain(error);
    console.error(`FAILED Cloak devnet proof: ${message}`);
    process.exitCode = 1;
  }
}

function formatErrorChain(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown Cloak devnet proof failure.";
  }

  const causes: string[] = [];
  let current: unknown = error;

  while (current instanceof Error) {
    causes.push(current.message);
    current = (current as Error & { readonly cause?: unknown }).cause;
  }

  if (typeof current === "string" && current.trim().length > 0) {
    causes.push(current.trim());
  }

  return causes.join(" Cause: ");
}
