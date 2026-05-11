import { ArcPaySdkError, wrapExternalError } from "../errors.js";
import { assertNonEmptyString, assertPositiveNumber } from "../validation.js";
import type { DFlowClient, SwapResult } from "../types.js";

const DEFAULT_DFLOW_BASE_URL = "https://quote-api.dflow.net";

export interface ExecuteOptimalSwapParams {
  readonly fromMint: string;
  readonly toMint: string;
  readonly amount: number;
  readonly slippageBps: number;
}

export interface DFlowRestClientOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export interface DFlowIntentQuoteParams {
  readonly inputMint: string;
  readonly outputMint: string;
  readonly amount: number | bigint;
  readonly slippageBps: number | "auto";
  readonly userPublicKey?: string;
  readonly priceImpactTolerancePct?: number;
  readonly platformFeeBps?: number;
  readonly feeAccount?: string;
  readonly referralAccount?: string;
  readonly wrapAndUnwrapSol?: boolean;
  readonly feeBudget?: number | bigint;
  readonly maxAutoFeeBudget?: number | bigint;
}

export interface DFlowOrderParams extends DFlowIntentQuoteParams {
  readonly destinationWallet?: string;
  readonly destinationTokenAccount?: string;
  readonly revertWallet?: string;
  readonly prioritizationFeeLamports?: number | "auto" | "medium" | "high" | "veryHigh" | "disabled";
  readonly prioritizationFeeMaxLamports?: number;
  readonly dynamicComputeUnitLimit?: boolean;
  readonly includeAddressLookupTables?: boolean;
}

export interface DFlowIntentQuote {
  readonly feeBudget: number;
  readonly inAmount: string;
  readonly inputMint: string;
  readonly minOutAmount: string;
  readonly otherAmountThreshold: string;
  readonly outAmount: string;
  readonly outputMint: string;
  readonly priceImpactPct: string;
  readonly slippageBps: number;
  readonly expiry?: {
    readonly slotsAfterOpen: number;
  };
  readonly lastValidBlockHeight?: number;
  readonly openTransaction?: string;
  readonly platformFee?: unknown;
}

export interface DFlowOrder {
  readonly contextSlot: number;
  readonly executionMode: "sync" | "async";
  readonly inAmount: string;
  readonly inputMint: string;
  readonly minOutAmount: string;
  readonly otherAmountThreshold: string;
  readonly outAmount: string;
  readonly outputMint: string;
  readonly priceImpactPct: string;
  readonly slippageBps: number;
  readonly lastValidBlockHeight?: number;
  readonly routePlan?: unknown[];
  readonly transaction?: string;
  readonly platformFee?: unknown;
}

export interface DFlowSubmitIntentParams {
  readonly quoteResponse: DFlowIntentQuote;
  readonly signedOpenTransaction: string;
}

export interface DFlowSubmitIntentResult {
  readonly openTransactionSignature: string;
  readonly orderAddress: string;
  readonly programId: string;
}

export interface DFlowRestClient extends DFlowClient {
  getOrder(params: DFlowOrderParams): Promise<DFlowOrder>;
  getIntentQuote(params: DFlowIntentQuoteParams): Promise<DFlowIntentQuote>;
  submitIntent(params: DFlowSubmitIntentParams): Promise<DFlowSubmitIntentResult>;
}

/**
 * Executes a MEV-resistant swap through an injected DFlow-compatible client.
 */
export async function executeOptimalSwap(
  dflow: DFlowClient,
  params: ExecuteOptimalSwapParams,
): Promise<SwapResult> {
  const fromMint = assertNonEmptyString(params.fromMint, "fromMint");
  const toMint = assertNonEmptyString(params.toMint, "toMint");
  const amount = assertPositiveNumber(params.amount, "amount");
  const slippageBps = assertPositiveNumber(params.slippageBps, "slippageBps");

  try {
    const quote = await dflow.getQuote({ fromMint, toMint, amount, slippageBps });
    const swap = await dflow.executeSwap(quote);
    const received = Number(swap.outAmount);

    if (!Number.isFinite(received) || received < 0) {
      throw new Error("DFlow swap returned an invalid output amount.");
    }

    return {
      received,
      txId: swap.txId,
      mevProtected: true,
    };
  } catch (cause) {
    throw wrapExternalError("DFlow", "optimal swap execution", cause);
  }
}

