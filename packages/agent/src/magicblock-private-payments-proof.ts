import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_MAGICBLOCK_PRIVATE_PAYMENTS_API = "https://payments.magicblock.app";
const DEFAULT_CLUSTER = "devnet";
const DEFAULT_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const DEFAULT_DEPOSIT_AMOUNT = "1000000";

export interface MagicBlockPrivatePaymentsEnvironment {
  readonly apiBaseUrl: string;
  readonly cluster: string;
  readonly ownerAddress: string;
  readonly mintAddress: string;
  readonly amount: string;
  readonly buildDeposit: boolean;
  readonly submitDeposit: boolean;
  readonly rpcUrl: string;
  readonly signerKeypairPath: string;
}

export interface MagicBlockPrivatePaymentsProof {
  readonly status: "passed";
  readonly apiBaseUrl: string;
  readonly cluster: string;
  readonly health: "ok";
  readonly ownerAddress: string;
  readonly mintAddress: string;
  readonly amount: string;
  readonly depositBuilderReached: boolean;
  readonly depositTransactionBytes?: number;
  readonly depositResponseKeys: readonly string[];
  readonly depositSubmitStatus: "not_requested" | "submitted" | "insufficient_funds";
  readonly depositSubmitError?: string;
  readonly depositSignature?: string;
  readonly explorerTransactionUrl?: string;
}

export interface MagicBlockPrivatePaymentsDependencies {
  readonly fetchImpl?: typeof fetch;
  readonly connection?: Pick<Connection, "sendRawTransaction" | "confirmTransaction">;
}

export function loadMagicBlockPrivatePaymentsEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): MagicBlockPrivatePaymentsEnvironment {
  const env = loadEnvFile(source);
  return {
    apiBaseUrl: trimTrailingSlash(
      env.MAGICBLOCK_PRIVATE_PAYMENTS_API_URL?.trim() || DEFAULT_MAGICBLOCK_PRIVATE_PAYMENTS_API,
    ),
    cluster: env.MAGICBLOCK_CLUSTER?.trim() || DEFAULT_CLUSTER,
    ownerAddress: readRequiredAddress(
      env.MAGICBLOCK_PAYMENT_OWNER_ADDRESS ?? env.AGENT_WALLET_ADDRESS,
      "MAGICBLOCK_PAYMENT_OWNER_ADDRESS or AGENT_WALLET_ADDRESS",
    ),
    mintAddress: readRequiredAddress(
      env.MAGICBLOCK_PAYMENT_MINT_ADDRESS ?? env.USDC_MINT_ADDRESS ?? DEFAULT_MINT,
      "MAGICBLOCK_PAYMENT_MINT_ADDRESS",
    ),
    amount: readPositiveInteger(env.MAGICBLOCK_PAYMENT_AMOUNT ?? DEFAULT_DEPOSIT_AMOUNT, "MAGICBLOCK_PAYMENT_AMOUNT"),
    buildDeposit: env.MAGICBLOCK_BUILD_DEPOSIT !== "false",
    submitDeposit: env.MAGICBLOCK_SUBMIT_DEPOSIT === "true",
    rpcUrl: env.QUICKNODE_RPC_URL?.trim() || "https://api.devnet.solana.com",
    signerKeypairPath: expandHome(
      env.ARCPAY_SIGNER_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json",
    ),
  };
}

/**
 * Proves ArcPay reaches MagicBlock's documented Private Payments API surface.
 *
 * This is deliberately not the same as ArcPay's generic Solana x402 verifier:
 * it calls the sponsor API health endpoint and, by default, asks MagicBlock to
 * build a private SPL deposit transaction for the configured owner/mint/amount.
 * Signing/submission is still a funded-wallet step.
 */
