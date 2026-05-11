import { describe, expect, it } from "vitest";
import {
  loadKaminoSmokeEnvironment,
  runKaminoSmoke,
  type KaminoSmokeEnvironment,
} from "./kamino-smoke.js";

const baseEnv: KaminoSmokeEnvironment = {
  agentWalletAddress: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
  usdcMintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  kaminoMarketAddress: "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
  kaminoUsdcReserveAddress: "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
  kaminoDepositAmount: 0.01,
  requireLiveKamino: false,
};

describe("Kamino smoke runner", () => {
  it("skips when the wallet address is missing by default", async () => {
    const result = await runKaminoSmoke(
      { ...baseEnv, agentWalletAddress: undefined },
      createFailingFetch(),
    );

    expect(result).toEqual({
      status: "skipped",
      message: "AGENT_WALLET_ADDRESS is not set to a real mainnet wallet public key.",
    });
  });

  it("fails when live Kamino is required and wallet address is missing", async () => {
    const result = await runKaminoSmoke(
      { ...baseEnv, agentWalletAddress: undefined, requireLiveKamino: true },
      createFailingFetch(),
    );

    expect(result.status).toBe("failed");
  });

  it("validates an unsigned transaction without logging transaction bytes", async () => {
    const result = await runKaminoSmoke(baseEnv, createKaminoFetch());

    expect(result).toEqual({
      status: "passed",
      message: "Validated unsigned Kamino deposit transaction for 0.01 USDC.",
    });
    expect(result.message).not.toContain("base64-unsigned-transaction");
  });

  it("loads defaults and filters placeholder wallet addresses", () => {
    const env = loadKaminoSmokeEnvironment({
      AGENT_WALLET_ADDRESS: "your_mainnet_wallet_public_key",
      KAMINO_DEPOSIT_AMOUNT: "0.05",
      ARCPAY_REQUIRE_LIVE_KAMINO: "true",
    });

    expect(env.agentWalletAddress).toBeUndefined();
    expect(env.kaminoDepositAmount).toBe(0.05);
    expect(env.requireLiveKamino).toBe(true);
  });
});

function createKaminoFetch(): typeof fetch {
  return async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(
      JSON.stringify({
        transaction: "base64-unsigned-transaction",
      }),
      {
        headers: {
          "content-type": "application/json",
        },
        status: 200,
      },
    );
}

function createFailingFetch(): typeof fetch {
  return async () => {
    throw new Error("fetch should not be called");
  };
}
