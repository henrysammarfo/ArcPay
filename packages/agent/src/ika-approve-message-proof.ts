import { keccak_256 } from "@noble/hashes/sha3";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_IKA_SOLANA_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_IKA_PROGRAM_ID = "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY";
const DEFAULT_MAX_SPEND_USD = 8;
const DEFAULT_POLICY_EXPIRY_SECONDS = 900;
const SEED_DWALLET_COORDINATOR = Buffer.from("dwallet_coordinator");
const SEED_DWALLET = Buffer.from("dwallet");
const SEED_MESSAGE_APPROVAL = Buffer.from("message_approval");
const SIGNATURE_SCHEME_EDDSA_SHA512 = 5;
const IX_APPROVE_MESSAGE = 8;

export interface IkaApproveMessageEnvironment {
  readonly rpcUrl: string;
  readonly programId: string;
  readonly signerKeypairPath: string;
  readonly dWalletAddress: string;
  readonly requestedSpendUsd: number;
  readonly maxSpendUsd: number;
  readonly policyExpirySeconds: number;
  readonly submit: boolean;
}

export interface IkaApproveMessageProof {
  readonly status: "ready" | "submitted";
  readonly programId: string;
  readonly dWalletAddress: string;
  readonly signer: string;
  readonly message: string;
  readonly messageHashHex: string;
  readonly messageApprovalAddress: string;
  readonly requestedSpendUsd: number;
  readonly maxSpendUsd: number;
  readonly transactionSize: number;
  readonly transactionSignature?: string;
  readonly explorerTransactionUrl?: string;
}

export interface IkaApproveMessageDependencies {
  readonly connection?: Pick<
    Connection,
    "getAccountInfo" | "getLatestBlockhash" | "sendRawTransaction" | "confirmTransaction"
  >;
  readonly now?: () => number;
}

export function loadIkaApproveMessageEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): IkaApproveMessageEnvironment {
  const env = loadEnvFile(source);
  return {
    rpcUrl: env.IKA_SOLANA_RPC_URL?.trim() || DEFAULT_IKA_SOLANA_RPC_URL,
    programId: env.IKA_PROGRAM_ID?.trim() || DEFAULT_IKA_PROGRAM_ID,
    signerKeypairPath: expandHome(
      env.ARCPAY_SIGNER_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json",
    ),
    dWalletAddress: requireEnv(env, "IKA_DWALLET_ADDRESS"),
    requestedSpendUsd: readPositiveNumber(env.IKA_APPROVE_SPEND_USD, DEFAULT_MAX_SPEND_USD),
    maxSpendUsd: readPositiveNumber(env.IKA_APPROVE_MAX_SPEND_USD, DEFAULT_MAX_SPEND_USD),
    policyExpirySeconds: readPositiveInteger(
      env.IKA_APPROVE_EXPIRY_SECONDS,
      DEFAULT_POLICY_EXPIRY_SECONDS,
    ),
    submit: env.IKA_APPROVE_SUBMIT === "true",
  };
}

/**
 * Builds, signs, and optionally submits the official Ika ApproveMessage
 * instruction for an existing dWallet.
 *
 * This is the ArcPay-relevant path: the treasury policy approves the message
 * before the dWallet network is allowed to sign. It requires a real
 * IKA_DWALLET_ADDRESS and refuses to run against missing/non-Ika accounts.
 */
