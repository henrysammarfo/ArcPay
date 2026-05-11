import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { bcs } from "@mysten/bcs";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

const DEFAULT_IKA_SOLANA_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_IKA_GRPC_ENDPOINT = "https://pre-alpha-dev-1.ika.ika-network.net:443";
const DEFAULT_IKA_PROGRAM_ID = "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY";
const SEED_DWALLET_COORDINATOR = Buffer.from("dwallet_coordinator");
const SEED_DWALLET = Buffer.from("dwallet");
const DISC_COORDINATOR = 1;
const DISC_NETWORK_ENCRYPTION_KEY = 3;
const DISC_DWALLET = 2;
const COORDINATOR_MIN_LENGTH = 116;
const NETWORK_ENCRYPTION_KEY_MIN_LENGTH = 164;
const CURVE_CURVE25519 = 2;

export interface IkaCreateDWalletEnvironment {
  readonly rpcUrl: string;
  readonly grpcEndpoint: string;
  readonly programId: string;
  readonly signerKeypairPath: string;
  readonly pollTimeoutMs: number;
}

export interface IkaCreateDWalletProof {
  readonly status: "created";
  readonly rpcUrl: string;
  readonly grpcEndpoint: string;
  readonly programId: string;
  readonly signer: string;
  readonly coordinatorAddress: string;
  readonly networkEncryptionKeyAddress: string;
  readonly dWalletAddress: string;
  readonly dWalletPublicKeyHex: string;
  readonly attestationEpoch: string;
  readonly nextEnvLine: string;
}

export interface IkaCreateDWalletDependencies {
  readonly connection?: Pick<Connection, "getAccountInfo" | "getProgramAccounts">;
  readonly submitDkgRequest?: (
    env: IkaCreateDWalletEnvironment,
    userSignature: Uint8Array,
    signedRequestData: Uint8Array,
  ) => Promise<Uint8Array>;
  readonly wait?: (ms: number) => Promise<void>;
}

export function loadIkaCreateDWalletEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): IkaCreateDWalletEnvironment {
  const env = loadEnvFile(source);
  return {
    rpcUrl: env.IKA_SOLANA_RPC_URL?.trim() || DEFAULT_IKA_SOLANA_RPC_URL,
    grpcEndpoint: env.IKA_GRPC_ENDPOINT?.trim() || DEFAULT_IKA_GRPC_ENDPOINT,
    programId: env.IKA_PROGRAM_ID?.trim() || DEFAULT_IKA_PROGRAM_ID,
    signerKeypairPath: expandHome(
      env.ARCPAY_SIGNER_KEYPAIR_PATH?.trim() || "~/.config/solana/id.json",
    ),
    pollTimeoutMs: readPositiveInteger(env.IKA_DWALLET_POLL_TIMEOUT_MS, 30_000),
  };
}

/**
 * Creates a real Ika pre-alpha dWallet using the documented gRPC DKG request.
 *
 * Ika pre-alpha is explicitly not production MPC. This proof only claims a
 * live devnet dWallet account owned by the official Ika pre-alpha program.
 */
export async function runIkaCreateDWalletProof(
  env: IkaCreateDWalletEnvironment = loadIkaCreateDWalletEnvironment(),
  deps: IkaCreateDWalletDependencies = {},
): Promise<IkaCreateDWalletProof> {
  const programId = new PublicKey(env.programId);
  const signer = await readKeypair(env.signerKeypairPath);
  const connection = deps.connection ?? new Connection(env.rpcUrl, "confirmed");
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const [coordinatorAddress] = PublicKey.findProgramAddressSync(
    [SEED_DWALLET_COORDINATOR],
    programId,
  );
  await pollAccount(
    connection,
    coordinatorAddress,
    (data) => data.length >= COORDINATOR_MIN_LENGTH && data[0] === DISC_COORDINATOR,
    env.pollTimeoutMs,
    wait,
  );

  const networkEncryptionKeyAddress = await pollProgramAccount(
    connection,
    programId,
    (data) =>
      data.length >= NETWORK_ENCRYPTION_KEY_MIN_LENGTH &&
      data[0] === DISC_NETWORK_ENCRYPTION_KEY,
    env.pollTimeoutMs,
    wait,
  );

  const dkgRequestData = buildDkgRequestData(signer.publicKey);
  const userSignature = buildUserSignature(signer.publicKey);
  const responseBytes = await (
    deps.submitDkgRequest ?? submitDkgRequest
  )(env, userSignature, dkgRequestData);
  const response = TransactionResponseData.parse(new Uint8Array(responseBytes));

  if (!response.Attestation) {
    throw new Error(`Ika DKG failed: ${JSON.stringify(response)}`);
  }

  const dWalletAttestation = VersionedDWalletDataAttestation.parse(
    new Uint8Array(response.Attestation.attestation_data),
  );
  if (!dWalletAttestation.V1) {
    throw new Error(`Unexpected Ika DKG attestation: ${JSON.stringify(dWalletAttestation)}`);
  }

  const dWalletPublicKey = new Uint8Array(dWalletAttestation.V1.public_key);
  const [dWalletAddress] = PublicKey.findProgramAddressSync(
    dWalletPdaSeeds(CURVE_CURVE25519, dWalletPublicKey),
    programId,
  );
  await pollAccount(
    connection,
    dWalletAddress,
    (data) => data.length > 2 && data[0] === DISC_DWALLET,
    env.pollTimeoutMs,
    wait,
  );

  return {
    status: "created",
    rpcUrl: env.rpcUrl,
    grpcEndpoint: env.grpcEndpoint,
    programId: programId.toBase58(),
    signer: signer.publicKey.toBase58(),
    coordinatorAddress: coordinatorAddress.toBase58(),
    networkEncryptionKeyAddress: networkEncryptionKeyAddress.toBase58(),
    dWalletAddress: dWalletAddress.toBase58(),
    dWalletPublicKeyHex: Buffer.from(dWalletPublicKey).toString("hex"),
    attestationEpoch: String(response.Attestation.epoch),
    nextEnvLine: `IKA_DWALLET_ADDRESS=${dWalletAddress.toBase58()}`,
  };
}

