import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { ArcPaySdkError, wrapExternalError } from "../errors.js";
import { assertNonEmptyString, assertPositiveNumber, assertUrl } from "../validation.js";

const DEFAULT_CLOAK_DEVNET_PACKAGE = "@cloak.dev/sdk-devnet";
const DEFAULT_CLOAK_DEVNET_RELAY_URL = "https://api.devnet.cloak.ag";

export interface CloakDevnetSdkLike {
  readonly CLOAK_PROGRAM_ID: PublicKey;
  readonly NATIVE_SOL_MINT: PublicKey;
  readonly createUtxo: (amount: bigint, keypair: unknown, mintAddress?: PublicKey) => Promise<unknown>;
  readonly createZeroUtxo: (mintAddress?: PublicKey) => Promise<unknown>;
  readonly generateUtxoKeypair: () => Promise<{ readonly privateKey?: unknown }>;
  readonly getNkFromUtxoPrivateKey: (privateKey: unknown) => unknown;
  readonly transact: (
    params: {
      readonly inputUtxos: readonly unknown[];
      readonly outputUtxos: readonly unknown[];
      readonly externalAmount: bigint;
      readonly depositor: PublicKey;
    },
    options: Record<string, unknown>,
  ) => Promise<{
    readonly signature: string;
    readonly outputUtxos: readonly unknown[];
    readonly merkleTree?: unknown;
  }>;
}

export interface CloakDevnetDepositProofOptions {
  readonly connection: Connection;
  readonly signer: Keypair;
  readonly amountLamports: bigint;
  readonly relayUrl?: string;
  readonly sdkPath?: string;
  readonly sdk?: CloakDevnetSdkLike;
  readonly skipBalancePreflight?: boolean;
  readonly onProgress?: (status: string) => void;
  readonly onProofProgress?: (percent: number) => void;
}

export interface CloakDevnetDepositProofResult {
  readonly network: "devnet";
  readonly signer: string;
  readonly amountLamports: string;
  readonly programId: string;
  readonly relayUrl: string;
  readonly signature: string;
  readonly outputCount: number;
  readonly merkleTreeReturned: boolean;
}

/**
 * Executes the official Cloak devnet functional UTXO deposit path.
 *
 * This intentionally targets `@cloak.dev/sdk-devnet`; mainnet uses the normal
 * `@cloak.dev/sdk` package and real USDC/SOL funding.
 */
export async function runCloakDevnetSolDepositProof(
  options: CloakDevnetDepositProofOptions,
): Promise<CloakDevnetDepositProofResult> {
  const amountLamports = assertPositiveBigInt(options.amountLamports, "amountLamports");
  const relayUrl = options.relayUrl ? assertUrl(options.relayUrl, "relayUrl") : DEFAULT_CLOAK_DEVNET_RELAY_URL;
  const sdk = options.sdk ?? (await importCloakDevnetSdk(options.sdkPath));

  if (options.skipBalancePreflight !== true) {
    const balance = await options.connection.getBalance(options.signer.publicKey, "confirmed");
    if (BigInt(balance) < amountLamports) {
      throw new ArcPaySdkError(
        "VALIDATION_ERROR",
        `Cloak devnet signer has insufficient SOL: balance ${balance} lamports, deposit requires ${amountLamports.toString()} lamports before transaction fees.`,
      );
    }
  }

  try {
    const owner = await sdk.generateUtxoKeypair();
    const chainNoteViewingKeyNk = sdk.getNkFromUtxoPrivateKey(owner.privateKey);
    const output = await sdk.createUtxo(amountLamports, owner, sdk.NATIVE_SOL_MINT);
    const zero = await sdk.createZeroUtxo(sdk.NATIVE_SOL_MINT);
    const deposited = await sdk.transact(
      {
        inputUtxos: [zero],
        outputUtxos: [output],
        externalAmount: amountLamports,
        depositor: options.signer.publicKey,
      },
      {
        connection: options.connection,
        programId: sdk.CLOAK_PROGRAM_ID,
        depositorKeypair: options.signer,
        walletPublicKey: options.signer.publicKey,
        chainNoteViewingKeyNk,
        relayUrl,
        enforceViewingKeyRegistration: false,
        onProgress: options.onProgress,
        onProofProgress: options.onProofProgress,
        useUniqueNullifiers: true,
      },
    );

    return {
      network: "devnet",
      signer: options.signer.publicKey.toBase58(),
      amountLamports: amountLamports.toString(),
      programId: sdk.CLOAK_PROGRAM_ID.toBase58(),
      relayUrl,
      signature: assertNonEmptyString(deposited.signature, "signature"),
      outputCount: deposited.outputUtxos.length,
      merkleTreeReturned: deposited.merkleTree !== undefined,
    };
  } catch (cause) {
    if (cause instanceof ArcPaySdkError) {
      throw cause;
    }

    throw wrapExternalError("Cloak", "devnet SOL deposit", cause);
  }
}

