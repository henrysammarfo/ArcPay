import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { PublicKey } from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_IKA_GRPC_ENDPOINT = "https://pre-alpha-dev-1.ika.ika-network.net:443";

export interface IkaGrpcProofEnvironment {
  readonly grpcEndpoint: string;
  readonly signerKeypairPath: string;
  readonly dWalletAddress?: string;
}

export interface IkaGrpcProof {
  readonly status: "passed";
  readonly grpcEndpoint: string;
  readonly signer: string;
  readonly dWalletAddress?: string;
  readonly presignCount: number;
  readonly scopedToDWallet: boolean;
}

export function loadIkaGrpcProofEnvironment(source: NodeJS.ProcessEnv = process.env): IkaGrpcProofEnvironment {
  const env = loadEnvFile(source);
  return {
    grpcEndpoint: env.IKA_GRPC_ENDPOINT?.trim() || DEFAULT_IKA_GRPC_ENDPOINT,
    signerKeypairPath: expandHome(
      env.ARCPAY_SIGNER_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json",
    ),
    dWalletAddress: env.IKA_DWALLET_ADDRESS?.trim() || undefined,
  };
}

/**
 * Calls the official Ika pre-alpha gRPC service for signer presigns.
 *
 * This is a live service proof only. It does not claim a dWallet approval or
 * signature happened; `proof:ika:approve` is still required for final track
 * evidence once a real dWallet exists.
 */
export async function runIkaGrpcProof(
  env: IkaGrpcProofEnvironment = loadIkaGrpcProofEnvironment(),
): Promise<IkaGrpcProof> {
  const signer = await readSignerPublicKey(env.signerKeypairPath);
  const client = loadGrpcClient(env.grpcEndpoint);
  const response = env.dWalletAddress
    ? await getPresignsForDWallet(client, signer, new PublicKey(env.dWalletAddress))
    : await getPresigns(client, signer);

  return {
    status: "passed",
    grpcEndpoint: env.grpcEndpoint,
    signer: signer.toBase58(),
    dWalletAddress: env.dWalletAddress,
    presignCount: Array.isArray(response.presigns) ? response.presigns.length : 0,
    scopedToDWallet: Boolean(env.dWalletAddress),
  };
}

function loadGrpcClient(grpcEndpoint: string): any {
  const target = grpcEndpoint.replace(/^https?:\/\//, "");
  const protoPath = resolve(process.cwd(), "ika_dwallet.proto");
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const descriptor = grpc.loadPackageDefinition(packageDefinition) as any;
  const service = descriptor.ika.dwallet.v1.DWalletService;
  const credentials = grpcEndpoint.startsWith("https://")
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure();

  return new service(target, credentials);
}

function getPresigns(client: any, signer: PublicKey): Promise<{ presigns?: unknown[] }> {
  return new Promise((resolve, reject) => {
    client.GetPresigns(
      { user_pubkey: Buffer.from(signer.toBytes()) },
      (error: unknown, response: { presigns?: unknown[] }) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(response);
      },
    );
  });
}

function getPresignsForDWallet(
  client: any,
  signer: PublicKey,
  dWalletAddress: PublicKey,
): Promise<{ presigns?: unknown[] }> {
  return new Promise((resolve, reject) => {
    client.GetPresignsForDWallet(
      {
        user_pubkey: Buffer.from(signer.toBytes()),
        dwallet_id: Buffer.from(dWalletAddress.toBytes()),
      },
      (error: unknown, response: { presigns?: unknown[] }) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(response);
      },
    );
  });
}

async function readSignerPublicKey(path: string): Promise<PublicKey> {
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error("ARCPAY_SIGNER_KEYPAIR_PATH must contain a Solana keypair byte array.");
  }

  const bytes = Uint8Array.from(raw as number[]);
  return new PublicKey(bytes.slice(32, 64));
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
    const proof = await runIkaGrpcProof();
    console.log("PASSED Ika gRPC proof:");
    console.log(`  Endpoint: ${proof.grpcEndpoint}`);
    console.log(`  Signer: ${proof.signer}`);
    console.log(`  Scoped to dWallet: ${proof.scopedToDWallet}`);
    if (proof.dWalletAddress) {
      console.log(`  dWallet: ${proof.dWalletAddress}`);
    }
    console.log(`  Presigns returned: ${proof.presignCount}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Ika gRPC proof failure.";
    console.error(`FAILED Ika gRPC proof: ${message}`);
    process.exitCode = 1;
  }
}
