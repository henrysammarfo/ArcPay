import { describe, expect, it } from "vitest";
import {
  handleBalance,
  handleScore,
  handleTreasuryInit,
  handleZerionPolicy,
  handleZerionStatus,
} from "./commands.js";

describe("ArcPay CLI commands", () => {
  it("initializes a development treasury", async () => {
    const result = await handleTreasuryInit({
      agentId: "ada-research-agent-01",
      dailyLimit: "5000",
      maxSingleTx: "1000",
    });

    expect(result.command).toBe("treasury:init");
    expect(result.data).toMatchObject({
      agentId: "ada-research-agent-01",
      treasuryId: "arcpay_ada-research-agent-01",
    });
  });

  it("returns aggregate-only balance data", async () => {
    const result = await handleBalance({
      agent: "ada-research-agent-01",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            source: "solana-rpc",
            liveProof: true,
            agentWallet: "agent-wallet",
            solBalance: { lamports: 1, sol: 0.000000001 },
            tokenBalances: [],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        ),
    });

    expect(result.data).toMatchObject({
      aggregateOnly: true,
      source: "live-arcpay-server",
      liveProof: true,
    });
  });

  it("does not return fake balance data when live status is unavailable", async () => {
    const result = await handleBalance({
      agent: "ada-research-agent-01",
      fetchImpl: async () => {
        throw new Error("server offline");
      },
    });

    expect(result.data).toMatchObject({
      aggregateOnly: true,
      source: "unavailable",
      liveProof: false,
    });
  });

  it("scores a wallet", async () => {
    const result = await handleScore({
      wallet: "contractor-wallet",
      txCount: "150",
    });

    expect(result.data).toMatchObject({
      wallet: "contractor-wallet",
      recommendation: "APPROVE",
    });
  });

  it("reports Zerion CLI readiness", async () => {
    const result = await handleZerionStatus({
      apiKey: "zk_test_key",
      commandExists: async (command) => command === "zerion",
    });

    expect(result.command).toBe("zerion:status");
    expect(result.data).toMatchObject({
      officialRepo: "https://github.com/zeriontech/zerion-ai",
      cliCommand: "zerion",
      packageName: "zerion-cli",
      installed: true,
      apiKeyEnv: "ZERION_API_KEY",
      apiKeyConfigured: true,
      readyForReadOnlyAnalytics: true,
      readyForTrading: true,
    });
  });

  it("builds a scoped Zerion policy without claiming live execution", async () => {
    const result = await handleZerionPolicy({
      chain: "solana",
      maxSpendUsd: "4",
      expiresAt: "2026-05-11T23:59:59.000Z",
      wallet: "agent-wallet",
      route: "swap",
      allowedAsset: ["USDC", "SOL"],
      blockedAction: ["bridge"],
      now: new Date("2026-05-06T00:00:00.000Z"),
    });

    expect(result.command).toBe("zerion:policy");
    expect(result.data).toMatchObject({
      liveProof: false,
      status: "policy-ready",
      policy: {
        chainLock: "solana",
        maxSpendUsd: 4,
        expiresAt: "2026-05-11T23:59:59.000Z",
        wallet: "agent-wallet",
        route: "swap",
        allowedAssets: ["USDC", "SOL"],
        blockedActions: ["bridge"],
      },
    });
  });

  it("rejects expired Zerion policies", async () => {
    await expect(
      handleZerionPolicy({
        chain: "solana",
        maxSpendUsd: "4",
        expiresAt: "2026-05-05T23:59:59.000Z",
        now: new Date("2026-05-06T00:00:00.000Z"),
      }),
    ).rejects.toThrow("expiresAt must be in the future.");
  });
});
