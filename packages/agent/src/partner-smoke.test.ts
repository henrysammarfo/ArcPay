import { describe, expect, it } from "vitest";
import {
  loadPartnerSmokeEnvironment,
  runPartnerSmoke,
  type PartnerSmokeEnvironment,
} from "./partner-smoke.js";

const baseEnv: PartnerSmokeEnvironment = {
  auddMintAddress: "AUDD",
  usdcMintAddress: "USDC",
  birdeyePriceMintAddress: "SOL",
  dflowApiBaseUrl: "https://dev-quote-api.dflow.net",
  dflowInputMintAddress: "SOL",
  dflowOutputMintAddress: "USDC",
  dflowQuoteAmount: 1_000_000n,
  goldRushScoreWallet: "wallet",
  lpAgentApiBaseUrl: "https://api.lpagent.io/open-api/v1",
  lpAgentZapInSlippageBps: 50,
  requireLivePartners: false,
  requireLiveDFlow: false,
  requireLiveLpAgent: false,
};

describe("ArcPay partner smoke runner", () => {
  it("skips live providers when credentials are absent by default", async () => {
    const result = await runPartnerSmoke(baseEnv, createFailingFetch());

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual([
      {
        provider: "Birdeye",
        status: "skipped",
        message: "BIRDEYE_API_KEY is not set.",
      },
      {
        provider: "GoldRush",
        status: "skipped",
        message: "GOLDRUSH_API_KEY is not set.",
      },
      {
        provider: "DFlow",
        status: "skipped",
        message: "DFLOW_API_KEY is not set.",
      },
      {
        provider: "LP Agent",
        status: "skipped",
        message: "LP_AGENT_API_KEY is not set.",
      },
    ]);
  });

  it("fails missing Birdeye and GoldRush when live partners are required", async () => {
    const result = await runPartnerSmoke(
      { ...baseEnv, requireLivePartners: true },
      createFailingFetch(),
    );

    expect(result.passed).toBe(false);
    expect(result.checks.map((check) => check.status)).toEqual([
      "failed",
      "failed",
      "skipped",
      "skipped",
    ]);
  });

  it("runs DFlow without an API key when live DFlow is required", async () => {
    const requestedUrls: string[] = [];
    const result = await runPartnerSmoke(
      { ...baseEnv, requireLiveDFlow: true },
      createPartnerFetch(requestedUrls),
    );

    expect(result.passed).toBe(true);
    expect(result.checks.find((check) => check.provider === "DFlow")).toMatchObject({
      status: "passed",
      message: "Validated DFlow order quote 1000000 -> 1050000 at slot 123.",
    });
    expect(requestedUrls.some((url) => url.includes("dev-quote-api.dflow.net/order?"))).toBe(true);
  });

  it("fails missing LP Agent only when live LP Agent is required", async () => {
    const result = await runPartnerSmoke(
      { ...baseEnv, requireLiveLpAgent: true },
      createFailingFetch(),
    );

    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.provider === "LP Agent")).toMatchObject({
      status: "failed",
      message: "LP_AGENT_API_KEY is not set.",
    });
  });

  it("validates live partner checks through SDK adapters without leaking secrets", async () => {
    const requestedUrls: string[] = [];
    const result = await runPartnerSmoke(
      {
        ...baseEnv,
        birdeyeApiKey: "birdeye-secret",
        dflowApiKey: "dflow-secret",
        goldRushApiKey: "goldrush-secret",
        lpAgentApiKey: "lp-secret",
        lpAgentPoolId: "pool-1",
      },
      createPartnerFetch(requestedUrls),
    );

    expect(result.passed).toBe(true);
    expect(result.checks.map((check) => check.status)).toEqual([
      "passed",
      "passed",
      "passed",
      "passed",
    ]);
    expect(result.checks.map((check) => check.message).join(" ")).not.toContain("secret");
    expect(requestedUrls.some((url) => url.includes("address=SOL"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("/balances_v2/"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("/order?"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("/pools/pool-1/info"))).toBe(true);
  });

  it("validates LP Agent Zap-In transaction generation when configured", async () => {
    const requestedUrls: string[] = [];
    const result = await runPartnerSmoke(
      {
        ...baseEnv,
        lpAgentApiKey: "lp-secret",
        lpAgentZapInPoolId: "pool-1",
        lpAgentZapInWalletAddress: "owner-wallet",
        lpAgentZapInInputSol: 0.01,
      },
      createPartnerFetch(requestedUrls),
    );

    expect(result.passed).toBe(true);
    expect(result.checks.find((check) => check.provider === "LP Agent")).toMatchObject({
      status: "passed",
      message:
        "Validated LP Agent Zap-In transaction generation for pool-1 with 1 unsigned transactions.",
    });
    expect(requestedUrls.some((url) => url.includes("/pools/pool-1/add-tx"))).toBe(true);
  });
});

describe("loadPartnerSmokeEnvironment", () => {
  it("loads required-live mode from environment variables", () => {
    const env = loadPartnerSmokeEnvironment({
      ARCPAY_REQUIRE_LIVE_PARTNERS: "true",
      BIRDEYE_API_KEY: " birdeye ",
      GOLDRUSH_API_KEY: "",
      GOLDRUSH_SCORE_WALLET: "score-wallet",
      BIRDEYE_PRICE_MINT_ADDRESS: "price-mint",
      DFLOW_API_KEY: " dflow ",
      DFLOW_API_BASE_URL: " https://dflow.test/ ",
      DFLOW_INPUT_MINT_ADDRESS: "dflow-input",
      DFLOW_OUTPUT_MINT_ADDRESS: "dflow-output",
      DFLOW_QUOTE_AMOUNT: "123",
      ARCPAY_REQUIRE_LIVE_DFLOW: "true",
      LP_AGENT_API_KEY: " lp ",
      LP_AGENT_API_BASE_URL: " https://api.lpagent.io/open-api/v1/ ",
      LP_AGENT_POOL_ID: " pool-1 ",
      LP_AGENT_OWNER_ADDRESS: "owner-address",
      LP_AGENT_ZAP_IN_POOL_ID: " zap-pool ",
      LP_AGENT_ZAP_IN_WALLET_ADDRESS: "zap-wallet",
      LP_AGENT_ZAP_IN_INPUT_SOL: "0.01",
      LP_AGENT_ZAP_IN_PERCENT_X: "0.5",
      LP_AGENT_ZAP_IN_SLIPPAGE_BPS: "25",
      ARCPAY_REQUIRE_LIVE_LP_AGENT: "true",
    });

    expect(env.requireLivePartners).toBe(true);
    expect(env.birdeyeApiKey).toBe("birdeye");
    expect(env.goldRushApiKey).toBeUndefined();
    expect(env.goldRushScoreWallet).toBe("score-wallet");
    expect(env.birdeyePriceMintAddress).toBe("price-mint");
    expect(env.dflowApiKey).toBe("dflow");
    expect(env.dflowApiBaseUrl).toBe("https://dflow.test/");
    expect(env.dflowInputMintAddress).toBe("dflow-input");
    expect(env.dflowOutputMintAddress).toBe("dflow-output");
    expect(env.dflowQuoteAmount).toBe(123n);
    expect(env.requireLiveDFlow).toBe(true);
    expect(env.lpAgentApiKey).toBe("lp");
    expect(env.lpAgentApiBaseUrl).toBe("https://api.lpagent.io/open-api/v1/");
    expect(env.lpAgentPoolId).toBe("pool-1");
    expect(env.lpAgentOwnerAddress).toBe("owner-address");
    expect(env.lpAgentZapInPoolId).toBe("zap-pool");
    expect(env.lpAgentZapInWalletAddress).toBe("zap-wallet");
    expect(env.lpAgentZapInInputSol).toBe(0.01);
    expect(env.lpAgentZapInPercentX).toBe(0.5);
    expect(env.lpAgentZapInSlippageBps).toBe(25);
    expect(env.requireLiveLpAgent).toBe(true);
  });

  it("treats documentation placeholders as missing credentials", () => {
    const env = loadPartnerSmokeEnvironment({
      ARCPAY_REQUIRE_LIVE_PARTNERS: "true",
      BIRDEYE_API_KEY: "your_birdeye_key",
      GOLDRUSH_API_KEY: "your_goldrush_key",
      GOLDRUSH_SCORE_WALLET: "wallet_to_score",
      BIRDEYE_PRICE_MINT_ADDRESS: "wallet_to_score",
      DFLOW_API_KEY: "dflow_xxxxxxxxxx",
      DFLOW_INPUT_MINT_ADDRESS: "wallet_to_score",
      DFLOW_OUTPUT_MINT_ADDRESS: "wallet_to_score",
      LP_AGENT_API_KEY: "lp_xxxxxxxxxx",
    });

    expect(env.birdeyeApiKey).toBeUndefined();
    expect(env.goldRushApiKey).toBeUndefined();
    expect(env.goldRushScoreWallet).not.toBe("wallet_to_score");
    expect(env.birdeyePriceMintAddress).not.toBe("wallet_to_score");
    expect(env.dflowApiKey).toBeUndefined();
    expect(env.dflowInputMintAddress).not.toBe("wallet_to_score");
    expect(env.dflowOutputMintAddress).not.toBe("wallet_to_score");
    expect(env.lpAgentApiKey).toBeUndefined();
  });
});

function createPartnerFetch(requestedUrls: string[]): typeof fetch {
  return async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.includes("birdeye")) {
      return jsonResponse({
        data: {
          value: 1.002,
          updateUnixTime: 1_777_663_903,
        },
      });
    }

    if (url.includes("dflow")) {
      return jsonResponse({
        contextSlot: 123,
        executionMode: "sync",
        feeBudget: 5_000,
        inAmount: "1000000",
        inputMint: "SOL",
        minOutAmount: "1000000",
        otherAmountThreshold: "1000000",
        outAmount: "1050000",
        outputMint: "USDC",
        priceImpactPct: "0.01",
        slippageBps: 50,
      });
    }

    if (url.includes("/add-tx")) {
      return jsonResponse({
        data: {
          addLiquidityTxsWithJito: ["base64-zap-in-transaction"],
        },
      });
    }

    if (url.includes("lpagent")) {
      return jsonResponse({
        data: {
          id: "pool-1",
        },
      });
    }

    return jsonResponse({
      data: {
        items: [{ contract_ticker_symbol: "USDC", balance: "1000000" }],
      },
    });
  };
}

function createFailingFetch(): typeof fetch {
  return async () => {
    throw new Error("fetch should not be called");
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status: 200,
  });
}
