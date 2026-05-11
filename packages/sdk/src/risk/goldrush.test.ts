import { describe, expect, it } from "vitest";
import {
  calculateCounterpartyScore,
  createGoldRushRestClient,
  getRecommendation,
  scoreCounterparty,
} from "./goldrush.js";
import type { GoldRushClientLike } from "../types.js";

describe("GoldRush counterparty scoring", () => {
  it("approves high-activity wallets with stablecoin balances", async () => {
    const client = createGoldRushClient({
      txCount: 150,
      balances: [{ contract_ticker_symbol: "USDC", balance: "1000000" }],
    });

    const score = await scoreCounterparty(client, "counterparty-wallet");

    expect(score.score).toBeGreaterThanOrEqual(70);
    expect(score.recommendation).toBe("APPROVE");
  });

  it("rejects brand-new wallets with no stablecoin balances", async () => {
    const client = createGoldRushClient({
      txCount: 3,
      balances: [],
    });

    const score = await scoreCounterparty(client, "counterparty-wallet");

    expect(score.score).toBeLessThan(40);
    expect(score.recommendation).toBe("REJECT");
  });

  it("keeps the score bounded between 0 and 100", () => {
    expect(calculateCounterpartyScore(10_000, [{ contract_ticker_symbol: "USDC", balance: 1 }])).toBe(95);
    expect(calculateCounterpartyScore(0, [])).toBe(20);
  });

  it("maps middle scores to manual review", () => {
    expect(getRecommendation(50)).toBe("REVIEW");
  });

  it("creates a REST client for GoldRush scoring", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      requestedUrls.push(String(input));

      expect(init?.headers).toMatchObject({
        Authorization: "Bearer goldrush-test",
      });

      const url = String(input);
      const items = url.includes("transactions_v3")
        ? Array.from({ length: 150 }, (_, index) => ({ index }))
        : [{ contract_ticker_symbol: "USDC", balance: "1000000" }];

      return new Response(JSON.stringify({ data: { items } }), { status: 200 });
    };
    const client = createGoldRushRestClient({
      apiKey: "goldrush-test",
      fetchImpl,
    });

    const score = await scoreCounterparty(client, "counterparty-wallet");

    expect(score.recommendation).toBe("APPROVE");
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[0]).toContain("/solana-mainnet/address/counterparty-wallet/transactions_v3/");
    expect(requestedUrls[1]).toContain("/solana-mainnet/address/counterparty-wallet/balances_v2/");
  });

  it("wraps GoldRush REST failures", async () => {
    const client = createGoldRushRestClient({
      apiKey: "goldrush-test",
      fetchImpl: async () => new Response("{}", { status: 500 }),
    });

    await expect(scoreCounterparty(client, "counterparty-wallet")).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
    });
  });

  it("continues scoring when GoldRush transaction history is unsupported for the chain", async () => {
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("transactions_v3")) {
        return new Response("{}", { status: 501 });
      }

      return new Response(
        JSON.stringify({
          data: {
            items: [{ contract_ticker_symbol: "USDC", balance: "1000000" }],
          },
        }),
        { status: 200 },
      );
    };
    const client = createGoldRushRestClient({
      apiKey: "goldrush-test",
      fetchImpl,
    });

    const score = await scoreCounterparty(client, "counterparty-wallet");

    expect(score.txCount).toBe(0);
    expect(score.recommendation).toBe("REJECT");
  });
});

function createGoldRushClient(params: {
  readonly txCount: number;
  readonly balances: readonly { readonly contract_ticker_symbol: string; readonly balance: string }[];
}): GoldRushClientLike {
  return {
    TransactionService: {
      async getAllTransactionsForAddress() {
        return {
          data: {
            items: Array.from({ length: params.txCount }, (_, index) => ({ index })),
          },
        };
      },
    },
    BalanceService: {
      async getTokenBalancesForWalletAddress() {
        return {
          data: {
            items: params.balances,
          },
        };
      },
    },
  };
}