export async function runIkaApproveMessageProof(
  env: IkaApproveMessageEnvironment = loadIkaApproveMessageEnvironment(),
  deps: IkaApproveMessageDependencies = {},
): Promise<IkaApproveMessageProof> {
  if (env.requestedSpendUsd > env.maxSpendUsd) {
    throw new Error(
      `ArcPay policy rejected Ika approval: requested ${env.requestedSpendUsd} exceeds max ${env.maxSpendUsd}.`,
    );
  }

  const now = deps.now?.() ?? Date.now();
  const expiresAt = new Date(now + env.policyExpirySeconds * 1000).toISOString();
  const programId = new PublicKey(env.programId);
  const dWalletAddress = new PublicKey(env.dWalletAddress);
  const signer = await readKeypair(env.signerKeypairPath);
  const connection = deps.connection ?? new Connection(env.rpcUrl, "confirmed");
  const dWalletAccount = await connection.getAccountInfo(dWalletAddress, "confirmed");

  if (!dWalletAccount) {
    throw new Error(`IKA_DWALLET_ADDRESS was not found on-chain: ${dWalletAddress.toBase58()}`);
  }

  if (!dWalletAccount.owner.equals(programId)) {
    throw new Error(
      `IKA_DWALLET_ADDRESS is owned by ${dWalletAccount.owner.toBase58()}, expected ${programId.toBase58()}.`,
    );
  }
  const dWalletState = parseDWalletAccountData(Buffer.from(dWalletAccount.data));

  const message = [
    "ArcPay Ika policy approval",
    `signer=${signer.publicKey.toBase58()}`,
    `requestedSpendUsd=${env.requestedSpendUsd}`,
    `maxSpendUsd=${env.maxSpendUsd}`,
    `expiresAt=${expiresAt}`,
  ].join("|");
  const messageHash = Buffer.from(keccak_256(Buffer.from(message, "utf8")));
  const messageMetadataHash = Buffer.alloc(32);
  const signatureScheme = SIGNATURE_SCHEME_EDDSA_SHA512;
  const signatureSchemeBytes = Buffer.alloc(2);
  signatureSchemeBytes.writeUInt16LE(signatureScheme, 0);
  const [coordinatorAddress] = PublicKey.findProgramAddressSync(
    [SEED_DWALLET_COORDINATOR],
    programId,
  );
  const [messageApprovalAddress, messageApprovalBump] = PublicKey.findProgramAddressSync(
    [
      ...dWalletPdaSeeds(dWalletState.curve, dWalletState.publicKey),
      SEED_MESSAGE_APPROVAL,
      signatureSchemeBytes,
      messageHash,
    ],
    programId,
  );
  const instruction = buildApproveMessageInstruction({
    programId,
    coordinatorAddress,
    messageApprovalAddress,
    dWalletAddress,
    authority: signer.publicKey,
    payer: signer.publicKey,
    messageHash,
    messageMetadataHash,
    userPublicKey: signer.publicKey.toBuffer(),
    signatureScheme,
    messageApprovalBump,
  });
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: blockhash,
  }).add(instruction);
  transaction.sign(signer);
  const serialized = transaction.serialize();

  if (!env.submit) {
    return {
      status: "ready",
      programId: programId.toBase58(),
      dWalletAddress: dWalletAddress.toBase58(),
      signer: signer.publicKey.toBase58(),
      message,
      messageHashHex: messageHash.toString("hex"),
      messageApprovalAddress: messageApprovalAddress.toBase58(),
      requestedSpendUsd: env.requestedSpendUsd,
      maxSpendUsd: env.maxSpendUsd,
      transactionSize: serialized.length,
    };
  }

  const transactionSignature = await connection.sendRawTransaction(serialized, {
    skipPreflight: false,
  });
  await connection.confirmTransaction(transactionSignature, "confirmed");

  return {
    status: "submitted",
    programId: programId.toBase58(),
    dWalletAddress: dWalletAddress.toBase58(),
    signer: signer.publicKey.toBase58(),
    message,
    messageHashHex: messageHash.toString("hex"),
    messageApprovalAddress: messageApprovalAddress.toBase58(),
    requestedSpendUsd: env.requestedSpendUsd,
    maxSpendUsd: env.maxSpendUsd,
    transactionSize: serialized.length,
    transactionSignature,
    explorerTransactionUrl: `${explorerBaseUrl(env.rpcUrl)}/tx/${transactionSignature}?cluster=devnet`,
  };
}

