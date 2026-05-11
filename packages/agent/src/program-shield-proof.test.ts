import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadProgramShieldProofEnvironment } from "./program-shield-proof.js";

describe("Solana program shield proof runner", () => {
  it("loads shield_deposit proof defaults", () => {
    const env = loadProgramShieldProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      ARCPAY_PROGRAM_ID: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
      ARCPAY_TREASURY_ADDRESS: "51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH",
      SOLANA_NETWORK: "devnet",
    });

    expect(env.network).toBe("devnet");
    expect(env.treasuryAddress).toBe("51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH");
    expect(env.mintAddress).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(env.amount).toBe(1_000);
    expect(env.shieldRef).toContain("umbra-live-proof-");
  });

  it("allows explicit shield reference, mint, amount, and signer path", () => {
    const env = loadProgramShieldProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      ARCPAY_PROGRAM_ID: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
      ARCPAY_TREASURY_ADDRESS: "51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH",
      ARCPAY_SIGNER_KEYPAIR_PATH: "/tmp/id.json",
      ARCPAY_PROOF_MINT_ADDRESS: "HJiQv34JpPDZHt9g5yCRpFqMTCBhSMuSudYCABiXGBEX",
      ARCPAY_PROOF_SHIELD_AMOUNT: "2500",
      ARCPAY_PROOF_SHIELD_REF: "umbra-proof-fixed",
    });

    expect(env.signerKeypairPath).toBe(path.resolve("/tmp/id.json"));
    expect(env.mintAddress).toBe("HJiQv34JpPDZHt9g5yCRpFqMTCBhSMuSudYCABiXGBEX");
    expect(env.amount).toBe(2_500);
    expect(env.shieldRef).toBe("umbra-proof-fixed");
  });

  it("requires the treasury address", () => {
    expect(() =>
      loadProgramShieldProofEnvironment({
        QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
        ARCPAY_PROGRAM_ID: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
      }),
    ).toThrow("ARCPAY_TREASURY_ADDRESS is required.");
  });
});