function buildDkgRequestData(signerPublicKey: PublicKey): Uint8Array {
  return SignedRequestData.serialize({
    session_identifier_preimage: Array.from(new Uint8Array(32)),
    epoch: 1n,
    chain_id: { Solana: true },
    intended_chain_sender: Array.from(signerPublicKey.toBytes()),
    request: {
      DKG: {
        dwallet_network_encryption_public_key: Array.from(new Uint8Array(32)),
        curve: { Curve25519: true },
        centralized_public_key_share_and_proof: Array.from(new Uint8Array(32)),
        user_secret_key_share: {
          Encrypted: {
            encrypted_centralized_secret_share_and_proof: Array.from(new Uint8Array(32)),
            encryption_key: Array.from(new Uint8Array(32)),
            signer_public_key: Array.from(signerPublicKey.toBytes()),
          },
        },
        user_public_output: Array.from(new Uint8Array(32)),
        sign_during_dkg_request: null,
      },
    },
  }).toBytes();
}

function buildUserSignature(signerPublicKey: PublicKey): Uint8Array {
  return UserSignature.serialize({
    Ed25519: {
      signature: Array.from(new Uint8Array(64)),
      public_key: Array.from(signerPublicKey.toBytes()),
    },
  }).toBytes();
}

async function submitDkgRequest(
  env: IkaCreateDWalletEnvironment,
  userSignature: Uint8Array,
  signedRequestData: Uint8Array,
): Promise<Uint8Array> {
  const client = loadGrpcClient(env.grpcEndpoint);
  return new Promise((resolve, reject) => {
    client.SubmitTransaction(
      {
        user_signature: Buffer.from(userSignature),
        signed_request_data: Buffer.from(signedRequestData),
      },
      (error: unknown, response: { response_data?: Buffer }) => {
        if (error) {
          reject(error);
          return;
        }

        if (!response.response_data) {
          reject(new Error("Ika DKG response did not include response_data."));
          return;
        }

        resolve(new Uint8Array(response.response_data));
      },
    );
  });
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

async function pollAccount(
  connection: Pick<Connection, "getAccountInfo">,
  account: PublicKey,
  check: (data: Buffer) => boolean,
  timeoutMs: number,
  wait: (ms: number) => Promise<void>,
): Promise<Buffer> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await connection.getAccountInfo(account, "confirmed");
    const data = info?.data ? Buffer.from(info.data) : undefined;
    if (data && check(data)) {
      return data;
    }

    await wait(500);
  }

  throw new Error(`Timed out waiting for Ika account ${account.toBase58()}.`);
}

async function pollProgramAccount(
  connection: Pick<Connection, "getProgramAccounts">,
  programId: PublicKey,
  check: (data: Buffer) => boolean,
  timeoutMs: number,
  wait: (ms: number) => Promise<void>,
): Promise<PublicKey> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const accounts = await connection.getProgramAccounts(programId, "confirmed");
    const match = accounts.find((account) => check(Buffer.from(account.account.data)));
    if (match) {
      return match.pubkey;
    }

    await wait(500);
  }

  throw new Error(`Timed out waiting for Ika NetworkEncryptionKey account.`);
}

