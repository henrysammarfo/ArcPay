import { ArcPaySdkError, createDFlowRestClient, type DFlowOrder, type DFlowRestClient } from "@arcpay/sdk";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_DFLOW_API_BASE_URL = "https://dev-quote-api.dflow.net";
const DEFAULT_DFLOW_INPUT_MINT = "So11111111111111111111111111111111111111112";
const DEFAULT_DFLOW_OUTPUT_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEFAULT_DFLOW_QUOTE_AMOUNT = "1000000";
const DEFAULT_DFLOW_SLIPPAGE_BPS = 50;

export interface DFlowOrderProofEnvironment {
  readonly rpcUrl: string;
  readonly network: "devnet" | "mainnet-beta";
  readonly signerKeypairPath: string;
  readonly dflowApiBaseUrl: string;
  readonly dflowApiKey?: string;
  readonly inputMintAddress: string;
  readonly outputMintAddress: string;
  readonly quoteAmount: bigint;
  readonly slippageBps: number;
  readonly submit: boolean;
}

export interface DFlowOrderProof {
  readonly status: "ready" | "submitted" | "insufficient_funds" | "route_rejected";
  readonly source: "dflow-order";
  readonly liveProof: true;
  readonly owner: string;
  readonly network: DFlowOrderProofEnvironment["network"];
  readonly dflowApiBaseUrl: string;
  readonly inputMint: string;
  readonly outputMint: string;
  readonly inAmount: string;
  readonly outAmount: string;
  readonly contextSlot: number;
  readonly lastValidBlockHeight?: number;
  readonly signedTransactionBytes: number;
  readonly transactionSignature?: string;
  readonly explorerTransactionUrl?: string;
  readonly submitError?: string;
}

export interface DFlowOrderProofDependencies {
  readonly dflow?: Pick<DFlowRestClient, "getOrder">;
  readonly connection?: Pick<Connection, "sendRawTransaction" | "confirmTransaction">;
}

/**
 * Loads DFlow order proof configuration.
 *
 * The signer keypair is read only from the local filesystem and is never
 * printed. Submission is opt-in via `ARCPAY_DFLOW_SUBMIT=true`.
 */
export function loadDFlowOrderProofEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): DFlowOrderProofEnvironment {
  const loadedSource = loadEnvFile(source);
  return {
    rpcUrl: requireEnv(loadedSource, "QUICKNODE_RPC_URL"),
    network: loadedSource.SOLANA_NETWORK === "devnet" ? "devnet" : "mainnet-beta",
    signerKeypairPath: expandHome(
      loadedSource.ARCPAY_SIGNER_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json",
    ),
    dflowApiBaseUrl: loadedSource.DFLOW_API_BASE_URL?.trim() || DEFAULT_DFLOW_API_BASE_URL,
    dflowApiKey: normalizeOptional(loadedSource.DFLOW_API_KEY),
    inputMintAddress: loadedSource.DFLOW_INPUT_MINT_ADDRESS?.trim() || DEFAULT_DFLOW_INPUT_MINT,
    outputMintAddress: loadedSource.DFLOW_OUTPUT_MINT_ADDRESS?.trim() || DEFAULT_DFLOW_OUTPUT_MINT,
    quoteAmount: readPositiveBigInt(loadedSource.DFLOW_QUOTE_AMOUNT, DEFAULT_DFLOW_QUOTE_AMOUNT),
    slippageBps: readNonNegativeInteger(loadedSource.DFLOW_SLIPPAGE_BPS, DEFAULT_DFLOW_SLIPPAGE_BPS),
    submit: loadedSource.ARCPAY_DFLOW_SUBMIT === "true",
  };
}

/**
 * Fetches a signable DFlow order transaction, signs it locally, and optionally
 * submits it to Solana. Signed transaction bytes are never logged.
 */
