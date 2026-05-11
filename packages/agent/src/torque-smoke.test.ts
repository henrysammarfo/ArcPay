import { describe, expect, it } from "vitest";
import {
  loadTorqueSmokeEnvironment,
  runTorqueSmoke,
  type TorqueSmokeEnvironment,
} from "./torque-smoke.js";

const wallet = "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz";

const baseEnv: TorqueSmokeEnvironment = {
  eventApiUrl: "https://ingest.torque.so/events",
  eventName: "arcpay_wallet_connected",
  userPubkey: wallet,
  source: "arcpay-dashboard",
  agentId: "ada-research-agent-01",
  proofType: "wallet_connected",
  requireLiveTorque: false,
};

describe("Torque live proof runner", () => {
  it("skips when the Torque key is absent by default", async () => {
    const result = await runTorqueSmoke(
      {
        ...baseEnv,
        apiKey: undefined,
      },
      createFailingFetch(),
    );

    expect(result).toEqual({
      provider: "Torque",
      status: "skipped",
      message: "TORQUE_API_KEY is not set.",
    });
  });

  it("fails missing config when live Torque is required", async () => {
    const result = await runTorqueSmoke(
      {
        ...baseEnv,
        apiKey: undefined,
        requireLiveTorque: true,
      },
      createFailingFetch(),
    );

    expect(result).toMatchObject({
      provider: "Torque",
      status: "failed",
      message: "TORQUE_API_KEY is not set.",
    });
  });

  it("submits a custom event through the SDK without leaking the key", async () => {
    const requests: Array<{
      readonly url: string;
      readonly headers: Headers;
      readonly body: unknown;
    }> = [];
    const result = await runTorqueSmoke(
      {
        ...baseEnv,
        apiKey: "torque-secret",
        amountUsd: 0.01,
        txSignature: "tx_sig_123",
      },
      createTorqueFetch(requests, {
        id: "evt_live_1",
        status: "accepted",
      }),
    );

    expect(result).toMatchObject({
      provider: "Torque",
      status: "passed",
      message: "Submitted Torque custom event arcpay_wallet_connected for 2PFg1f...aFNABz.",
      response: {
        id: "evt_live_1",
      },
    });
    expect(requests[0]?.url).toBe("https://ingest.torque.so/events");
    expect(requests[0]?.headers.get("x-api-key")).toBe("torque-secret");
    expect(requests[0]?.body).toMatchObject({
      userPubkey: wallet,
      eventName: "arcpay_wallet_connected",
      data: {
        source: "arcpay-dashboard",
        agentId: "ada-research-agent-01",
        proofType: "wallet_connected",
        txSignature: "tx_sig_123",
        amountUsd: 0.01,
        liveProof: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain("torque-secret");
  });

  it("keeps optional Torque event fields schema-compatible", async () => {
    const requests: Array<{
      readonly body: {
        readonly data: {
          readonly txSignature: string;
          readonly amountUsd: number;
        };
      };
    }> = [];
    await runTorqueSmoke(
      {
        ...baseEnv,
        apiKey: "torque-secret",
      },
      createTorqueFetch(requests, {
        id: "evt_live_2",
        status: "accepted",
      }),
    );

    expect(requests[0]?.body.data.txSignature).toBe("");
    expect(requests[0]?.body.data.amountUsd).toBe(0);
  });
});

describe("loadTorqueSmokeEnvironment", () => {
  it("loads Torque live proof settings from environment variables", () => {
    const env = loadTorqueSmokeEnvironment({
      TORQUE_API_KEY: " tq_secret ",
      TORQUE_EVENT_API_URL: " https://ingest.torque.so/events ",
      TORQUE_EVENT_NAME: " arcpay_paid_agent_request ",
      TORQUE_USER_PUBKEY: wallet,
      TORQUE_EVENT_SOURCE: " x402-server ",
      TORQUE_AGENT_ID: " agent-1 ",
      TORQUE_PROOF_TYPE: " paid_agent_request ",
      TORQUE_TX_SIGNATURE: " tx_sig ",
      TORQUE_AMOUNT_USD: "0.01",
      ARCPAY_REQUIRE_LIVE_TORQUE: "true",
    });

    expect(env).toEqual({
      apiKey: "tq_secret",
      eventApiUrl: "https://ingest.torque.so/events",
      eventName: "arcpay_paid_agent_request",
      userPubkey: wallet,
      source: "x402-server",
      agentId: "agent-1",
      proofType: "paid_agent_request",
      txSignature: "tx_sig",
      amountUsd: 0.01,
      requireLiveTorque: true,
    });
  });

  it("falls back to the agent wallet and ignores placeholders", () => {
    const env = loadTorqueSmokeEnvironment({
      TORQUE_API_KEY: "torque_xxxxxxxxxx",
      TORQUE_USER_PUBKEY: "YourSolanaPublicKeyHere",
      AGENT_WALLET_ADDRESS: wallet,
    });

    expect(env.apiKey).toBeUndefined();
    expect(env.userPubkey).toBe(wallet);
  });
});

function createTorqueFetch(
  requests: Array<unknown>,
  responseBody: unknown,
): typeof fetch {
  return async (input, init) => {
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });

    return new Response(JSON.stringify(responseBody), {
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
