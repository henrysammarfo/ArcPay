import {
  createAssociatedTokenAccountInstruction,
  createMintToCheckedInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_SERVER_URL = "http://localhost:4030";
const DEFAULT_ENDPOINT_PATH = "/agent/research";
const DEFAULT_PAYMENT_AMOUNT = 0.01;

export interface X402PaymentProofEnvironment {
  readonly rpcUrl: string;
  readonly serverUrl: string;
  readonly endpointPath: "/agent/research" | "/agent/analysis" | "/agent/task";
  readonly signerKeypairPath: string;
  readonly mintAddress: string;
  readonly payTo: string;
  readonly paymentAmount: number;
  readonly network: "devnet" | "mainnet-beta";
  readonly devnetMintTest: boolean;
}

export interface X402PaymentProof {
  readonly status: "passed";
  readonly source: "x402-solana-payment";
  readonly liveProof: true;
  readonly payer: string;
  readonly payTo: string;
  readonly mint: string;
  readonly paymentAmount: number;
  readonly paymentSource: "existing-balance" | "devnet-mint-test";
  readonly paymentSignature: string;
  readonly explorerTransactionUrl: string;
  readonly endpointUrl: string;
  readonly endpointResponse: unknown;
}

/**
 * Loads x402 live payment proof configuration.
 *
 * The signer pays transaction fees and acts as devnet mint authority for the
 * ephemeral payer account. Never pass private keys through chat or source files;
 * use a local Solana keypair file.
 */
export function loadX402PaymentProofEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): X402PaymentProofEnvironment {
  const env = loadEnvFile(source);
  return {
    rpcUrl: requireEnv(env, "QUICKNODE_RPC_URL"),
    serverUrl: trimTrailingSlash(env.ARCPAY_X402_SERVER_URL?.trim() || DEFAULT_SERVER_URL),
    endpointPath: readEndpointPath(env.ARCPAY_X402_ENDPOINT_PATH),
    signerKeypairPath: expandHome(
      env.ARCPAY_SIGNER_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json",
    ),
    mintAddress: requireEnv(env, "USDC_MINT_ADDRESS"),
    payTo: requireEnv(env, "AGENT_WALLET_ADDRESS"),
    paymentAmount: readPositiveNumber(env.ARCPAY_X402_PAYMENT_AMOUNT, DEFAULT_PAYMENT_AMOUNT),
    network: env.SOLANA_NETWORK === "devnet" ? "devnet" : "mainnet-beta",
    devnetMintTest: env.ARCPAY_X402_DEVNET_MINT_TEST === "true",
  };
}

/**
 * Sends a real SPL token transfer and proves the running x402 server accepts
 * that signature through the production Solana payment verifier.
 */
