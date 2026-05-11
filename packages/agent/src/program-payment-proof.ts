import { ArcPayTreasury, SolanaArcPayProgramClient } from "@arcpay/sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PAYMENT_AMOUNT = 250;
const DEFAULT_GOLDRUSH_SCORE = 91;

export interface ProgramPaymentProofEnvironment {
  readonly rpcUrl: string;
  readonly programId: string;
  readonly network: "devnet" | "mainnet-beta";
  readonly signerKeypairPath: string;
  readonly treasuryAddress: string;
  readonly treasuryTokenAccount: string;
  readonly recipientTokenAccount: string;
  readonly amount: number;
  readonly goldRushScore: number;
  readonly paymentRef: string;
}

export interface ProgramPaymentProof {
  readonly status: "passed";
  readonly network: ProgramPaymentProofEnvironment["network"];
  readonly owner: string;
  readonly programId: string;
  readonly treasuryAddress: string;
  readonly paymentSignature: string;
  readonly explorerTransactionUrl: string;
  readonly explorerTreasuryUrl: string;
  readonly payment: {
    readonly amount: string;
    readonly goldRushScore: number;
    readonly paymentRef: string;
    readonly treasuryTokenAccount: string;
    readonly recipientTokenAccount: string;
  };
}

/**
 * Loads live execute-payment proof configuration.
 *
 * The token accounts should be devnet SPL token accounts for proof runs. The
 * signer private key is read locally only and is never logged.
 */
export function loadProgramPaymentProofEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ProgramPaymentProofEnvironment {
  return {
    rpcUrl: requireEnv(source, "QUICKNODE_RPC_URL"),
    programId: requireEnv(source, "ARCPAY_PROGRAM_ID"),
    network: source.SOLANA_NETWORK === "mainnet-beta" ? "mainnet-beta" : "devnet",
    signerKeypairPath: expandHome(
      source.ARCPAY_SIGNER_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json",
    ),
    treasuryAddress: requireEnv(source, "ARCPAY_TREASURY_ADDRESS"),
    treasuryTokenAccount: requireEnv(source, "ARCPAY_TREASURY_TOKEN_ACCOUNT"),
    recipientTokenAccount: requireEnv(source, "ARCPAY_RECIPIENT_TOKEN_ACCOUNT"),
    amount: readPositiveInteger(source.ARCPAY_PROOF_PAYMENT_AMOUNT, DEFAULT_PAYMENT_AMOUNT),
    goldRushScore: readScore(source.ARCPAY_PROOF_PAYMENT_GOLDRUSH_SCORE),
    paymentRef:
      source.ARCPAY_PROOF_PAYMENT_REF?.trim() ||
      `execute-payment-live-proof-${Date.now().toString(36)}`,
  };
}

/**
 * Submits a live `execute_payment` transaction against an initialized ArcPay
 * treasury and validates the signer owns that treasury before sending.
 */
export async function runProgramPaymentProof(
  env: ProgramPaymentProofEnvironment = loadProgramPaymentProofEnvironment(),
): Promise<ProgramPaymentProof> {
  const connection = new Connection(env.rpcUrl, "confirmed");
  const owner = await readKeypair(env.signerKeypairPath);
  const programClient = new SolanaArcPayProgramClient({
    connection,
    programId: env.programId,
  });
  const treasuryAddress = new PublicKey(env.treasuryAddress);
  const fetchedTreasury = await programClient.fetchTreasury(treasuryAddress);

  if (!fetchedTreasury) {
    throw new Error("ARCPAY_TREASURY_ADDRESS does not point to an initialized ArcPay treasury.");
  }

  if (fetchedTreasury.owner !== owner.publicKey.toBase58()) {
    throw new Error("Signer does not own the configured ArcPay treasury.");
  }

  const treasury = new ArcPayTreasury({
    rpcUrl: env.rpcUrl,
    programId: env.programId,
    network: env.network,
    connection,
    programClient,
  });
  const result = await treasury.executeOnChainPayment({
    owner,
    treasury: treasuryAddress,
    treasuryTokenAccount: new PublicKey(env.treasuryTokenAccount),
    recipientTokenAccount: new PublicKey(env.recipientTokenAccount),
    amount: env.amount,
    goldRushScore: env.goldRushScore,
    paymentRef: env.paymentRef,
  });

  return {
    status: "passed",
    network: env.network,
    owner: owner.publicKey.toBase58(),
    programId: env.programId,
    treasuryAddress: treasuryAddress.toBase58(),
    paymentSignature: result.signature,
    explorerTransactionUrl: createExplorerUrl("tx", result.signature, env.network),
    explorerTreasuryUrl: createExplorerUrl("address", treasuryAddress.toBase58(), env.network),
    payment: {
      amount: env.amount.toString(),
      goldRushScore: env.goldRushScore,
      paymentRef: env.paymentRef,
      treasuryTokenAccount: env.treasuryTokenAccount,
      recipientTokenAccount: env.recipientTokenAccount,
    },
  };
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

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${value} must be a positive integer.`);
  }

  return parsed;
}

function readScore(value: string | undefined): number {
  const score = readPositiveInteger(value, DEFAULT_GOLDRUSH_SCORE);
  if (score > 100) {
    throw new Error("ARCPAY_PROOF_PAYMENT_GOLDRUSH_SCORE must be between 1 and 100.");
  }

  return score;
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
  type: "tx" | "address",
  value: string,
  network: ProgramPaymentProofEnvironment["network"],
): string {
  const cluster = network === "mainnet-beta" ? "" : "?cluster=devnet";
  return `https://explorer.solana.com/${type}/${value}${cluster}`;
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const result = await runProgramPaymentProof();
    console.log("PASSED Solana Program execute_payment live proof:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown program payment proof failure.";
    console.error(`FAILED Solana Program execute_payment live proof: ${message}`);
    process.exitCode = 1;
  }
}
