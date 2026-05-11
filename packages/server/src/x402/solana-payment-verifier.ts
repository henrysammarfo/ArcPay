import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { Connection, type ParsedTransactionWithMeta } from "@solana/web3.js";
import type { Request } from "express";
import type { AgentEndpointConfig } from "./config.js";
import type { PaymentVerifier } from "./payment-middleware.js";

const DEFAULT_MAX_TRANSACTION_AGE_MS = 10 * 60 * 1000;
const SOLANA_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{64,96}$/;

export interface SolanaPaymentProof {
  readonly signature: string;
}

export interface PaymentReplayStore {
  claim(key: string, expiresAtMs: number): Promise<boolean>;
}

export interface SolanaPaymentVerifierOptions {
  readonly connection: Pick<Connection, "getParsedTransaction">;
  readonly replayStore: PaymentReplayStore;
  readonly maxTransactionAgeMs?: number;
  readonly now?: () => number;
}

/**
 * Verifies production ArcPay x402 payment proofs against Solana transaction data.
 *
 * Expected `x-payment` formats:
 * - JSON: `{"signature":"..."}`
 * - base64/base64url-encoded JSON with the same shape
 * - raw Solana transaction signature
 */
export class SolanaPaymentVerifier implements PaymentVerifier {
  private readonly connection: Pick<Connection, "getParsedTransaction">;
  private readonly replayStore: PaymentReplayStore;
  private readonly maxTransactionAgeMs: number;
  private readonly now: () => number;

  public constructor(options: SolanaPaymentVerifierOptions) {
    this.connection = options.connection;
    this.replayStore = options.replayStore;
    this.maxTransactionAgeMs = options.maxTransactionAgeMs ?? DEFAULT_MAX_TRANSACTION_AGE_MS;
    this.now = options.now ?? (() => Date.now());
  }

  public async verify(request: Request, endpoint: AgentEndpointConfig): Promise<boolean> {
    const proof = parsePaymentProof(request.header("x-payment"));

    if (!proof) {
      return false;
    }

    const transaction = await this.connection.getParsedTransaction(proof.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction || transaction.meta?.err) {
      return false;
    }

    if (isStaleTransaction(transaction, this.now(), this.maxTransactionAgeMs)) {
      return false;
    }

    if (!hasTokenPayment(transaction, endpoint)) {
      return false;
    }

    return this.replayStore.claim(createReplayKey(endpoint, proof.signature), this.now() + this.maxTransactionAgeMs);
  }
}

/**
 * In-memory replay protection for tests and single-process development.
 */
export class InMemoryPaymentReplayStore implements PaymentReplayStore {
  private readonly seen = new Map<string, number>();
  private readonly now: () => number;

  public constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  public async claim(key: string, expiresAtMs: number): Promise<boolean> {
    this.prune();

    if (this.seen.has(key)) {
      return false;
    }

    this.seen.set(key, expiresAtMs);
    return true;
  }

  private prune(): void {
    const now = this.now();

    for (const [key, expiresAtMs] of this.seen.entries()) {
      if (expiresAtMs <= now) {
        this.seen.delete(key);
      }
    }
  }
}

/**
 * File-backed replay protection for a single production process.
 *
 * This persists across restarts. Multi-instance deployments should replace this
 * with a database or Redis implementation that provides atomic inserts.
 */
export class FilePaymentReplayStore implements PaymentReplayStore {
  private readonly path: string;
  private readonly now: () => number;

  public constructor(path: string, now: () => number = () => Date.now()) {
    this.path = path;
    this.now = now;
  }

  public async claim(key: string, expiresAtMs: number): Promise<boolean> {
    const entries = await this.readEntries();
    const now = this.now();

    for (const [entryKey, entryExpiresAtMs] of Object.entries(entries)) {
      if (entryExpiresAtMs <= now) {
        delete entries[entryKey];
      }
    }

    if (entries[key] !== undefined) {
      return false;
    }

    entries[key] = expiresAtMs;
    await fs.mkdir(dirname(this.path), { recursive: true });
    await fs.writeFile(`${this.path}.tmp`, JSON.stringify(entries, null, 2), "utf8");
    await fs.rename(`${this.path}.tmp`, this.path);

    return true;
  }

  private async readEntries(): Promise<Record<string, number>> {
    try {
      const raw = await fs.readFile(this.path, "utf8");
      const parsed = JSON.parse(raw) as unknown;

      if (!isReplayRecord(parsed)) {
        return {};
      }

      return parsed;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }
}

export function parsePaymentProof(headerValue: string | undefined): SolanaPaymentProof | null {
  if (!headerValue) {
    return null;
  }

  const value = headerValue.trim();

  if (SOLANA_SIGNATURE_PATTERN.test(value)) {
    return { signature: value };
  }

  const parsed = parseJsonProof(value) ?? parseJsonProof(decodeBase64Json(value));

  if (!parsed || !SOLANA_SIGNATURE_PATTERN.test(parsed.signature)) {
    return null;
  }

  return parsed;
}

export function hasTokenPayment(
  transaction: ParsedTransactionWithMeta,
  endpoint: AgentEndpointConfig,
): boolean {
  const balances = transaction.meta?.postTokenBalances ?? [];

  for (const postBalance of balances) {
    if (postBalance.mint !== endpoint.price.mint || postBalance.owner !== endpoint.payTo) {
      continue;
    }

    const preBalance = transaction.meta?.preTokenBalances?.find(
      (candidate) => candidate.accountIndex === postBalance.accountIndex && candidate.mint === postBalance.mint,
    );
    const postAmount = BigInt(postBalance.uiTokenAmount.amount);
    const preAmount = BigInt(preBalance?.uiTokenAmount.amount ?? "0");
    const delta = postAmount - preAmount;
    const requiredAmount = decimalToAtomic(endpoint.price.amount, postBalance.uiTokenAmount.decimals);

    if (delta >= requiredAmount) {
      return true;
    }
  }

  return false;
}

function isStaleTransaction(
  transaction: ParsedTransactionWithMeta,
  nowMs: number,
  maxTransactionAgeMs: number,
): boolean {
  if (transaction.blockTime === null || transaction.blockTime === undefined) {
    return true;
  }

  return nowMs - transaction.blockTime * 1000 > maxTransactionAgeMs;
}

function createReplayKey(endpoint: AgentEndpointConfig, signature: string): string {
  return `${endpoint.method}:${endpoint.path}:${endpoint.price.mint}:${signature}`;
}

function decimalToAtomic(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0n;
  }

  const fixed = amount.toFixed(decimals);
  const [whole = "0", fraction = ""] = fixed.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);

  return BigInt(`${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "") || "0");
}

function parseJsonProof(value: string | null): SolanaPaymentProof | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "signature" in parsed &&
      typeof parsed.signature === "string"
    ) {
      return { signature: parsed.signature.trim() };
    }
  } catch {
    return null;
  }

  return null;
}

function decodeBase64Json(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function isReplayRecord(value: unknown): value is Record<string, number> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}
