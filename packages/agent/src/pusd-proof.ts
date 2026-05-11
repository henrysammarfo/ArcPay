import { Connection, PublicKey } from "@solana/web3.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const OFFICIAL_PUSD_SOLANA_MINT = "CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s";
const DEFAULT_PUSD_RPC_URL = "https://api.mainnet-beta.solana.com";
const DEFAULT_PUSD_API_BASE_URL = "https://www.palmusd.com/api";
const DEFAULT_PUSD_DECIMALS = 6;

export interface PusdProofEnvironment {
  readonly rpcUrl: string;
  readonly apiBaseUrl: string;
  readonly mintAddress: string;
  readonly expectedDecimals: number;
}

export interface PusdProof {
  readonly status: "passed";
  readonly mintAddress: string;
  readonly decimals: number;
  readonly mintAuthority: string | null;
  readonly freezeAuthority: string | null;
  readonly palmApiSolanaCirculating: number;
  readonly palmApiAsOf: string;
  readonly palmApiSnapshotId: string;
}

export interface PusdProofDependencies {
  readonly connection?: Pick<Connection, "getParsedAccountInfo">;
  readonly fetchImpl?: typeof fetch;
}

export function loadPusdProofEnvironment(source: NodeJS.ProcessEnv = process.env): PusdProofEnvironment {
  const env = loadEnvFile(source);
  return {
    rpcUrl: env.PUSD_RPC_URL?.trim() || DEFAULT_PUSD_RPC_URL,
    apiBaseUrl: env.PUSD_API_BASE_URL?.trim() || DEFAULT_PUSD_API_BASE_URL,
    mintAddress: env.PUSD_MINT_ADDRESS?.trim() || OFFICIAL_PUSD_SOLANA_MINT,
    expectedDecimals: readInteger(env.PUSD_EXPECTED_DECIMALS, DEFAULT_PUSD_DECIMALS),
  };
}

/**
 * Verifies PUSD from official Palm docs and live sources.
 *
 * This is a read-only proof: official Palm API circulation plus Solana SPL mint
 * metadata. It does not claim ArcPay has received or paid PUSD yet.
 */
export async function runPusdProof(
  env: PusdProofEnvironment = loadPusdProofEnvironment(),
  deps: PusdProofDependencies = {},
): Promise<PusdProof> {
  if (env.mintAddress !== OFFICIAL_PUSD_SOLANA_MINT) {
    throw new Error(
      `PUSD_MINT_ADDRESS must match the official Palm USD Solana mint ${OFFICIAL_PUSD_SOLANA_MINT}.`,
    );
  }

  const connection = deps.connection ?? new Connection(env.rpcUrl, "confirmed");
  const mint = new PublicKey(env.mintAddress);
  const account = await connection.getParsedAccountInfo(mint, "confirmed");
  const parsed = account.value?.data;

  if (!parsed || typeof parsed !== "object" || !("parsed" in parsed)) {
    throw new Error(`PUSD mint account ${mint.toBase58()} was not found or is not parsed as SPL mint.`);
  }

  const info = (parsed as { parsed: { info?: unknown } }).parsed.info as
    | {
        decimals?: number;
        mintAuthority?: string | null;
        freezeAuthority?: string | null;
      }
    | undefined;

  if (!info || info.decimals !== env.expectedDecimals) {
    throw new Error(`PUSD mint decimals mismatch: expected ${env.expectedDecimals}, got ${info?.decimals ?? "unknown"}.`);
  }

  const api = await fetchPusdCirculation(env.apiBaseUrl, deps.fetchImpl ?? fetch);
  const solana = api.chains.find((chain) => chain.chain === "SOLANA");
  if (!solana || solana.circulating <= 0) {
    throw new Error("Palm USD API did not report positive Solana PUSD circulation.");
  }

  return {
    status: "passed",
    mintAddress: mint.toBase58(),
    decimals: info.decimals,
    mintAuthority: info.mintAuthority ?? null,
    freezeAuthority: info.freezeAuthority ?? null,
    palmApiSolanaCirculating: solana.circulating,
    palmApiAsOf: api.as_of,
    palmApiSnapshotId: api.snapshot_id,
  };
}

async function fetchPusdCirculation(
  apiBaseUrl: string,
  fetchImpl: typeof fetch,
): Promise<{
  readonly as_of: string;
  readonly snapshot_id: string;
  readonly chains: readonly { readonly chain: string; readonly circulating: number }[];
}> {
  const response = await fetchImpl(`${apiBaseUrl.replace(/\/$/, "")}/v1/circulation`);
  if (!response.ok) {
    throw new Error(`Palm USD circulation API failed with HTTP ${response.status}.`);
  }

  const body = await response.json() as {
    readonly data?: readonly {
      readonly as_of?: string;
      readonly snapshot_id?: string;
      readonly chains?: readonly { readonly chain?: string; readonly circulating?: number }[];
    }[];
  };
  const latest = body.data?.[0];
  if (!latest?.as_of || !latest.snapshot_id || !latest.chains) {
    throw new Error("Palm USD circulation API returned an unexpected response shape.");
  }

  return {
    as_of: latest.as_of,
    snapshot_id: latest.snapshot_id,
    chains: latest.chains.map((chain) => ({
      chain: String(chain.chain),
      circulating: Number(chain.circulating),
    })),
  };
}

function readInteger(value: string | undefined, fallback: number): number {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error("PUSD_EXPECTED_DECIMALS must be an integer.");
  }

  return Number(trimmed);
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const proof = await runPusdProof();
    console.log("PASSED PUSD proof:");
    console.log(`  Mint: ${proof.mintAddress}`);
    console.log(`  Decimals: ${proof.decimals}`);
    console.log(`  Mint authority: ${proof.mintAuthority ?? "none"}`);
    console.log(`  Freeze authority: ${proof.freezeAuthority ?? "none"}`);
    console.log(`  Palm API Solana circulating: ${proof.palmApiSolanaCirculating}`);
    console.log(`  Palm API as of: ${proof.palmApiAsOf}`);
    console.log(`  Palm API snapshot: ${proof.palmApiSnapshotId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PUSD proof failure.";
    console.error(`FAILED PUSD proof: ${message}`);
    process.exitCode = 1;
  }
}