export async function runDFlowOrderProof(
  env: DFlowOrderProofEnvironment = loadDFlowOrderProofEnvironment(),
  deps: DFlowOrderProofDependencies = {},
): Promise<DFlowOrderProof> {
  const owner = await readKeypair(env.signerKeypairPath);
  const dflow = deps.dflow ?? createDFlowRestClient({
    apiKey: env.dflowApiKey,
    baseUrl: env.dflowApiBaseUrl,
  });
  const order = await dflow.getOrder({
    inputMint: env.inputMintAddress,
    outputMint: env.outputMintAddress,
    amount: env.quoteAmount,
    slippageBps: env.slippageBps,
    userPublicKey: owner.publicKey.toBase58(),
    includeAddressLookupTables: false,
  });

  const transaction = signDFlowOrderTransaction(order, owner);
  const signedTransaction = transaction.serialize();
  const baseResult: Omit<DFlowOrderProof, "status" | "transactionSignature" | "explorerTransactionUrl"> = {
    source: "dflow-order",
    liveProof: true,
    owner: owner.publicKey.toBase58(),
    network: env.network,
    dflowApiBaseUrl: env.dflowApiBaseUrl,
    inputMint: order.inputMint,
    outputMint: order.outputMint,
    inAmount: order.inAmount,
    outAmount: order.outAmount,
    contextSlot: order.contextSlot,
    lastValidBlockHeight: order.lastValidBlockHeight,
    signedTransactionBytes: signedTransaction.length,
  };

  if (!env.submit) {
    return {
      ...baseResult,
      status: "ready",
    };
  }

  const connection = deps.connection ?? new Connection(env.rpcUrl, "confirmed");
  try {
    const transactionSignature = await connection.sendRawTransaction(signedTransaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    if (order.lastValidBlockHeight !== undefined) {
      await connection.confirmTransaction(
        {
          signature: transactionSignature,
          blockhash: transaction.message.recentBlockhash,
          lastValidBlockHeight: order.lastValidBlockHeight,
        },
        "confirmed",
      );
    } else {
      await connection.confirmTransaction(transactionSignature, "confirmed");
    }

    return {
      ...baseResult,
      status: "submitted",
      transactionSignature,
      explorerTransactionUrl: createExplorerUrl(transactionSignature, env.network),
    };
  } catch (error) {
    const message = safeSubmitError(error);
    return {
      ...baseResult,
      status: classifyDFlowSubmitError(message),
      submitError: message,
    };
  }
}

function signDFlowOrderTransaction(order: DFlowOrder, owner: Keypair): VersionedTransaction {
  if (!order.transaction) {
    throw new Error("DFlow order did not include a signable transaction. Ensure userPublicKey is provided.");
  }

  const transactionBytes = Buffer.from(order.transaction, "base64");
  const transaction = VersionedTransaction.deserialize(transactionBytes);
  transaction.sign([owner]);
  return transaction;
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

function readPositiveBigInt(value: string | undefined, fallback: string): bigint {
  const normalized = value?.trim() || fallback;
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error("DFLOW_QUOTE_AMOUNT must be a positive integer string.");
  }

  return BigInt(normalized);
}

function readNonNegativeInteger(value: string | undefined, fallback: number): number {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error("DFLOW_SLIPPAGE_BPS must be a non-negative integer string.");
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

function createExplorerUrl(
  signature: string,
  network: DFlowOrderProofEnvironment["network"],
): string {
  const cluster = network === "mainnet-beta" ? "" : "?cluster=devnet";
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

function safeSubmitError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 800);
}

function classifyDFlowSubmitError(message: string): DFlowOrderProof["status"] {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("insufficient funds") ||
    normalized.includes("insufficient lamports") ||
    normalized.includes("attempt to debit") ||
    normalized.includes("custom program error: 0x1")
  ) {
    return "insufficient_funds";
  }

  return "route_rejected";
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const result = await runDFlowOrderProof();
    console.log(`PASSED DFlow order ${result.status} proof:`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = formatProofError(error);
    console.error(`FAILED DFlow order proof: ${message}`);
    process.exitCode = 1;
  }
}

function formatProofError(error: unknown): string {
  if (error instanceof ArcPaySdkError) {
    const cause = error.cause instanceof Error ? ` Cause: ${error.cause.message}` : "";
    return `${error.code}: ${error.message}${cause}`;
  }

  return error instanceof Error ? error.message : "Unknown DFlow order proof failure.";
}