export async function runX402PaymentProof(
  env: X402PaymentProofEnvironment = loadX402PaymentProofEnvironment(),
): Promise<X402PaymentProof> {
  const connection = new Connection(env.rpcUrl, "confirmed");
  const signer = await readKeypair(env.signerKeypairPath);
  const mint = new PublicKey(env.mintAddress);
  const payTo = new PublicKey(env.payTo);
  const mintInfo = await getMint(connection, mint);
  const atomicAmount = decimalToAtomic(env.paymentAmount, mintInfo.decimals);
  if (atomicAmount <= 0n) {
    throw new Error("ARCPAY_X402_PAYMENT_AMOUNT is too small for the configured mint decimals.");
  }

  if (env.devnetMintTest && env.network !== "devnet") {
    throw new Error("ARCPAY_X402_DEVNET_MINT_TEST=true is only allowed on SOLANA_NETWORK=devnet.");
  }

  const payer = env.devnetMintTest ? Keypair.generate() : signer;
  const payerTokenAccount = getAssociatedTokenAddressSync(mint, payer.publicKey);
  const recipientTokenAccount = getAssociatedTokenAddressSync(mint, payTo);
  const payment = new Transaction();
  payment.feePayer = signer.publicKey;
  const recipientAccount = await connection.getAccountInfo(recipientTokenAccount, "confirmed");

  if (env.devnetMintTest) {
    payment.add(
      createAssociatedTokenAccountInstruction(
        signer.publicKey,
        payerTokenAccount,
        payer.publicKey,
        mint,
      ),
    );
  } else {
    const payerAccount = await connection.getAccountInfo(payerTokenAccount, "confirmed");
    if (!payerAccount) {
      throw new Error(
        `Payer token account ${payerTokenAccount.toBase58()} does not exist for mint ${mint.toBase58()}. Fund/create this ATA before running a mainnet x402 proof.`,
      );
    }
  }

  if (!recipientAccount) {
    payment.add(
      createAssociatedTokenAccountInstruction(
        signer.publicKey,
        recipientTokenAccount,
        payTo,
        mint,
      ),
    );
  }

  if (env.devnetMintTest) {
    payment.add(
      createMintToCheckedInstruction(
        mint,
        payerTokenAccount,
        signer.publicKey,
        atomicAmount,
        mintInfo.decimals,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  payment.add(
    createTransferCheckedInstruction(
      payerTokenAccount,
      mint,
      recipientTokenAccount,
      payer.publicKey,
      atomicAmount,
      mintInfo.decimals,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );
  const paymentSignature = await sendAndConfirmTransaction(
    connection,
    payment,
    env.devnetMintTest ? [signer, payer] : [signer],
    { commitment: "confirmed" },
  );
  const endpointUrl = `${env.serverUrl}${env.endpointPath}`;
  const unpaidResponse = await fetch(endpointUrl);

  if (unpaidResponse.status !== 402) {
    throw new Error(`Expected unpaid x402 request to return 402, received ${unpaidResponse.status}.`);
  }

  const paidResponse = await fetch(endpointUrl, {
    method: env.endpointPath === "/agent/task" ? "POST" : "GET",
    headers: {
      "x-payment": paymentSignature,
    },
  });
  const endpointResponse = (await paidResponse.json()) as unknown;

  if (!paidResponse.ok) {
    throw new Error(`Expected paid x402 request to succeed, received ${paidResponse.status}.`);
  }

  assertLivePaymentResponse(endpointResponse);

  return {
    status: "passed",
    source: "x402-solana-payment",
    liveProof: true,
    payer: payer.publicKey.toBase58(),
    payTo: payTo.toBase58(),
    mint: mint.toBase58(),
    paymentAmount: env.paymentAmount,
    paymentSource: env.devnetMintTest ? "devnet-mint-test" : "existing-balance",
    paymentSignature,
    explorerTransactionUrl: createExplorerUrl(paymentSignature, env.network),
    endpointUrl,
    endpointResponse,
  };
}

export function assertLivePaymentResponse(value: unknown): void {
  if (
    typeof value !== "object" ||
    value === null ||
    !("liveProof" in value) ||
    value.liveProof !== true ||
    !("paymentProof" in value) ||
    typeof value.paymentProof !== "object" ||
    value.paymentProof === null ||
    !("proofType" in value.paymentProof) ||
    value.paymentProof.proofType !== "solana-verified"
  ) {
    throw new Error("x402 endpoint did not return a live Solana payment proof.");
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

function readEndpointPath(value: string | undefined): X402PaymentProofEnvironment["endpointPath"] {
  const path = value?.trim() || DEFAULT_ENDPOINT_PATH;

  if (path !== "/agent/research" && path !== "/agent/analysis" && path !== "/agent/task") {
    throw new Error("ARCPAY_X402_ENDPOINT_PATH must be /agent/research, /agent/analysis, or /agent/task.");
  }

  return path;
}

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("ARCPAY_X402_PAYMENT_AMOUNT must be greater than zero.");
  }

  return parsed;
}

function decimalToAtomic(amount: number, decimals: number): bigint {
  const fixed = amount.toFixed(decimals);
  const [whole = "0", fraction = ""] = fixed.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);

  return BigInt(`${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "") || "0");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
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

function createExplorerUrl(signature: string, network: X402PaymentProofEnvironment["network"]): string {
  const cluster = network === "devnet" ? "?cluster=devnet" : "";
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const result = await runX402PaymentProof();
    console.log("PASSED x402 Solana payment live proof:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown x402 payment proof failure.";
    console.error(`FAILED x402 Solana payment live proof: ${message}`);
    process.exitCode = 1;
  }
}