function dWalletPdaSeeds(curve: number, publicKey: Uint8Array): Buffer[] {
  const payload = Buffer.alloc(2 + publicKey.length);
  payload.writeUInt16LE(curve, 0);
  Buffer.from(publicKey).copy(payload, 2);

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

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("IKA_DWALLET_POLL_TIMEOUT_MS must be a positive integer.");
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

const ChainId = bcs.enum("ChainId", {
  Solana: null,
  Sui: null,
});

const DWalletCurve = bcs.enum("DWalletCurve", {
  Secp256k1: null,
  Secp256r1: null,
  Curve25519: null,
  Ristretto: null,
});

const DWalletSignatureScheme = bcs.enum("DWalletSignatureScheme", {
  EcdsaKeccak256: null,
  EcdsaSha256: null,
  EcdsaDoubleSha256: null,
  TaprootSha256: null,
  EcdsaBlake2b256: null,
  EddsaSha512: null,
  SchnorrkelMerlin: null,
});

const SignDuringDKGRequest = bcs.struct("SignDuringDKGRequest", {
  presign_session_identifier: bcs.vector(bcs.u8()),
  presign: bcs.vector(bcs.u8()),
  signature_scheme: DWalletSignatureScheme,
  message: bcs.vector(bcs.u8()),
  message_metadata: bcs.vector(bcs.u8()),
  message_centralized_signature: bcs.vector(bcs.u8()),
});

const UserSecretKeyShare = bcs.enum("UserSecretKeyShare", {
  Encrypted: bcs.struct("UserSecretKeyShareEncrypted", {
    encrypted_centralized_secret_share_and_proof: bcs.vector(bcs.u8()),
    encryption_key: bcs.vector(bcs.u8()),
    signer_public_key: bcs.vector(bcs.u8()),
  }),
  Public: bcs.struct("UserSecretKeySharePublic", {
    public_user_secret_key_share: bcs.vector(bcs.u8()),
  }),
});

const DWalletRequest = bcs.enum("DWalletRequest", {
  DKG: bcs.struct("DKG", {
    dwallet_network_encryption_public_key: bcs.vector(bcs.u8()),
    curve: DWalletCurve,
    centralized_public_key_share_and_proof: bcs.vector(bcs.u8()),
    user_secret_key_share: UserSecretKeyShare,
    user_public_output: bcs.vector(bcs.u8()),
    sign_during_dkg_request: bcs.option(SignDuringDKGRequest),
  }),
});

const SignedRequestData = bcs.struct("SignedRequestData", {
  session_identifier_preimage: bcs.fixedArray(32, bcs.u8()),
  epoch: bcs.u64(),
  chain_id: ChainId,
  intended_chain_sender: bcs.vector(bcs.u8()),
  request: DWalletRequest,
});

const UserSignature = bcs.enum("UserSignature", {
  Ed25519: bcs.struct("UserSignatureEd25519", {
    signature: bcs.vector(bcs.u8()),
    public_key: bcs.vector(bcs.u8()),
  }),
  Secp256k1: bcs.struct("UserSignatureSecp256k1", {
    signature: bcs.vector(bcs.u8()),
    public_key: bcs.vector(bcs.u8()),
  }),
  Secp256r1: bcs.struct("UserSignatureSecp256r1", {
    signature: bcs.vector(bcs.u8()),
    public_key: bcs.vector(bcs.u8()),
  }),
});

const NetworkSignedAttestation = bcs.struct("NetworkSignedAttestation", {
  attestation_data: bcs.vector(bcs.u8()),
  network_signature: bcs.vector(bcs.u8()),
  network_pubkey: bcs.vector(bcs.u8()),
  epoch: bcs.u64(),
});

const TransactionResponseData = bcs.enum("TransactionResponseData", {
  Signature: bcs.struct("SignatureResponse", {
    signature: bcs.vector(bcs.u8()),
  }),
  Attestation: NetworkSignedAttestation,
  Error: bcs.struct("ErrorResponse", {
    message: bcs.string(),
  }),
});

const VersionedDWalletDataAttestation = bcs.enum("VersionedDWalletDataAttestation", {
  V1: bcs.struct("DWalletDataAttestationV1", {
    session_identifier: bcs.fixedArray(32, bcs.u8()),
    intended_chain_sender: bcs.vector(bcs.u8()),
    curve: DWalletCurve,
    public_key: bcs.vector(bcs.u8()),
    public_output: bcs.vector(bcs.u8()),
    is_imported_key: bcs.bool(),
    sign_during_dkg_signature: bcs.option(bcs.vector(bcs.u8())),
  }),
});

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const proof = await runIkaCreateDWalletProof();
    console.log("PASSED Ika create-dWallet proof:");
    console.log(`  Program: ${proof.programId}`);
    console.log(`  Signer: ${proof.signer}`);
    console.log(`  Coordinator: ${proof.coordinatorAddress}`);
    console.log(`  NetworkEncryptionKey: ${proof.networkEncryptionKeyAddress}`);
    console.log(`  dWallet: ${proof.dWalletAddress}`);
    console.log(`  dWallet public key: ${proof.dWalletPublicKeyHex}`);
    console.log(`  Attestation epoch: ${proof.attestationEpoch}`);
    console.log(`  Add to .env: ${proof.nextEnvLine}`);
    console.log("  Next: npm run proof:ika:approve -w @arcpay/agent");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Ika create-dWallet failure.";
    console.error(`FAILED Ika create-dWallet proof: ${message}`);
    process.exitCode = 1;
  }
}
