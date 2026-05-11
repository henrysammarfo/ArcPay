import { describe, expect, it } from "vitest";
import { loadProgramPolicyProofEnvironment } from "./program-policy-proof.js";

describe("Solana program policy proof runner", () => {
  it("loads policy failure proof configuration", () => {
    const env = loadProgramPolicyProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      ARCPAY_PROGRAM_ID: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
      ARCPAY_TREASURY_ADDRESS: "51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH",
      ARCPAY_TREASURY_TOKEN_ACCOUNT: "EbdwJGgziSypuDu7M5ryYUPkUMes1JUsxQyRs4Pzjm6R",
      ARCPAY_RECIPIENT_TOKEN_ACCOUNT: "CTdJ4bt41cqq3Cuo8Cs1CX2gQUz9GUB8YC3YQBmwpump",
      SOLANA_NETWORK: "devnet",
    });

    expect(env.network).toBe("devnet");
    expect(env.paymentRef).toContain("execute-payment-policy-failure-proof-");
  });

  it("allows a fixed policy proof reference", () => {
    const env = loadProgramPolicyProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      ARCPAY_PROGRAM_ID: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
      ARCPAY_TREASURY_ADDRESS: "51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH",
      ARCPAY_TREASURY_TOKEN_ACCOUNT: "EbdwJGgziSypuDu7M5ryYUPkUMes1JUsxQyRs4Pzjm6R",
      ARCPAY_RECIPIENT_TOKEN_ACCOUNT: "CTdJ4bt41cqq3Cuo8Cs1CX2gQUz9GUB8YC3YQBmwpump",
      ARCPAY_PROOF_POLICY_REF: "policy-proof-fixed",
    });

    expect(env.paymentRef).toBe("policy-proof-fixed");
  });

  it("requires token accounts", () => {
    expect(() =>
      loadProgramPolicyProofEnvironment({
        QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
        ARCPAY_PROGRAM_ID: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
        ARCPAY_TREASURY_ADDRESS: "51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH",
      }),
    ).toThrow("ARCPAY_TREASURY_TOKEN_ACCOUNT is required.");
  });
});