/**
 * Creates a DFlow REST client for production quote and declarative-intent flows.
 *
 * DFlow execution is a signed transaction flow: request an intent quote, sign the
 * returned `openTransaction` with the treasury/user wallet, then call `submitIntent`.
 * This adapter intentionally refuses to fake `executeSwap` from an unsigned quote.
 */
export function createDFlowRestClient(options: DFlowRestClientOptions = {}): DFlowRestClient {
  const baseUrl = (options.baseUrl ?? DEFAULT_DFLOW_BASE_URL).replace(/\/+$/, "");
  const fetcher = options.fetchImpl ?? fetch;

  return {
    async getQuote(params) {
      const query = buildDFlowQuery({
        inputMint: params.fromMint,
        outputMint: params.toMint,
        amount: params.amount,
        slippageBps: params.slippageBps,
      });
      const response = await requestDFlow({
        apiKey: options.apiKey,
        fetcher,
        url: `${baseUrl}/quote?${query.toString()}`,
      });

      return validateDFlowQuoteResponse(response);
    },

    async getOrder(params) {
      const query = buildDFlowOrderQuery(params);
      const response = await requestDFlow({
        apiKey: options.apiKey,
        fetcher,
        url: `${baseUrl}/order?${query.toString()}`,
      });

      return validateDFlowOrder(response);
    },

    async executeSwap() {
      throw new ArcPaySdkError(
        "UNSUPPORTED_OPERATION",
        "DFlow REST execution requires a signed declarative intent. Use getIntentQuote, sign openTransaction, then submitIntent.",
      );
    },

    async getIntentQuote(params) {
      const query = buildDFlowQuery(params);
      const response = await requestDFlow({
        apiKey: options.apiKey,
        fetcher,
        url: `${baseUrl}/intent?${query.toString()}`,
      });

      return validateDFlowIntentQuote(response);
    },

    async submitIntent(params) {
      assertNonEmptyString(params.signedOpenTransaction, "signedOpenTransaction");
      validateDFlowIntentQuote(params.quoteResponse);

      const response = await requestDFlow({
        apiKey: options.apiKey,
        fetcher,
        url: `${baseUrl}/submit-intent`,
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(params),
        },
      });

      return validateDFlowSubmitIntentResult(response);
    },
  };
}

function buildDFlowOrderQuery(params: DFlowOrderParams): URLSearchParams {
  const query = buildDFlowQuery(params);

  appendOptionalString(query, "destinationWallet", params.destinationWallet);
  appendOptionalString(query, "destinationTokenAccount", params.destinationTokenAccount);
  appendOptionalString(query, "revertWallet", params.revertWallet);
  appendOptionalPrioritizationFee(query, params.prioritizationFeeLamports);
  appendOptionalNumber(query, "prioritizationFeeMaxLamports", params.prioritizationFeeMaxLamports);

  if (params.dynamicComputeUnitLimit !== undefined) {
    query.set("dynamicComputeUnitLimit", String(params.dynamicComputeUnitLimit));
  }

  if (params.includeAddressLookupTables !== undefined) {
    query.set("includeAddressLookupTables", String(params.includeAddressLookupTables));
  }

  return query;
}

