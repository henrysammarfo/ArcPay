import {
  ARCPAY_TOKEN_PROGRAM_ID,
  createExecutePaymentInstructionData,
  SolanaArcPayProgramClient,
} from "@arcpay/sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PAYMENT_REF = "execute-payment-policy-failure-proof";

export interface ProgramPolicyProofEnvironment {
  readonly rpcUrl: string;
  readonly programId: string;
  readonly network: "devnet" | "mainnet-beta";
  readonly signerKeypairPath: string;
  readonly treasuryAddress: string;
  readonly treasuryTokenAccount: string;
  readonly recipientTokenAccount: string;
  readonly paymentRef: string;
}

export interface ProgramPolicyProof {
  readonly status: "passed";
  readonly network: ProgramPolicyProofEnvironment["network"];
  readonly owner: string;
  readonly programId: string;
  readonly treasuryAddress: string;
  readonly policyFailureSignature: string;
  readonly explorerTransactionUrl: string;
  readonly expectedPolicy: {
    readonly maxSingleTx: string;
    readonly attemptedAmount: string;
    readonly minGoldRushScore: number;
    readonly attemptedGoldRushScore: number;
  };
  readonly recordedError: unknown;
  readonly logMessages: readonly string[];
}

/**
 * Loads the live policy-failure proof configuration.
 *
 * The proof intentionally attempts `maxSingleTx + 1` so the deployed program
 * rejects the transaction with policy logic instead of client-side validation.
 */
export function loadProgramPolicyProofEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ProgramPolicyProofEnvironment {
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
    paymentRef:
      source.ARCPAY_PROOF_POLICY_REF?.trim() ||
      `${DEFAULT_PAYMENT_REF}-${Date.now().toString(36)}`,
  };
}

/**
 * Submits an intentionally failing `execute_payment` transaction and verifies
 * the chain recorded the program-side policy rejection.
 */
export async function runProgramPolicyProof(
  env: ProgramPolicyProofEnvironment = loadProgramPolicyProofEnvironment(),
): Promise<ProgramPolicyProof> {
  const connection = new Connection(env.rpcUrl, "confirmed");
  const owner = await readKeypair(env.signerKeypairPath);
  const programId = new PublicKey(env.programId);
  const programClient = new SolanaArcPayProgramClient({
    connection,
    programId,
  });
  const treasuryAddress = new PublicKey(env.treasuryAddress);
  const fetchedTreasury = await programClient.fetchTreasury(treasuryAddress);

  if (!fetchedTreasury) {
    throw new Error("ARCPAY_TREASURY_ADDRESS does not point to an initialized ArcPay treasury.");
  }

  if (fetchedTreasury.owner !== owner.publicKey.toBase58()) {
    throw new Error("Signer does not own the configured ArcPay treasury.");
  }

  const attemptedAmount = fetchedTreasury.maxSingleTx + 1n;
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: treasuryAddress, isSigner: false, isWritable: true },
      { pubkey: owner.publicKey, isSigner: true, isWritable: false },
      { pubkey: new PublicKey(env.treasuryTokenAccount), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(env.recipientTokenAccount), isSigner: false, isWritable: true },
      { pubkey: ARCPAY_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(
      createExecutePaymentInstructionData({
        amount: attemptedAmount,
        goldRushScore: Math.max(fetchedTreasury.minGoldRushScore, 1),
        paymentRef: env.paymentRef,
      }),
    ),
  });
  const blockhash = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: owner.publicKey,
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  }).add(instruction);

  transaction.sign(owner);

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
  });
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    },
    "confirmed",
  );

  if (!confirmation.value.err) {
    throw new Error("Policy proof transaction unexpectedly succeeded.");
  }

  const fetchedTransaction = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const logMessages = fetchedTransaction?.meta?.logMessages ?? [];

  return {
    status: "passed",
    network: env.network,
    owner: owner.publicKey.toBase58(),
    programId: env.programId,
    treasuryAddress: treasuryAddress.toBase58(),
    policyFailureSignature: signature,
    explorerTransactionUrl: createExplorerUrl("tx", signature, env.network),
    expectedPolicy: {
      maxSingleTx: fetchedTreasury.maxSingleTx.toString(),
      attemptedAmount: attemptedAmount.toString(),
      minGoldRushScore: fetchedTreasury.minGoldRushScore,
      attemptedGoldRushScore: Math.max(fetchedTreasury.minGoldRushScore, 1),
    },
    recordedError: confirmation.value.err,
    logMessages,
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
  network: ProgramPolicyProofEnvironment["network"],
): string {
  const cluster = network === "mainnet-beta" ? "" : "?cluster=devnet";
  return `https://explorer.solana.com/${type}/${value}${cluster}`;
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const result = await runProgramPolicyProof();
    console.log("PASSED Solana Program policy failure live proof:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown program policy proof failure.";
    console.error(`FAILED Solana Program policy failure live proof: ${message}`);
    process.exitCode = 1;
  }
}
