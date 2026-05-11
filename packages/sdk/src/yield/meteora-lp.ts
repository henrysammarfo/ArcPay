import { wrapExternalError } from "../errors.js";
import { assertNonEmptyString, assertUrl } from "../validation.js";

const DEFAULT_LP_AGENT_API_BASE_URL = "https://api.lpagent.io/open-api/v1";

export interface LpAgentRestClientParams {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export interface LpAgentPoolInfoParams {
  readonly poolId: string;
}

export interface LpAgentPositionsParams {
  readonly ownerAddress: string;
}

export interface LpAgentZapInParams {
  readonly poolId: string;
  readonly ownerAddress: string;
  readonly inputSol: number;
  readonly percentX?: number;
  readonly fromBinId?: number;
  readonly toBinId?: number;
  readonly amountX?: number;
  readonly amountY?: number;
  readonly strategy?: "Spot" | "Curve" | "BidAsk";
  readonly provider?: "OKX" | "JUPITER_ULTRA";
  readonly slippageBps?: number;
}

export interface LpAgentPoolInfo {
  readonly poolId: string;
  readonly raw: unknown;
}

export interface LpAgentPositions {
  readonly ownerAddress: string;
  readonly positionCount: number;
  readonly raw: unknown;
}

export interface LpAgentZapInTransaction {
  readonly poolId: string;
  readonly ownerAddress: string;
  readonly transactionCount: number;
  readonly transactions: readonly string[];
  readonly raw: unknown;
}

export interface LpAgentRestClient {
  readonly getPoolInfo: (params: LpAgentPoolInfoParams) => Promise<LpAgentPoolInfo>;
  readonly getPositions: (params: LpAgentPositionsParams) => Promise<LpAgentPositions>;
  readonly generateZapInTransaction: (
    params: LpAgentZapInParams,
  ) => Promise<LpAgentZapInTransaction>;
}

/**
 * Creates an LP Agent REST client using the official open API authentication
 * shape: `x-api-key` header against `/open-api/v1` endpoints.
 */
export function createLpAgentRestClient(params: LpAgentRestClientParams): LpAgentRestClient {
  const apiKey = assertNonEmptyString(params.apiKey, "apiKey");
  const baseUrl = normalizeBaseUrl(params.baseUrl ?? DEFAULT_LP_AGENT_API_BASE_URL);
  const fetcher = params.fetchImpl ?? fetch;

  return {
    async getPoolInfo({ poolId }: LpAgentPoolInfoParams): Promise<LpAgentPoolInfo> {
      const validatedPoolId = assertNonEmptyString(poolId, "poolId");

      try {
        const raw = await requestJson(
          fetcher,
          apiKey,
          `${baseUrl}/pools/${encodeURIComponent(validatedPoolId)}/info`,
        );

        return {
          poolId: validatedPoolId,
          raw,
        };
      } catch (cause) {
        throw wrapExternalError("LP Agent", "pool info fetch", cause);
      }
    },

    async getPositions({ ownerAddress }: LpAgentPositionsParams): Promise<LpAgentPositions> {
      const owner = assertNonEmptyString(ownerAddress, "ownerAddress");
      const url = new URL(`${baseUrl}/lp-positions/opening`);
      url.searchParams.set("owner", owner);

      try {
        const raw = await requestJson(fetcher, apiKey, url.toString());

        return {
          ownerAddress: owner,
          positionCount: countPositions(raw),
          raw,
        };
      } catch (cause) {
        throw wrapExternalError("LP Agent", "positions fetch", cause);
      }
    },

    async generateZapInTransaction(
      params: LpAgentZapInParams,
    ): Promise<LpAgentZapInTransaction> {
      const poolId = assertNonEmptyString(params.poolId, "poolId");
      const ownerAddress = assertNonEmptyString(params.ownerAddress, "ownerAddress");
      const inputSol = validatePositiveNumber(params.inputSol, "inputSol");
      const slippageBps = validateSlippageBps(params.slippageBps);
      const percentX = validateOptionalPercentage(params.percentX, "percentX");

      try {
        const raw = await requestJson(
          fetcher,
          apiKey,
          `${baseUrl}/pools/${encodeURIComponent(poolId)}/add-tx`,
          {
            body: JSON.stringify({
              amountX: params.amountX,
              amountY: params.amountY,
              fromBinId: params.fromBinId,
              inputSOL: inputSol,
              mode: "zap-in",
              owner: ownerAddress,
              percentX,
              provider: params.provider ?? "JUPITER_ULTRA",
              slippage_bps: slippageBps,
              stratergy: params.strategy ?? "Spot",
              toBinId: params.toBinId,
            }),
            method: "POST",
          },
        );
        const transactions = extractSerializedTransactions(raw);

        return {
          poolId,
          ownerAddress,
          transactionCount: transactions.length,
          transactions,
          raw,
        };
      } catch (cause) {
        throw wrapExternalError("LP Agent", "zap-in transaction generation", cause);
      }
    },
  };
}

async function requestJson(
  fetcher: typeof fetch,
  apiKey: string,
  url: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetcher(url, {
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      "x-api-key": apiKey,
      accept: "application/json",
      ...init.headers,
    },
    ...init,
    method: init.method ?? "GET",
  });

  if (!response.ok) {
    throw new Error(`LP Agent responded with HTTP ${response.status}.`);
  }

  return response.json();
}

function normalizeBaseUrl(value: string): string {
  const url = assertUrl(value, "baseUrl");
  return url.replace(/\/+$/, "");
}

function validateSlippageBps(value: number | undefined): number {
  if (value === undefined) {
    return 50;
  }

  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error("slippageBps must be an integer from 0 to 10000.");
  }

  return value;
}

function validatePositiveNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive number.`);
  }

  return value;
}

function validateOptionalPercentage(
  value: number | undefined,
  fieldName: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${fieldName} must be a number from 0 to 1.`);
  }

  return value;
}

function countPositions(raw: unknown): number {
  if (Array.isArray(raw)) {
    return raw.length;
  }

  if (isRecord(raw)) {
    if (typeof raw.count === "number" && Number.isInteger(raw.count) && raw.count >= 0) {
      return raw.count;
    }

    const data = raw.data;
    if (Array.isArray(data)) {
      return data.length;
    }

    const positions = raw.positions;
    if (Array.isArray(positions)) {
      return positions.length;
    }
  }

  return 0;
}

function extractSerializedTransactions(raw: unknown): readonly string[] {
  const candidates = collectTransactionCandidates(raw);
  const transactions = candidates.filter((candidate): candidate is string =>
    typeof candidate === "string" && candidate.trim().length > 0,
  );

  if (transactions.length === 0) {
    throw new Error("LP Agent zap-in response did not include serialized transactions.");
  }

  return transactions;
}

function collectTransactionCandidates(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectTransactionCandidates);
  }

  if (!isRecord(value)) {
    return [];
  }

  const directCandidates = [
    value.transaction,
    value.transactions,
    value.tx,
    value.txs,
    value.serializedTransaction,
    value.serializedTransactions,
    value.swapTxsWithJito,
    value.addLiquidityTxsWithJito,
  ];
  const nestedCandidates = isRecord(value.data) ? collectTransactionCandidates(value.data) : [];

  return directCandidates.flatMap((candidate) =>
    Array.isArray(candidate) ? candidate : [candidate],
  ).concat(nestedCandidates);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
