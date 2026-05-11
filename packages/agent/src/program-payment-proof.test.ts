import { describe, expect, it } from "vitest";
import { loadProgramPaymentProofEnvironment } from "./program-payment-proof.js";

describe("Solana program payment proof runner", () => {
  it("loads execute_payment proof defaults", () => {
    const env = loadProgramPaymentProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      ARCPAY_PROGRAM_ID: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
      ARCPAY_TREASURY_ADDRESS: "51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH",
      ARCPAY_TREASURY_TOKEN_ACCOUNT: "EbdwJGgziSypuDu7M5ryYUPkUMes1JUsxQyRs4Pzjm6R",
      ARCPAY_RECIPIENT_TOKEN_ACCOUNT: "CTdJ4bt41cqq3Cuo8Cs1CX2gQUz9GUB8YC3YQBmwpump",
      SOLANA_NETWORK: "devnet",
    });

    expect(env.network).toBe("devnet");
    expect(env.amount).toBe(250);
    expect(env.goldRushScore).toBe(91);
    expect(env.paymentRef).toContain("execute-payment-live-proof-");
  });

  it("allows explicit payment policy proof values", () => {
    const env = loadProgramPaymentProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      ARCPAY_PROGRAM_ID: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
      ARCPAY_TREASURY_ADDRESS: "51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH",
      ARCPAY_TREASURY_TOKEN_ACCOUNT: "EbdwJGgziSypuDu7M5ryYUPkUMes1JUsxQyRs4Pzjm6R",
      ARCPAY_RECIPIENT_TOKEN_ACCOUNT: "CTdJ4bt41cqq3Cuo8Cs1CX2gQUz9GUB8YC3YQBmwpump",
      ARCPAY_PROOF_PAYMENT_AMOUNT: "999",
      ARCPAY_PROOF_PAYMENT_GOLDRUSH_SCORE: "70",
      ARCPAY_PROOF_PAYMENT_REF: "payment-proof-fixed",
    });

    expect(env.amount).toBe(999);
    expect(env.goldRushScore).toBe(70);
    expect(env.paymentRef).toBe("payment-proof-fixed");
  });

  it("requires token accounts", () => {
    expect(() =>
      loadProgramPaymentProofEnvironment({
        QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
        ARCPAY_PROGRAM_ID: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
        ARCPAY_TREASURY_ADDRESS: "51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH",
      }),
    ).toThrow("ARCPAY_TREASURY_TOKEN_ACCOUNT is required.");
  });
});
