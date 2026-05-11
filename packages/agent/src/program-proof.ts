import { ArcPayTreasury, SolanaArcPayProgramClient } from "@arcpay/sdk";
import { Connection, Keypair } from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_AGENT_ID_PREFIX = "ada-research-agent-live";
const DEFAULT_DAILY_LIMIT = 5_000;
const DEFAULT_MAX_SINGLE_TX = 1_000;
const DEFAULT_MIN_GOLDRUSH_SCORE = 70;

export interface ProgramProofEnvironment {
  readonly rpcUrl: string;
  readonly programId: string;
  readonly network: "devnet" | "mainnet-beta";
  readonly signerKeypairPath: string;
  readonly agentId: string;
  readonly dailyLimit: number;
  readonly maxSingleTx: number;
  readonly minGoldRushScore: number;
}

export interface ProgramInitializeProof {
  readonly status: "passed";
  readonly network: ProgramProofEnvironment["network"];
  readonly owner: string;
  readonly agentId: string;
  readonly programId: string;
  readonly treasuryAddress: string;
  readonly initializeSignature: string;
  readonly explorerTransactionUrl: string;
  readonly explorerTreasuryUrl: string;
  readonly policy: {
    readonly dailyLimit: string;
    readonly maxSingleTx: string;
    readonly minGoldRushScore: number;
  };
}

/**
 * Loads live program proof configuration from environment variables.
 *
 * The signer defaults to the Solana CLI keypair path in WSL. The private key is
 * read locally for signing only and is never logged.
 */
export function loadProgramProofEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ProgramProofEnvironment {
  return {
    rpcUrl: requireEnv(source, "QUICKNODE_RPC_URL"),
    programId: requireEnv(source, "ARCPAY_PROGRAM_ID"),
    network: source.SOLANA_NETWORK === "mainnet-beta" ? "mainnet-beta" : "devnet",
    signerKeypairPath: expandHome(
      source.ARCPAY_SIGNER_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json",
    ),
    agentId:
      source.ARCPAY_PROOF_AGENT_ID?.trim() ||
      `${DEFAULT_AGENT_ID_PREFIX}-${Date.now().toString(36)}`,
    dailyLimit: readPositiveInteger(source.ARCPAY_PROOF_DAILY_LIMIT, DEFAULT_DAILY_LIMIT),
    maxSingleTx: readPositiveInteger(source.ARCPAY_PROOF_MAX_SINGLE_TX, DEFAULT_MAX_SINGLE_TX),
    minGoldRushScore: readScore(source.ARCPAY_PROOF_MIN_GOLDRUSH_SCORE),
  };
}

/**
 * Submits a live `initialize_treasury` transaction and verifies the resulting
 * treasury account can be fetched from the deployed ArcPay program.
 */
export async function runProgramInitializeProof(
  env: ProgramProofEnvironment = loadProgramProofEnvironment(),
): Promise<ProgramInitializeProof> {
  if (env.maxSingleTx > env.dailyLimit) {
    throw new Error("ARCPAY_PROOF_MAX_SINGLE_TX cannot exceed ARCPAY_PROOF_DAILY_LIMIT.");
  }

  const connection = new Connection(env.rpcUrl, "confirmed");
  const owner = await readKeypair(env.signerKeypairPath);
  const programClient = new SolanaArcPayProgramClient({
    connection,
    programId: env.programId,
  });
  const treasury = new ArcPayTreasury({
    rpcUrl: env.rpcUrl,
    programId: env.programId,
    network: env.network,
    connection,
    programClient,
  });

  const handle = await treasury.createAgentTreasury({
    agentId: env.agentId,
    acceptedCurrencies: ["USDC", "AUDD", "PUSD"],
    privacy: "umbra",
    yield: {
      provider: "kamino",
      autoDeposit: false,
    },
    spendingPolicy: {
      dailyLimit: env.dailyLimit,
      maxSingleTx: env.maxSingleTx,
      requireGoldRushScore: env.minGoldRushScore,
    },
    ownerSigner: owner,
  });

  if (!handle.treasuryAddress || !handle.initializeSignature) {
    throw new Error("ArcPay SDK did not return an on-chain initialization proof.");
  }

  const fetchedTreasury = await programClient.fetchTreasury(
    programClient.deriveTreasuryAddress({
      owner: owner.publicKey,
      agentId: env.agentId,
    }),
  );

  if (!fetchedTreasury) {
    throw new Error("Initialized treasury account was not found after confirmation.");
  }

  return {
    status: "passed",
    network: env.network,
    owner: owner.publicKey.toBase58(),
    agentId: env.agentId,
    programId: env.programId,
    treasuryAddress: handle.treasuryAddress,
    initializeSignature: handle.initializeSignature,
    explorerTransactionUrl: createExplorerUrl("tx", handle.initializeSignature, env.network),
    explorerTreasuryUrl: createExplorerUrl("address", handle.treasuryAddress, env.network),
    policy: {
      dailyLimit: fetchedTreasury.dailyLimit.toString(),
      maxSingleTx: fetchedTreasury.maxSingleTx.toString(),
      minGoldRushScore: fetchedTreasury.minGoldRushScore,
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
  const score = readPositiveInteger(value, DEFAULT_MIN_GOLDRUSH_SCORE);
  if (score > 100) {
    throw new Error("ARCPAY_PROOF_MIN_GOLDRUSH_SCORE must be between 1 and 100.");
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
  network: ProgramProofEnvironment["network"],
): string {
  const cluster = network === "mainnet-beta" ? "" : "?cluster=devnet";
  return `https://explorer.solana.com/${type}/${value}${cluster}`;
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const result = await runProgramInitializeProof();
    console.log("PASSED Solana Program initialize_treasury live proof:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown program proof failure.";
    console.error(`FAILED Solana Program initialize_treasury live proof: ${message}`);
    process.exitCode = 1;
  }
}
