import { describe, expect, it } from "vitest";
import {
  createDemoGoldRushClient,
  loadDemoEnvironment,
  runArcPayDemo,
  type DemoEnvironment,
} from "./demo.js";
import { scoreCounterparty } from "@arcpay/sdk";

describe("ArcPay demo runner", () => {
  it("loads safe defaults without secrets", () => {
    const env = loadDemoEnvironment({});

    expect(env.programId).toBe("GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz");
    expect(env.rpcUrl).toBe("https://api.devnet.solana.com");
    expect(env.cloakViewingKey).toBe("not-configured");
  });

  it("scores the demo contractor as approved", async () => {
    const score = await scoreCounterparty(
      createDemoGoldRushClient(150),
      "contractor-sol-address",
    );

    expect(score.score).toBeGreaterThanOrEqual(70);
    expect(score.recommendation).toBe("APPROVE");
  });

  it("runs live proof mode without making fake settlement claims", async () => {
    const result = await runArcPayDemo(createDemoEnvironment());

    expect(result.decision.action).toBe("WAIT");
    expect(result.explorerLinks[0]).toContain("cluster=devnet");
    expect(result.steps).toContain("ArcPay live proof check complete");
    expect(result.steps.some((step) => step.includes("No private settlement"))).toBe(true);
    expect(result.steps.some((step) => step.includes("Umbra shielded: true"))).toBe(false);
  });
});

function createDemoEnvironment(): DemoEnvironment {
  return {
    agentWalletAddress: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
    auddMintAddress: "HJiQv34JpPDZHt9g5yCRpFqMTCBhSMuSudYCABiXGBEX",
    cloakViewingKey: "dev-viewing-key",
    kaminoMarketAddress: "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
    programId: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
    rpcUrl: "https://api.devnet.solana.com",
    torqueCampaignId: "dev-campaign",
    usdcMintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    x402ServerUrl: "http://127.0.0.1:1",
    allowDevelopmentAdapters: false,
  };
}
