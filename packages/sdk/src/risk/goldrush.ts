import { wrapExternalError } from "../errors.js";
import { assertNonEmptyString } from "../validation.js";
import type {
  CounterpartyRecommendation,
  CounterpartyScore,
  GoldRushBalanceItem,
  GoldRushClientLike,
} from "../types.js";

const SOLANA_MAINNET_CHAIN_NAME = "solana-mainnet";
const DEFAULT_GOLDRUSH_BASE_URL = "https://api.covalenthq.com/v1";

export interface GoldRushRestClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

interface GoldRushApiResponse<T> {
  readonly data?: T;
  readonly error?: boolean;
  readonly error_message?: string;
}

interface GoldRushItemsResponse<T> {
  readonly items?: readonly T[];
}

/**
 * Scores a counterparty wallet before outgoing payment execution.
 */
export async function scoreCounterparty(
  goldRush: GoldRushClientLike,
  walletAddress: string,
): Promise<CounterpartyScore> {
  const wallet = assertNonEmptyString(walletAddress, "walletAddress");

  try {
    const [txHistory, balances] = await Promise.all([
      goldRush.TransactionService.getAllTransactionsForAddress(
        SOLANA_MAINNET_CHAIN_NAME,
        wallet,
        { pageSize: 50 },
      ),
      goldRush.BalanceService.getTokenBalancesForWalletAddress(
        SOLANA_MAINNET_CHAIN_NAME,
        wallet,
      ),
    ]);

    const txCount = txHistory.data?.items?.length ?? 0;
    const balanceItems = balances.data?.items ?? [];
    const score = calculateCounterpartyScore(txCount, balanceItems);

    return {
      wallet,
      score,
      txCount,
      recommendation: getRecommendation(score),
    };
  } catch (cause) {
    throw wrapExternalError("GoldRush", "counterparty scoring", cause);
  }
}

/**
 * Creates a REST-backed GoldRush client that satisfies ArcPay's narrow scoring contract.
 *
 * GoldRush documents Solana mainnet as `solana-mainnet`; ArcPay keeps this behind
 * a small adapter so the rest of the SDK does not depend on provider-specific shapes.
 */
export function createGoldRushRestClient(
  options: GoldRushRestClientOptions,
): GoldRushClientLike {
  const apiKey = assertNonEmptyString(options.apiKey, "apiKey");
  const baseUrl = (options.baseUrl ?? DEFAULT_GOLDRUSH_BASE_URL).replace(/\/+$/, "");
  const fetcher = options.fetchImpl ?? fetch;

  return {
    TransactionService: {
      async getAllTransactionsForAddress(chainName, walletAddress, params) {
        const wallet = assertNonEmptyString(walletAddress, "walletAddress");
        const pageSize = Math.max(1, Math.min(params.pageSize, 100));
        let data: GoldRushItemsResponse<unknown>;
        try {
          data = await fetchGoldRushItems<unknown>({
            apiKey,
            fetcher,
            url: `${baseUrl}/${encodeURIComponent(chainName)}/address/${encodeURIComponent(wallet)}/transactions_v3/?page-size=${pageSize}&no-logs=true`,
          });
        } catch (error) {
          if (isUnsupportedGoldRushEndpoint(error)) {
            data = { items: [] };
          } else {
            throw error;
          }
        }

        return { data: { items: data.items ?? [] } };
      },
    },
    BalanceService: {
      async getTokenBalancesForWalletAddress(chainName, walletAddress) {
        const wallet = assertNonEmptyString(walletAddress, "walletAddress");
        const data = await fetchGoldRushItems<GoldRushBalanceItem>({
          apiKey,
          fetcher,
          url: `${baseUrl}/${encodeURIComponent(chainName)}/address/${encodeURIComponent(wallet)}/balances_v2/?no-spam=true`,
        });

        return { data: { items: data.items ?? [] } };
      },
    },
  };
}

/**
 * Deterministic risk algorithm from the build bible, isolated for unit testing.
 */
export function calculateCounterpartyScore(
  txCount: number,
  balances: readonly GoldRushBalanceItem[],
): number {
  let score = 50;

  if (txCount > 100) {
    score += 20;
  }

  if (txCount > 500) {
    score += 10;
  }

  if (txCount < 5) {
    score -= 30;
  }

  const hasStableBalance = balances.some(
    (balance) =>
      balance.contract_ticker_symbol === "USDC" && Number(balance.balance ?? 0) > 0,
  );

  if (hasStableBalance) {
    score += 15;
  }

  return Math.min(100, Math.max(0, score));
}

export function getRecommendation(score: number): CounterpartyRecommendation {
  if (score >= 70) {
    return "APPROVE";
  }

  if (score >= 40) {
    return "REVIEW";
  }

  return "REJECT";
}

async function fetchGoldRushItems<T>(params: {
  readonly apiKey: string;
  readonly fetcher: typeof fetch;
  readonly url: string;
}): Promise<GoldRushItemsResponse<T>> {
  const response = await params.fetcher(params.url, {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`GoldRush responded with HTTP ${response.status}.`);
  }

  const parsed = (await response.json()) as GoldRushApiResponse<GoldRushItemsResponse<T>>;

  if (parsed.error) {
    throw new Error(parsed.error_message ?? "GoldRush returned an error response.");
  }

  if (!parsed.data || !Array.isArray(parsed.data.items)) {
    throw new Error("GoldRush response did not include items.");
  }

  return parsed.data;
}

function isUnsupportedGoldRushEndpoint(error: unknown): boolean {
  return error instanceof Error && error.message.includes("HTTP 501");
}
