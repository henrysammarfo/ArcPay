import { Connection, PublicKey } from "@solana/web3.js";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_IKA_SOLANA_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_IKA_GRPC_ENDPOINT = "https://pre-alpha-dev-1.ika.ika-network.net:443";
const DEFAULT_IKA_PROGRAM_ID = "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY";

export interface IkaProofEnvironment {
  readonly rpcUrl: string;
  readonly grpcEndpoint: string;
  readonly programId: string;
  readonly signerKeypairPath: string;
}

export interface IkaProofResult {
  readonly status: "passed" | "needs_funds";
  readonly rpcUrl: string;
  readonly grpcEndpoint: string;
  readonly programId: string;
  readonly programExecutable: boolean;
  readonly signer: string;
  readonly signerLamports: number;
  readonly nextStep: string;
}

export interface IkaProofDependencies {
  readonly connection?: Pick<Connection, "getAccountInfo" | "getBalance">;
}

export function loadIkaProofEnvironment(source: NodeJS.ProcessEnv = process.env): IkaProofEnvironment {
  const env = loadEnvFile(source);
  return {
    rpcUrl: env.IKA_SOLANA_RPC_URL?.trim() || DEFAULT_IKA_SOLANA_RPC_URL,
    grpcEndpoint: env.IKA_GRPC_ENDPOINT?.trim() || DEFAULT_IKA_GRPC_ENDPOINT,
    programId: env.IKA_PROGRAM_ID?.trim() || DEFAULT_IKA_PROGRAM_ID,
    signerKeypairPath: expandHome(
      env.ARCPAY_SIGNER_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json",
    ),
  };
}

/**
 * Verifies ArcPay's Ika integration boundary against official pre-alpha config.
 *
 * This intentionally does not claim production MPC custody. It proves the
 * documented Ika Solana program is reachable and the local signer is ready for
 * the next dWallet policy transaction once the exact sponsor flow is wired.
 */
export async function runIkaPreAlphaProof(
  env: IkaProofEnvironment = loadIkaProofEnvironment(),
  deps: IkaProofDependencies = {},
): Promise<IkaProofResult> {
  validateHttpsUrl(env.rpcUrl, "IKA_SOLANA_RPC_URL");
  validateHttpsUrl(env.grpcEndpoint, "IKA_GRPC_ENDPOINT");

  const programId = new PublicKey(env.programId);
  const signer = await readSignerPublicKey(env.signerKeypairPath);
  const connection = deps.connection ?? new Connection(env.rpcUrl, "confirmed");
  const programAccount = await connection.getAccountInfo(programId, "confirmed");

  if (!programAccount) {
    throw new Error(`Ika program ${programId.toBase58()} was not found on ${env.rpcUrl}.`);
  }

  if (!programAccount.executable) {
    throw new Error(`Ika program ${programId.toBase58()} exists but is not executable.`);
  }

  const signerLamports = await connection.getBalance(signer, "confirmed");
  const status = signerLamports > 0 ? "passed" : "needs_funds";

  return {
    status,
    rpcUrl: env.rpcUrl,
    grpcEndpoint: env.grpcEndpoint,
    programId: programId.toBase58(),
    programExecutable: programAccount.executable,
    signer: signer.toBase58(),
    signerLamports,
    nextStep:
      status === "passed"
        ? "Wire the official Ika dWallet transaction flow and gate signature approval with ArcPay policy."
        : "Fund the signer with devnet SOL before submitting any Ika pre-alpha dWallet policy transaction.",
  };
}

async function readSignerPublicKey(path: string): Promise<PublicKey> {
  if (!existsSync(path)) {
    throw new Error(`ARCPAY_SIGNER_KEYPAIR_PATH does not exist: ${path}`);
  }

  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error("ARCPAY_SIGNER_KEYPAIR_PATH must contain a Solana keypair byte array.");
  }

  const bytes = Uint8Array.from(raw as number[]);
  // The last 32 bytes of a Solana CLI keypair are the public key.
  return new PublicKey(bytes.slice(32, 64));
}

function validateHttpsUrl(value: string, key: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL.`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${key} must use https.`);
  }
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
    const proof = await runIkaPreAlphaProof();
    const verb = proof.status === "passed" ? "PASSED" : "NEEDS_FUNDS";
    console.log(`${verb} Ika pre-alpha boundary proof:`);
    console.log(`  Program: ${proof.programId}`);
    console.log(`  Program executable: ${proof.programExecutable}`);
    console.log(`  Signer: ${proof.signer}`);
    console.log(`  Signer lamports: ${proof.signerLamports}`);
    console.log(`  gRPC endpoint: ${proof.grpcEndpoint}`);
    console.log(`  Next: ${proof.nextStep}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Ika proof failure.";
    console.error(`FAILED Ika pre-alpha proof: ${message}`);
    process.exitCode = 1;
  }
}