export async function runMagicBlockPrivatePaymentsProof(
  env: MagicBlockPrivatePaymentsEnvironment = loadMagicBlockPrivatePaymentsEnvironment(),
  deps: MagicBlockPrivatePaymentsDependencies = {},
): Promise<MagicBlockPrivatePaymentsProof> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const health = await fetchJson(`${env.apiBaseUrl}/health`, fetchImpl, {
    method: "GET",
  });

  if (!isHealthy(health)) {
    throw new Error("MagicBlock Private Payments health endpoint did not return an ok/healthy response.");
  }

  let depositResponse: unknown = undefined;
  if (env.buildDeposit) {
    depositResponse = await fetchJson(`${env.apiBaseUrl}/v1/spl/deposit`, fetchImpl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        owner: env.ownerAddress,
        mint: env.mintAddress,
        amount: Number(env.amount),
        cluster: env.cluster,
        initIfMissing: true,
        initVaultIfMissing: true,
        initAtasIfMissing: true,
        idempotent: true,
      }),
    });
  }

  const depositTransaction = findTransactionString(depositResponse);
  let depositSignature: string | undefined;
  let depositSubmitStatus: MagicBlockPrivatePaymentsProof["depositSubmitStatus"] = "not_requested";
  let depositSubmitError: string | undefined;

  if (env.submitDeposit) {
    if (!depositTransaction) {
      throw new Error("MagicBlock did not return a deposit transaction to submit.");
    }

    const signer = await readKeypair(env.signerKeypairPath);
    if (signer.publicKey.toBase58() !== env.ownerAddress) {
      throw new Error(
        `MAGICBLOCK_PAYMENT_OWNER_ADDRESS must match ARCPAY_SIGNER_KEYPAIR_PATH for submission. Owner ${env.ownerAddress}, signer ${signer.publicKey.toBase58()}.`,
      );
    }

    const signed = signSerializedTransaction(depositTransaction, signer);
    const connection = deps.connection ?? new Connection(env.rpcUrl, "confirmed");
    try {
      depositSignature = await connection.sendRawTransaction(signed, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      await connection.confirmTransaction(depositSignature, "confirmed");
      depositSubmitStatus = "submitted";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("insufficient funds")) {
        throw error;
      }

      depositSubmitStatus = "insufficient_funds";
      depositSubmitError = message;
    }
  }

  return {
    status: "passed",
    apiBaseUrl: env.apiBaseUrl,
    cluster: env.cluster,
    health: "ok",
    ownerAddress: env.ownerAddress,
    mintAddress: env.mintAddress,
    amount: env.amount,
    depositBuilderReached: env.buildDeposit,
    depositTransactionBytes: depositTransaction ? Buffer.from(depositTransaction, "base64").byteLength : undefined,
    depositResponseKeys: listKeys(depositResponse),
    depositSubmitStatus,
    depositSubmitError,
    depositSignature,
    explorerTransactionUrl: depositSignature
      ? `https://explorer.solana.com/tx/${depositSignature}?cluster=${env.cluster}`
      : undefined,
  };
}

function signSerializedTransaction(transactionBase64: string, signer: Keypair): Buffer {
  const bytes = Buffer.from(transactionBase64, "base64");
  try {
    const transaction = VersionedTransaction.deserialize(bytes);
    transaction.sign([signer]);
    return Buffer.from(transaction.serialize());
  } catch {
    const transaction = Transaction.from(bytes);
    transaction.partialSign(signer);
    return transaction.serialize();
  }
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
  init: RequestInit,
): Promise<unknown> {
  const response = await fetchImpl(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`MagicBlock Private Payments API failed at ${url} with HTTP ${response.status}: ${text.slice(0, 240)}`);
  }

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new Error(`MagicBlock Private Payments API returned non-JSON at ${url}: ${String(cause)}`);
  }
}

function isHealthy(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const status = readString(record.status) ?? readString(record.health) ?? readString(record.ok);
  return status === "ok" || status === "healthy" || status === "true";
}

function findTransactionString(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["transactionBase64", "transaction", "tx", "serializedTransaction", "encodedTransaction"]) {
    const candidate = readString(record[key], { preserveCase: true });
    if (candidate) {
      return candidate;
    }
  }

  const nested = record.data;
  return nested && typeof nested === "object" ? findTransactionString(nested) : undefined;
}

function listKeys(value: unknown): readonly string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.keys(value).sort();
}

function readRequiredAddress(value: string | undefined, key: string): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes("YourSolanaPublicKeyHere") || trimmed.includes("xxxxxxxx")) {
    throw new Error(`${key} must be set to a real Solana address.`);
  }

  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    throw new Error(`${key} must be a valid Solana address.`);
  }
}

function readPositiveInteger(value: string, key: string): string {
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    throw new Error(`${key} must be a positive integer in base units.`);
  }

  return trimmed;
}

function readString(
  value: unknown,
  options: { readonly preserveCase?: boolean } = {},
): string | undefined {
  if (typeof value === "boolean") {
    return String(value);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  return options.preserveCase ? value : value.toLowerCase();
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function readKeypair(path: string): Promise<Keypair> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((value) => Number.isInteger(value))) {
    throw new Error(`Solana keypair file ${path} must contain a byte array.`);
  }

  return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
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

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const proof = await runMagicBlockPrivatePaymentsProof();
    console.log("PASSED MagicBlock Private Payments proof:");
    console.log(`  API: ${proof.apiBaseUrl}`);
    console.log(`  Cluster: ${proof.cluster}`);
    console.log(`  Owner: ${proof.ownerAddress}`);
    console.log(`  Mint: ${proof.mintAddress}`);
    console.log(`  Amount: ${proof.amount}`);
    console.log(`  Health: ${proof.health}`);
    console.log(`  Deposit builder reached: ${proof.depositBuilderReached}`);
    console.log(`  Deposit tx bytes: ${proof.depositTransactionBytes ?? "not returned"}`);
    console.log(`  Deposit response keys: ${proof.depositResponseKeys.join(", ") || "none"}`);
    console.log(`  Deposit submit status: ${proof.depositSubmitStatus}`);
    if (proof.depositSubmitError) {
      console.log(`  Deposit submit error: ${proof.depositSubmitError.slice(0, 240)}`);
    }
    if (proof.depositSignature) {
      console.log(`  Deposit transaction: ${proof.depositSignature}`);
      console.log(`  Explorer: ${proof.explorerTransactionUrl}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MagicBlock Private Payments proof failure.";
    console.error(`FAILED MagicBlock Private Payments proof: ${message}`);
    process.exitCode = 1;
  }
}
