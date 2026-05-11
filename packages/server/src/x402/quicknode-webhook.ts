import type { Request, Response } from "express";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const QUICKNODE_WEBHOOK_SECRET_HEADER = "x-arcpay-webhook-secret";
export const QUICKNODE_SIGNATURE_HEADER = "x-qn-signature";
export const QUICKNODE_NONCE_HEADER = "x-qn-nonce";
export const QUICKNODE_CONTENT_HASH_HEADER = "x-qn-content-hash";
export const QUICKNODE_TIMESTAMP_HEADER = "x-qn-timestamp";
export const QUICKNODE_DIRECT_TOKEN_HEADERS = [
  QUICKNODE_WEBHOOK_SECRET_HEADER,
  "authorization",
  "x-qn-token",
  "x-qn-security-token",
  "x-quicknode-token",
  "x-quicknode-security-token",
  "x-validation-token",
] as const;

export interface QuickNodeWebhookStore {
  readonly securityConfigured: boolean;
  readonly liveProof: boolean;
  readonly receivedCount: number;
  readonly latestEvent?: QuickNodeWebhookEvent;
  record(payload: unknown, receivedAt?: Date): QuickNodeWebhookEvent;
  status(): QuickNodeWebhookStatus;
}

export interface QuickNodeWebhookEvent {
  readonly source: "quicknode-webhook";
  readonly liveProof: true;
  readonly receivedAt: string;
  readonly eventId: string;
  readonly payload: unknown;
}

export interface QuickNodeWebhookStatus {
  readonly source: "quicknode-webhook";
  readonly liveProof: boolean;
  readonly securityConfigured: boolean;
  readonly receivedCount: number;
  readonly latestEvent?: QuickNodeWebhookEvent;
  readonly nextRequiredItems: readonly string[];
}

export class InMemoryQuickNodeWebhookStore implements QuickNodeWebhookStore {
  readonly securityConfigured: boolean;
  protected events: QuickNodeWebhookEvent[] = [];

  constructor(options: {
    readonly securityConfigured: boolean;
    readonly initialEvents?: readonly QuickNodeWebhookEvent[];
  }) {
    this.securityConfigured = options.securityConfigured;
    this.events = [...(options.initialEvents ?? [])];
  }

  get liveProof(): boolean {
    return this.events.length > 0;
  }

  get receivedCount(): number {
    return this.events.length;
  }

  get latestEvent(): QuickNodeWebhookEvent | undefined {
    return this.events.at(-1);
  }

  record(payload: unknown, receivedAt = new Date()): QuickNodeWebhookEvent {
    const event: QuickNodeWebhookEvent = {
      source: "quicknode-webhook",
      liveProof: true,
      receivedAt: receivedAt.toISOString(),
      eventId: extractEventId(payload, this.events.length + 1),
      payload,
    };

    this.events.push(event);
    return event;
  }

  status(): QuickNodeWebhookStatus {
    return {
      source: "quicknode-webhook",
      liveProof: this.liveProof,
      securityConfigured: this.securityConfigured,
      receivedCount: this.receivedCount,
      latestEvent: this.latestEvent,
      nextRequiredItems: this.liveProof
        ? []
        : [
            "Create a QuickNode Solana webhook that POSTs to /webhooks/quicknode.",
            `Configure the webhook custom header ${QUICKNODE_WEBHOOK_SECRET_HEADER} if QUICKNODE_WEBHOOK_SECRET is set.`,
            "Trigger a devnet transaction involving the watched wallet or program, then check /live/quicknode.",
          ],
    };
  }
}

/**
 * File-backed QuickNode proof storage for local and single-process deployments.
 *
 * This keeps webhook proof visible after server restarts. Multi-instance
 * deployments should replace it with database-backed storage.
 */
export class FileQuickNodeWebhookStore extends InMemoryQuickNodeWebhookStore {
  private static readonly maxPersistedEvents = 20;
  private readonly path: string;

  constructor(options: { readonly path: string; readonly securityConfigured: boolean }) {
    super({
      securityConfigured: options.securityConfigured,
      initialEvents: readPersistedQuickNodeEvents(options.path),
    });
    this.path = options.path;
  }

  override record(payload: unknown, receivedAt = new Date()): QuickNodeWebhookEvent {
    const event = super.record(payload, receivedAt);
    this.persist();
    return event;
  }

  private persist(): void {
    const directory = dirname(this.path);
    mkdirSync(directory, { recursive: true });
    const payload = {
      events: this.events.slice(-FileQuickNodeWebhookStore.maxPersistedEvents),
    };
    writeFileSync(`${this.path}.tmp`, JSON.stringify(payload, null, 2), "utf8");
    renameSync(`${this.path}.tmp`, this.path);
  }
}

export function verifyQuickNodeWebhookSecret(
  request: Request,
  response: Response,
  expectedSecret?: string,
): boolean {
  if (expectedSecret === undefined) {
    return true;
  }

  if (hasMatchingDirectToken(request, expectedSecret) || verifyQuickNodeSignature(request, expectedSecret)) {
    return true;
  }

  {
    response.status(401).json({
      error: "QUICKNODE_WEBHOOK_UNAUTHORIZED",
      message: "QuickNode webhook signature or secret is missing or invalid.",
      liveProof: false,
    });
    return false;
  }
}

