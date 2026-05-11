import { ArcPayTreasury, SolanaArcPayProgramClient } from "@arcpay/sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEFAULT_SHIELD_AMOUNT = 1_000;

export interface ProgramShieldProofEnvironment {
  readonly rpcUrl: string;
  readonly programId: string;
  readonly network: "devnet" | "mainnet-beta";
  readonly signerKeypairPath: string;
  readonly treasuryAddress: string;
  readonly mintAddress: string;
  readonly amount: number;
  readonly shieldRef: string;
}

export interface ProgramShieldProof {
  readonly status: "passed";
  readonly network: ProgramShieldProofEnvironment["network"];
  readonly owner: string;
  readonly programId: string;
  readonly treasuryAddress: string;
  readonly shieldSignature: string;
  readonly explorerTransactionUrl: string;
  readonly explorerTreasuryUrl: string;
  readonly shield: {
    readonly amount: string;
    readonly mint: string;
    readonly shieldRef: string;
  };
}

/**
 * Loads live shield-deposit proof configuration.
 *
 * This records an off-chain privacy reference in the ArcPay program. It does
 * not move SPL tokens and does not print the signer private key.
 */
export function loadProgramShieldProofEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ProgramShieldProofEnvironment {
  return {
    rpcUrl: requireEnv(source, "QUICKNODE_RPC_URL"),
    programId: requireEnv(source, "ARCPAY_PROGRAM_ID"),
    network: source.SOLANA_NETWORK === "mainnet-beta" ? "mainnet-beta" : "devnet",
    signerKeypairPath: expandHome(
      source.ARCPAY_SIGNER_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json",
    ),
    treasuryAddress: requireEnv(source, "ARCPAY_TREASURY_ADDRESS"),
    mintAddress: source.ARCPAY_PROOF_MINT_ADDRESS?.trim() || DEFAULT_USDC_MINT,
    amount: readPositiveInteger(source.ARCPAY_PROOF_SHIELD_AMOUNT, DEFAULT_SHIELD_AMOUNT),
    shieldRef:
      source.ARCPAY_PROOF_SHIELD_REF?.trim() ||
      `umbra-live-proof-${Date.now().toString(36)}`,
  };
}

/**
 * Submits a live `shield_deposit` transaction against an initialized ArcPay
 * treasury and verifies the target treasury account exists before sending.
 */
export async function runProgramShieldProof(
  env: ProgramShieldProofEnvironment = loadProgramShieldProofEnvironment(),
): Promise<ProgramShieldProof> {
  const connection = new Connection(env.rpcUrl, "confirmed");
  const owner = await readKeypair(env.signerKeypairPath);
  const programClient = new SolanaArcPayProgramClient({
    connection,
    programId: env.programId,
  });
  const treasuryAddress = new PublicKey(env.treasuryAddress);
  const mintAddress = new PublicKey(env.mintAddress);
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
  const result = await treasury.recordShieldDepositOnChain({
    owner,
    treasury: treasuryAddress,
    amount: env.amount,
    mint: mintAddress,
    shieldRef: env.shieldRef,
  });

  return {
    status: "passed",
    network: env.network,
    owner: owner.publicKey.toBase58(),
    programId: env.programId,
    treasuryAddress: treasuryAddress.toBase58(),
    shieldSignature: result.signature,
    explorerTransactionUrl: createExplorerUrl("tx", result.signature, env.network),
    explorerTreasuryUrl: createExplorerUrl("address", treasuryAddress.toBase58(), env.network),
    shield: {
      amount: env.amount.toString(),
      mint: mintAddress.toBase58(),
      shieldRef: env.shieldRef,
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
  network: ProgramShieldProofEnvironment["network"],
): string {
  const cluster = network === "mainnet-beta" ? "" : "?cluster=devnet";
  return `https://explorer.solana.com/${type}/${value}${cluster}`;
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const result = await runProgramShieldProof();
    console.log("PASSED Solana Program shield_deposit live proof:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown program shield proof failure.";
    console.error(`FAILED Solana Program shield_deposit live proof: ${message}`);
    process.exitCode = 1;
  }
}
