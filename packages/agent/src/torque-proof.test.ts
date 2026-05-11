import { describe, expect, it } from "vitest";
import {
  loadTorqueProofEnvironment,
  runTorqueProof,
  type TorqueProofEnvironment,
} from "./torque-proof.js";

const wallet = "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz";

const baseEnv: TorqueProofEnvironment = {
  apiKey: "torque-secret",
  eventApiUrl: "https://ingest.torque.so/events",
  userPubkey: wallet,
  agentId: "ada-research-agent-01",
  walletEventSource: "arcpay-dashboard",
  paymentEventSource: "x402-server",
  paymentTxSignature: "paid_tx_sig",
  paymentAmountUsd: 0.01,
  requireLiveTorque: true,
};

describe("Torque proof runner", () => {
  it("submits wallet and paid-request events in order", async () => {
    const requests: Array<{
      readonly body: {
        readonly eventName: string;
        readonly data: {
          readonly proofType: string;
          readonly txSignature: string;
          readonly amountUsd: number;
          readonly liveProof: boolean;
        };
      };
      readonly headers: Headers;
    }> = [];

    const result = await runTorqueProof(baseEnv, createTorqueFetch(requests));

    expect(result).toMatchObject({
      status: "passed",
      message: "Submitted ArcPay wallet and paid-request Torque proof events.",
    });
    expect(requests.map((request) => request.body.eventName)).toEqual([
      "arcpay_wallet_connected",
      "arcpay_paid_agent_request",
    ]);
    expect(requests[0]?.headers.get("x-api-key")).toBe("torque-secret");
    expect(requests[0]?.body.data).toMatchObject({
      proofType: "wallet_connected",
      txSignature: "",
      amountUsd: 0,
      liveProof: true,
    });
    expect(requests[1]?.body.data).toMatchObject({
      proofType: "solana-verified",
      txSignature: "paid_tx_sig",
      amountUsd: 0.01,
      liveProof: true,
    });
    expect(JSON.stringify(result)).not.toContain("torque-secret");
  });

  it("requires a payment signature for live proof mode", async () => {
    const result = await runTorqueProof(
      {
        ...baseEnv,
        paymentTxSignature: undefined,
      },
      createFailingFetch(),
    );

    expect(result).toEqual({
      status: "failed",
      events: [],
      message: "TORQUE_PAYMENT_TX_SIGNATURE or TORQUE_TX_SIGNATURE is not set.",
    });
  });

  it("loads proof settings from environment variables", () => {
    const env = loadTorqueProofEnvironment({
      TORQUE_API_KEY: " tq_secret ",
      TORQUE_EVENT_API_URL: " https://ingest.torque.so/events ",
      TORQUE_USER_PUBKEY: wallet,
      TORQUE_AGENT_ID: " agent-1 ",
      TORQUE_WALLET_EVENT_SOURCE: " dashboard ",
      TORQUE_PAYMENT_EVENT_SOURCE: " x402 ",
      TORQUE_PAYMENT_TX_SIGNATURE: " tx_sig ",
      TORQUE_PAYMENT_AMOUNT_USD: "0.25",
      ARCPAY_REQUIRE_LIVE_TORQUE: "true",
    });

    expect(env).toEqual({
      apiKey: "tq_secret",
      eventApiUrl: "https://ingest.torque.so/events",
      userPubkey: wallet,
      agentId: "agent-1",
      walletEventSource: "dashboard",
      paymentEventSource: "x402",
      paymentTxSignature: "tx_sig",
      paymentAmountUsd: 0.25,
      requireLiveTorque: true,
    });
  });
});

function createTorqueFetch(requests: Array<unknown>): typeof fetch {
  return async (input, init) => {
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });

    return new Response(JSON.stringify({ id: "evt_live", status: "accepted" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

function createFailingFetch(): typeof fetch {
  return async () => {
    throw new Error("fetch should not be called");
  };
}
