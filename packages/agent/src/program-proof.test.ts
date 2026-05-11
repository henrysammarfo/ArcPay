import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadProgramProofEnvironment } from "./program-proof.js";

describe("Solana program proof runner", () => {
  it("loads safe initialize_treasury proof defaults", () => {
    const env = loadProgramProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      ARCPAY_PROGRAM_ID: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
      SOLANA_NETWORK: "devnet",
    });

    expect(env.network).toBe("devnet");
    expect(env.agentId).toContain("ada-research-agent-live-");
    expect(env.dailyLimit).toBe(5_000);
    expect(env.maxSingleTx).toBe(1_000);
    expect(env.minGoldRushScore).toBe(70);
    expect(env.signerKeypairPath).toContain(".config");
  });

  it("allows explicit policy and signer overrides", () => {
    const env = loadProgramProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      ARCPAY_PROGRAM_ID: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
      SOLANA_NETWORK: "mainnet-beta",
      ARCPAY_SIGNER_KEYPAIR_PATH: "/tmp/id.json",
      ARCPAY_PROOF_AGENT_ID: "ada-proof-fixed",
      ARCPAY_PROOF_DAILY_LIMIT: "2500",
      ARCPAY_PROOF_MAX_SINGLE_TX: "500",
      ARCPAY_PROOF_MIN_GOLDRUSH_SCORE: "80",
    });

    expect(env.network).toBe("mainnet-beta");
    expect(env.signerKeypairPath).toBe(path.resolve("/tmp/id.json"));
    expect(env.agentId).toBe("ada-proof-fixed");
    expect(env.dailyLimit).toBe(2_500);
    expect(env.maxSingleTx).toBe(500);
    expect(env.minGoldRushScore).toBe(80);
  });

  it("requires RPC URL and program ID", () => {
    expect(() => loadProgramProofEnvironment({})).toThrow("QUICKNODE_RPC_URL is required.");
    expect(() =>
      loadProgramProofEnvironment({
        QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      }),
    ).toThrow("ARCPAY_PROGRAM_ID is required.");
  });
});
