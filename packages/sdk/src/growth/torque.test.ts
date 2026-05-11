import { describe, expect, it } from "vitest";
import { ArcPaySdkError } from "../errors.js";
import { createDevelopmentTorqueClient } from "./development.js";
import { createTorqueCustomEventClient, registerReferral, trackLeaderboard } from "./torque.js";

const wallet = "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz";

describe("Torque growth adapters", () => {
  it("submits official Torque custom events without leaking the API key", async () => {
    const requests: Array<{
      readonly url: string;
      readonly headers: Headers;
      readonly body: unknown;
    }> = [];
    const client = createTorqueCustomEventClient({
      apiKey: "torque-secret",
      fetchImpl: createTorqueFetch(requests, {
        id: "evt_1",
        ok: true,
      }),
    });

    const result = await client.sendCustomEvent({
      eventName: "arcpay_wallet_connected",
      userPubkey: wallet,
      timestamp: 1_777_981_832_000,
      data: {
        source: "dashboard",
        agentId: "ada-research-agent-01",
        liveProof: true,
      },
    });

    expect(result).toMatchObject({
      liveProof: true,
      eventName: "arcpay_wallet_connected",
      userPubkey: wallet,
      response: {
        id: "evt_1",
      },
    });
    expect(requests[0]?.url).toBe("https://ingest.torque.so/events");
    expect(requests[0]?.headers.get("x-api-key")).toBe("torque-secret");
    expect(requests[0]?.body).toEqual({
      timestamp: 1_777_981_832_000,
      userPubkey: wallet,
      eventName: "arcpay_wallet_connected",
      data: {
        source: "dashboard",
        agentId: "ada-research-agent-01",
        liveProof: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain("torque-secret");
  });

  it("rejects malformed Torque custom event data before calling the provider", async () => {
    const requests: unknown[] = [];
    const client = createTorqueCustomEventClient({
      apiKey: "torque-secret",
      fetchImpl: createTorqueFetch(requests),
    });

    await expect(
      client.sendCustomEvent({
        eventName: "arcpay_wallet_connected",
        userPubkey: wallet,
        data: {
          bad: Number.NaN,
        },
      }),
    ).rejects.toThrow(ArcPaySdkError);
    expect(requests).toHaveLength(0);
  });

  it("wraps Torque custom event HTTP failures", async () => {
    const client = createTorqueCustomEventClient({
      apiKey: "torque-secret",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "event_not_found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
    });

    await expect(
      client.sendCustomEvent({
        eventName: "missing_event",
        userPubkey: wallet,
      }),
    ).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
      message: "Torque custom event API returned HTTP 404.",
    });
  });

  it("registers a fee-rebate referral", async () => {
    const torque = createDevelopmentTorqueClient({ idFactory: () => "fixed" });

    const result = await registerReferral(torque, {
      campaignId: "campaign-1",
      referrerWallet: "referrer-wallet",
      newCustomerWallet: "customer-wallet",
    });

    expect(result).toMatchObject({
      id: "dev_torque_referral_fixed",
      campaignId: "campaign-1",
      referrer: "referrer-wallet",
      referee: "customer-wallet",
      reward: {
        type: "FEE_REBATE",
        percent: 20,
      },
      active: true,
    });
  });

  it("fetches a treasury-volume leaderboard", async () => {
    const torque = createDevelopmentTorqueClient({ idFactory: () => "fixed" });

    const result = await trackLeaderboard(torque, {
      campaignId: "campaign-1",
      limit: 5,
    });

    expect(result).toMatchObject({
      id: "dev_torque_leaderboard_fixed",
      campaignId: "campaign-1",
      metric: "treasury_volume",
      limit: 5,
      entries: [],
    });
  });
});

function createTorqueFetch(
  requests: Array<unknown>,
  responseBody: unknown = { ok: true },
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