function buildDFlowQuery(params: DFlowIntentQuoteParams): URLSearchParams {
  const query = new URLSearchParams();
  query.set("inputMint", assertNonEmptyString(params.inputMint, "inputMint"));
  query.set("outputMint", assertNonEmptyString(params.outputMint, "outputMint"));
  query.set("amount", normalizeScaledAmount(params.amount, "amount"));
  query.set("slippageBps", params.slippageBps === "auto" ? "auto" : normalizeNonNegativeNumber(params.slippageBps, "slippageBps"));

  appendOptionalString(query, "userPublicKey", params.userPublicKey);
  appendOptionalString(query, "feeAccount", params.feeAccount);
  appendOptionalString(query, "referralAccount", params.referralAccount);
  appendOptionalNumber(query, "priceImpactTolerancePct", params.priceImpactTolerancePct);
  appendOptionalNumber(query, "platformFeeBps", params.platformFeeBps);
  appendOptionalAmount(query, "feeBudget", params.feeBudget);
  appendOptionalAmount(query, "maxAutoFeeBudget", params.maxAutoFeeBudget);

  if (params.wrapAndUnwrapSol !== undefined) {
    query.set("wrapAndUnwrapSol", String(params.wrapAndUnwrapSol));
  }

  return query;
}

async function requestDFlow(params: {
  readonly apiKey?: string;
  readonly fetcher: typeof fetch;
  readonly url: string;
  readonly init?: RequestInit;
}): Promise<unknown> {
  const headers = new Headers(params.init?.headers);

  if (params.apiKey) {
    headers.set("x-api-key", params.apiKey);
  }

  try {
    const response = await params.fetcher(params.url, {
      ...params.init,
      headers,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const suffix = body.trim() ? ` Body: ${body.slice(0, 500)}` : "";
      throw new Error(`DFlow responded with HTTP ${response.status}.${suffix}`);
    }

    return await response.json() as unknown;
  } catch (cause) {
    throw wrapExternalError("DFlow", "REST request", cause);
  }
}

function validateDFlowQuoteResponse(value: unknown): {
  readonly outAmount: string;
  readonly requestId?: string;
} {
  const payload = requireObject(value, "DFlow quote response");
  const outAmount = requireString(payload, "outAmount");
  const requestId = optionalString(payload, "requestId");
  validateNumericString(outAmount, "outAmount");

  return { outAmount, requestId };
}

function validateDFlowIntentQuote(value: unknown): DFlowIntentQuote {
  const payload = requireObject(value, "DFlow intent quote");
  const expiry = optionalObject(payload, "expiry");
  const quote: DFlowIntentQuote = {
    feeBudget: requireFiniteNumber(payload, "feeBudget"),
    inAmount: requireNumericString(payload, "inAmount"),
    inputMint: requireString(payload, "inputMint"),
    minOutAmount: requireNumericString(payload, "minOutAmount"),
    otherAmountThreshold: requireNumericString(payload, "otherAmountThreshold"),
    outAmount: requireNumericString(payload, "outAmount"),
    outputMint: requireString(payload, "outputMint"),
    priceImpactPct: requireNumericString(payload, "priceImpactPct"),
    slippageBps: requireFiniteNumber(payload, "slippageBps"),
    expiry: expiry
      ? {
          slotsAfterOpen: requireFiniteNumber(expiry, "slotsAfterOpen"),
        }
      : undefined,
    lastValidBlockHeight: optionalFiniteNumber(payload, "lastValidBlockHeight"),
    openTransaction: optionalString(payload, "openTransaction"),
    platformFee: payload.platformFee,
  };

  if (quote.openTransaction && !quote.lastValidBlockHeight) {
    throw new Error("DFlow intent quote included openTransaction without lastValidBlockHeight.");
  }

  return quote;
}

function validateDFlowOrder(value: unknown): DFlowOrder {
  const payload = requireObject(value, "DFlow order");
  const executionMode = requireString(payload, "executionMode");

  if (executionMode !== "sync" && executionMode !== "async") {
    throw new Error("DFlow response field executionMode must be sync or async.");
  }

  return {
    contextSlot: requireFiniteNumber(payload, "contextSlot"),
    executionMode,
    inAmount: requireNumericString(payload, "inAmount"),
    inputMint: requireString(payload, "inputMint"),
    minOutAmount: requireNumericString(payload, "minOutAmount"),
    otherAmountThreshold: requireNumericString(payload, "otherAmountThreshold"),
    outAmount: requireNumericString(payload, "outAmount"),
    outputMint: requireString(payload, "outputMint"),
    priceImpactPct: requireNumericString(payload, "priceImpactPct"),
    slippageBps: requireFiniteNumber(payload, "slippageBps"),
    lastValidBlockHeight: optionalFiniteNumber(payload, "lastValidBlockHeight"),
    routePlan: optionalArray(payload, "routePlan"),
    transaction: optionalString(payload, "transaction"),
    platformFee: payload.platformFee,
  };
}

function validateDFlowSubmitIntentResult(value: unknown): DFlowSubmitIntentResult {
  const payload = requireObject(value, "DFlow submit intent response");

  return {
    openTransactionSignature: requireString(payload, "openTransactionSignature"),
    orderAddress: requireString(payload, "orderAddress"),
    programId: requireString(payload, "programId"),
  };
}

function appendOptionalString(
  query: URLSearchParams,
  key: string,
  value: string | undefined,
): void {
  if (value !== undefined) {
    query.set(key, assertNonEmptyString(value, key));
  }
}

function appendOptionalNumber(
  query: URLSearchParams,
  key: string,
  value: number | undefined,
): void {
  if (value !== undefined) {
    query.set(key, normalizeNonNegativeNumber(value, key));
  }
}

function appendOptionalAmount(
  query: URLSearchParams,
  key: string,
  value: number | bigint | undefined,
): void {
  if (value !== undefined) {
    query.set(key, normalizeScaledAmount(value, key));
  }
}

function appendOptionalPrioritizationFee(
  query: URLSearchParams,
  value: DFlowOrderParams["prioritizationFeeLamports"],
): void {
  if (value === undefined) {
    return;
  }

  const allowedValues = new Set(["auto", "medium", "high", "veryHigh", "disabled"]);
  if (typeof value === "string") {
    if (!allowedValues.has(value)) {
      throw new ArcPaySdkError(
        "VALIDATION_ERROR",
        "prioritizationFeeLamports must be auto, medium, high, veryHigh, disabled, or a non-negative integer.",
      );
    }

    query.set("prioritizationFeeLamports", value);
    return;
  }

  query.set("prioritizationFeeLamports", normalizeNonNegativeNumber(value, "prioritizationFeeLamports"));
}

function normalizeScaledAmount(value: number | bigint, name: string): string {
  if (typeof value === "bigint") {
    if (value <= 0n) {
      throw new ArcPaySdkError("VALIDATION_ERROR", `${name} must be greater than zero.`);
    }

    return value.toString();
  }

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${name} must be a positive safe integer.`);
  }

  return value.toString();
}

function normalizeNonNegativeNumber(value: number, name: string): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${name} must be a non-negative safe integer.`);
  }

  return value.toString();
}

function requireObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function optionalObject(
  payload: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  if (payload[key] === undefined || payload[key] === null) {
    return undefined;
  }

  return requireObject(payload[key], key);
}

function optionalArray(payload: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = payload[key];
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`DFlow response field ${key} must be an array when present.`);
  }

  return value;
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`DFlow response field ${key} must be a non-empty string.`);
  }

  return value;
}

function optionalString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`DFlow response field ${key} must be a non-empty string when present.`);
  }

  return value;
}

function requireNumericString(payload: Record<string, unknown>, key: string): string {
  const value = requireString(payload, key);
  validateNumericString(value, key);
  return value;
}

function validateNumericString(value: string, key: string): void {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error(`DFlow response field ${key} must be numeric.`);
  }
}

function requireFiniteNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`DFlow response field ${key} must be numeric.`);
  }

  return value;
}

function optionalFiniteNumber(payload: Record<string, unknown>, key: string): number | undefined {
  if (payload[key] === undefined || payload[key] === null) {
    return undefined;
  }

  return requireFiniteNumber(payload, key);
}