export async function importCloakDevnetSdk(sdkPath?: string): Promise<CloakDevnetSdkLike> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>;

  try {
    const imported = sdkPath
      ? await dynamicImport(toImportSpecifier(resolveExplicitSdkPath(sdkPath)))
      : await dynamicImport(DEFAULT_CLOAK_DEVNET_PACKAGE);
    return validateCloakDevnetSdk(imported);
  } catch (cause) {
    if (cause instanceof ArcPaySdkError) {
      throw cause;
    }

    try {
      const requireFromConsumer = createRequire(`${process.cwd()}/package.json`);
      const resolvedSdkPath = requireFromConsumer.resolve(DEFAULT_CLOAK_DEVNET_PACKAGE);
      return validateCloakDevnetSdk(await dynamicImport(pathToFileURL(resolvedSdkPath).href));
    } catch (fallbackCause) {
      throw new ArcPaySdkError(
        "CONFIGURATION_ERROR",
        "@cloak.dev/sdk-devnet is required for live Cloak devnet proof. Install it in the workspace or set CLOAK_SDK_PATH to the installed package entry.",
        fallbackCause instanceof Error ? fallbackCause : cause,
      );
    }
  }
}

function validateCloakDevnetSdk(value: unknown): CloakDevnetSdkLike {
  const sdk = value as Partial<CloakDevnetSdkLike>;
  const requiredFunctions = [
    sdk.createUtxo,
    sdk.createZeroUtxo,
    sdk.generateUtxoKeypair,
    sdk.getNkFromUtxoPrivateKey,
    sdk.transact,
  ];

  if (
    typeof value !== "object" ||
    value === null ||
    !(sdk.CLOAK_PROGRAM_ID instanceof PublicKey) ||
    !(sdk.NATIVE_SOL_MINT instanceof PublicKey) ||
    requiredFunctions.some((fn) => typeof fn !== "function")
  ) {
    throw new ArcPaySdkError(
      "CONFIGURATION_ERROR",
      "@cloak.dev/sdk-devnet does not expose the expected functional UTXO API.",
    );
  }

  return sdk as CloakDevnetSdkLike;
}

function resolveExplicitSdkPath(sdkPath: string): string {
  const candidate = assertNonEmptyString(sdkPath, "sdkPath");
  const requireFromConsumer = createRequire(`${process.cwd()}/package.json`);

  try {
    return requireFromConsumer.resolve(candidate);
  } catch {
    return resolvePackageDirectoryEntry(candidate);
  }
}

function resolvePackageDirectoryEntry(candidate: string): string {
  try {
    if (!statSync(candidate).isDirectory()) {
      return candidate;
    }
  } catch {
    return candidate;
  }

  const packageJsonPath = path.join(candidate, "package.json");
  const packageJson = readPackageJson(packageJsonPath);
  const configuredEntry = findPackageEntry(packageJson);
  const possibleEntries = [
    configuredEntry,
    "./dist/index.js",
    "./index.js",
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  for (const entry of possibleEntries) {
    const resolvedEntry = path.resolve(candidate, entry);
    if (existsSync(resolvedEntry)) {
      return resolvedEntry;
    }
  }

  return candidate;
}

function readPackageJson(packageJsonPath: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function findPackageEntry(packageJson: Record<string, unknown> | undefined): string | undefined {
  if (!packageJson) {
    return undefined;
  }

  const exportsEntry = packageJson.exports;
  if (typeof exportsEntry === "object" && exportsEntry !== null) {
    const rootExport = (exportsEntry as Record<string, unknown>)["."];
    if (typeof rootExport === "object" && rootExport !== null) {
      const importEntry = (rootExport as Record<string, unknown>).import;
      if (typeof importEntry === "string") {
        return importEntry;
      }
    }
  }

  return typeof packageJson.module === "string"
    ? packageJson.module
    : typeof packageJson.main === "string"
      ? packageJson.main
      : undefined;
}

function toImportSpecifier(resolvedPathOrModule: string): string {
  if (
    resolvedPathOrModule.startsWith(".") ||
    resolvedPathOrModule.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(resolvedPathOrModule)
  ) {
    return pathToFileURL(resolvedPathOrModule).href;
  }

  return resolvedPathOrModule;
}

function assertPositiveBigInt(value: bigint, fieldName: string): bigint {
  assertPositiveNumber(Number(value), fieldName);
  if (value <= 0n) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${fieldName} must be a positive bigint.`);
  }
  return value;
}
