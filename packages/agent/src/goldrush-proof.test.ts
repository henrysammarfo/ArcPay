import { describe, expect, it } from "vitest";
import {
  loadGoldRushProofEnvironment,
  runGoldRushProof,
} from "./goldrush-proof.js";

describe("GoldRush proof", () => {
  it("approves a scored counterparty above the ArcPay threshold", async () => {
    const requestedUrls: string[] = [];
    const proof = await runGoldRushProof(
      {
        apiKey: "goldrush-secret",
        walletAddress: "counterparty-wallet",
        minScore: 70,
      },
      {
        fetchImpl: createGoldRushFetch(requestedUrls, 150, [
          { contract_ticker_symbol: "USDC", balance: "1000000" },
        ]),
      },
    );

    expect(proof).toMatchObject({
      status: "passed",
      walletAddress: "counterparty-wallet",
      score: 85,
      txCount: 150,
      recommendation: "APPROVE",
      minScore: 70,
      policyDecision: "APPROVE",
    });
    expect(requestedUrls.some((url) => url.includes("/transactions_v3/"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("/balances_v2/"))).toBe(true);
  });

  it("blocks counterparties below the configured score threshold", async () => {
    const proof = await runGoldRushProof(
      {
        apiKey: "goldrush-secret",
        walletAddress: "counterparty-wallet",
        minScore: 70,
      },
      {
        fetchImpl: createGoldRushFetch([], 3, []),
      },
    );

    expect(proof.recommendation).toBe("REJECT");
    expect(proof.policyDecision).toBe("BLOCK");
  });

  it("loads and validates GoldRush environment values without leaking secrets", () => {
    const env = loadGoldRushProofEnvironment({
      GOLDRUSH_API_KEY: " goldrush-secret ",
      GOLDRUSH_SCORE_WALLET: " wallet ",
      GOLDRUSH_MIN_SCORE: "75",
    });

    expect(env).toEqual({
      apiKey: "goldrush-secret",
      walletAddress: "wallet",
      minScore: 75,
    });
  });

  it("rejects placeholder API keys", () => {
    expect(() =>
      loadGoldRushProofEnvironment({
        GOLDRUSH_API_KEY: "your_goldrush_key",
      }),
    ).toThrow("GOLDRUSH_API_KEY must be set");
  });
});

function createGoldRushFetch(
  requestedUrls: string[],
  txCount: number,
  balances: readonly { readonly contract_ticker_symbol: string; readonly balance: string }[],
): typeof fetch {
  return async (input, init) => {
    requestedUrls.push(String(input));
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer goldrush-secret",
    });

    const items = String(input).includes("transactions_v3")
      ? Array.from({ length: txCount }, (_, index) => ({ index }))
      : balances;

    return new Response(JSON.stringify({ data: { items } }), {
      status: 200,
    });
  };
}