function buildApproveMessageInstruction(params: {
  readonly programId: PublicKey;
  readonly coordinatorAddress: PublicKey;
  readonly messageApprovalAddress: PublicKey;
  readonly dWalletAddress: PublicKey;
  readonly authority: PublicKey;
  readonly payer: PublicKey;
  readonly messageHash: Buffer;
  readonly messageMetadataHash: Buffer;
  readonly userPublicKey: Buffer;
  readonly signatureScheme: number;
  readonly messageApprovalBump: number;
}): TransactionInstruction {
  const data = Buffer.alloc(100);
  data[0] = IX_APPROVE_MESSAGE;
  data[1] = params.messageApprovalBump;
  params.messageHash.copy(data, 2);
  params.messageMetadataHash.copy(data, 34);
  params.userPublicKey.copy(data, 66);
  data.writeUInt16LE(params.signatureScheme, 98);

  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: params.coordinatorAddress, isSigner: false, isWritable: false },
      { pubkey: params.messageApprovalAddress, isSigner: false, isWritable: true },
      { pubkey: params.dWalletAddress, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function parseDWalletAccountData(data: Buffer): { readonly curve: number; readonly publicKey: Buffer } {
  if (data.length < 38 || data[0] !== 2) {
    throw new Error("IKA_DWALLET_ADDRESS is not a current Ika dWallet account.");
  }

  const curve = data.readUInt16LE(34);
  const publicKeyLength = data[37] ?? 0;
  const publicKeyStart = 38;
  const publicKeyEnd = publicKeyStart + publicKeyLength;
  if (publicKeyLength <= 0 || publicKeyEnd > data.length) {
    throw new Error("IKA_DWALLET_ADDRESS has an invalid dWallet public key field.");
  }

  return {
    curve,
    publicKey: data.subarray(publicKeyStart, publicKeyEnd),
  };
}

function dWalletPdaSeeds(curve: number, publicKey: Buffer): Buffer[] {
  const payload = Buffer.alloc(2 + publicKey.length);
  payload.writeUInt16LE(curve, 0);
  publicKey.copy(payload, 2);

  const seeds: Buffer[] = [SEED_DWALLET];
  for (let offset = 0; offset < payload.length; offset += 32) {
    seeds.push(payload.subarray(offset, Math.min(offset + 32, payload.length)));
  }
  return seeds;
}

async function readKeypair(path: string): Promise<Keypair> {
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error("ARCPAY_SIGNER_KEYPAIR_PATH must contain a Solana keypair byte array.");
  }

  return Keypair.fromSecretKey(Uint8Array.from(raw as number[]));
}

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Ika approval numeric env values must be positive numbers.");
  }

  return parsed;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = readPositiveNumber(value, fallback);
  if (!Number.isInteger(parsed)) {
    throw new Error("IKA_APPROVE_EXPIRY_SECONDS must be a positive integer.");
  }

  return parsed;
}

function requireEnv(source: NodeJS.ProcessEnv, key: string): string {
  const value = source[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required for the Ika ApproveMessage proof.`);
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

function explorerBaseUrl(_rpcUrl: string): string {
  return "https://explorer.solana.com";
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const proof = await runIkaApproveMessageProof();
    const verb = proof.status === "submitted" ? "PASSED" : "READY";
    console.log(`${verb} Ika ApproveMessage proof:`);
    console.log(`  Program: ${proof.programId}`);
    console.log(`  dWallet: ${proof.dWalletAddress}`);
    console.log(`  Signer: ${proof.signer}`);
    console.log(`  Requested spend USD: ${proof.requestedSpendUsd}`);
    console.log(`  Max spend USD: ${proof.maxSpendUsd}`);
    console.log(`  MessageApproval: ${proof.messageApprovalAddress}`);
    console.log(`  Message hash: ${proof.messageHashHex}`);
    console.log(`  Transaction bytes: ${proof.transactionSize}`);
    if (proof.transactionSignature) {
      console.log(`  Transaction: ${proof.transactionSignature}`);
      console.log(`  Explorer: ${proof.explorerTransactionUrl}`);
    } else {
      console.log("  Submit: false; set IKA_APPROVE_SUBMIT=true only after validating the dWallet address.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Ika approval failure.";
    console.error(`FAILED Ika ApproveMessage proof: ${message}`);
    process.exitCode = 1;
  }
}
