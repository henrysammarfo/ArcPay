import { describe, expect, it } from "vitest";
import {
  assertLivePaymentResponse,
  loadX402PaymentProofEnvironment,
} from "./x402-payment-proof.js";

describe("x402 Solana payment proof runner", () => {
  it("loads x402 payment proof defaults", () => {
    const env = loadX402PaymentProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      USDC_MINT_ADDRESS: "HRyoekCs5hErv5wYpawrj5MdK3s4Y7DBFZLotTAt41Nj",
      AGENT_WALLET_ADDRESS: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
    });

    expect(env.serverUrl).toBe("http://localhost:4030");
    expect(env.endpointPath).toBe("/agent/research");
    expect(env.paymentAmount).toBe(0.01);
    expect(env.devnetMintTest).toBe(false);
  });

  it("allows explicit server and endpoint settings", () => {
    const env = loadX402PaymentProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      USDC_MINT_ADDRESS: "HRyoekCs5hErv5wYpawrj5MdK3s4Y7DBFZLotTAt41Nj",
      AGENT_WALLET_ADDRESS: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
      ARCPAY_X402_SERVER_URL: "http://localhost:4031/",
      ARCPAY_X402_ENDPOINT_PATH: "/agent/task",
      ARCPAY_X402_PAYMENT_AMOUNT: "0.1",
      ARCPAY_X402_DEVNET_MINT_TEST: "true",
      SOLANA_NETWORK: "devnet",
    });

    expect(env.serverUrl).toBe("http://localhost:4031");
    expect(env.endpointPath).toBe("/agent/task");
    expect(env.paymentAmount).toBe(0.1);
    expect(env.network).toBe("devnet");
    expect(env.devnetMintTest).toBe(true);
  });

  it("rejects non-live endpoint responses", () => {
    expect(() =>
      assertLivePaymentResponse({
        liveProof: false,
        paymentProof: { proofType: "development-bypass" },
      }),
    ).toThrow("x402 endpoint did not return a live Solana payment proof.");
  });

  it("accepts live Solana verified endpoint responses", () => {
    expect(() =>
      assertLivePaymentResponse({
        liveProof: true,
        paymentProof: { proofType: "solana-verified" },
      }),
    ).not.toThrow();
  });
});