function hasMatchingDirectToken(request: Request, expectedSecret: string): boolean {
  return QUICKNODE_DIRECT_TOKEN_HEADERS.some((headerName) => {
    const value = request.header(headerName);
    if (typeof value !== "string") {
      return false;
    }

    return safeEquals(normalizeAuthToken(value), expectedSecret);
  });
}

function normalizeAuthToken(value: string): string {
  const trimmed = value.trim();
  const bearerPrefix = "Bearer ";

  if (trimmed.toLowerCase().startsWith(bearerPrefix.toLowerCase())) {
    return trimmed.slice(bearerPrefix.length).trim();
  }

  return trimmed;
}

export function validateQuickNodeWebhookPayload(payload: unknown): void {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("QuickNode webhook payload must be a JSON object or non-empty array.");
  }

  if (Array.isArray(payload) && payload.length === 0) {
    throw new Error("QuickNode webhook payload must be a JSON object or non-empty array.");
  }
}

function extractEventId(payload: unknown, fallbackId: number): string {
  if (Array.isArray(payload)) {
    return extractEventId(payload[0], fallbackId);
  }

  if (typeof payload !== "object" || payload === null) {
    return `quicknode-${fallbackId}`;
  }

  const candidates = ["id", "eventId", "event_id", "signature", "transactionSignature"];
  for (const key of candidates) {
    if (key in payload) {
      const value = (payload as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  const transactions = (payload as Record<string, unknown>).transactions;
  if (Array.isArray(transactions)) {
    const transactionId = extractEventId(transactions[0], fallbackId);
    if (transactionId !== `quicknode-${fallbackId}`) {
      return transactionId;
    }
  }

  const block = (payload as Record<string, unknown>).block;
  if (typeof block === "object" && block !== null) {
    const blockHash = (block as Record<string, unknown>).blockhash;
    if (typeof blockHash === "string" && blockHash.trim().length > 0) {
      return blockHash.trim();
    }
  }

  return `quicknode-${fallbackId}`;
}

function verifyQuickNodeSignature(request: Request, expectedSecret: string): boolean {
  const signature = request.header(QUICKNODE_SIGNATURE_HEADER);
  const nonce = request.header(QUICKNODE_NONCE_HEADER);
  const timestamp = request.header(QUICKNODE_TIMESTAMP_HEADER);

  if (
    typeof signature !== "string" ||
    typeof nonce !== "string" ||
    typeof timestamp !== "string"
  ) {
    return false;
  }

  const contentHashCandidates = createContentHashCandidates(request);
  const payload = getRawBody(request).toString("utf8");
  const directPayloadCandidates = [
    createHmac("sha256", expectedSecret).update(`${nonce}${timestamp}${payload}`).digest("hex"),
    createHmac("sha256", expectedSecret).update(`${nonce}${timestamp}${payload}`).digest("base64"),
  ];

  const contentHashSignatureCandidates = contentHashCandidates.flatMap((contentHash) => [
    createHmac("sha256", expectedSecret)
      .update(`${nonce}${contentHash}${timestamp}`)
      .digest("base64"),
    createHmac("sha256", expectedSecret)
      .update(`${nonce}${contentHash}${timestamp}`)
      .digest("hex"),
  ]);

  return [...directPayloadCandidates, ...contentHashSignatureCandidates].some((expected) =>
    safeEquals(signature, expected),
  );
}

function createContentHashCandidates(request: Request): readonly string[] {
  const rawBody = getRawBody(request);
  const configuredHash = request.header(QUICKNODE_CONTENT_HASH_HEADER);
  const candidates = new Set<string>();

  if (typeof configuredHash === "string" && configuredHash.length > 0) {
    candidates.add(configuredHash);
  }

  // QuickNode webhook products have had small historical differences in the
  // content-hash input. Support body-only and path+body variants while still
  // requiring HMAC proof.
  const bodyHashHex = createHashHex(rawBody);
  const bodyHashBase64 = createHashBase64(rawBody);
  candidates.add(bodyHashHex);
  candidates.add(bodyHashBase64);
  candidates.add(createHashHex(Buffer.concat([Buffer.from(request.path), rawBody])));
  candidates.add(createHashBase64(Buffer.concat([Buffer.from(request.path), rawBody])));

  return [...candidates];
}

function getRawBody(request: Request): Buffer {
  const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
  if (Buffer.isBuffer(rawBody)) {
    return rawBody;
  }

  return Buffer.from(JSON.stringify(request.body ?? {}));
}

function createHashHex(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function createHashBase64(value: Buffer): string {
  return createHash("sha256").update(value).digest("base64");
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function readPersistedQuickNodeEvents(path: string): readonly QuickNodeWebhookEvent[] {
  if (!existsSync(path)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;

  if (!isPersistedQuickNodeStore(parsed)) {
    return [];
  }

  return parsed.events;
}

function isPersistedQuickNodeStore(
  value: unknown,
): value is { readonly events: readonly QuickNodeWebhookEvent[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "events" in value &&
    Array.isArray(value.events) &&
    value.events.every(isQuickNodeWebhookEvent)
  );
}

function isQuickNodeWebhookEvent(value: unknown): value is QuickNodeWebhookEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "source" in value &&
    value.source === "quicknode-webhook" &&
    "liveProof" in value &&
    value.liveProof === true &&
    "receivedAt" in value &&
    typeof value.receivedAt === "string" &&
    "eventId" in value &&
    typeof value.eventId === "string" &&
    "payload" in value
  );
}
