import request from "supertest";
import { createHash, createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createArcPayX402Server } from "./server.js";
import { FileQuickNodeWebhookStore } from "./quicknode-webhook.js";
import type { X402ServerConfig } from "./config.js";

describe("ArcPay x402 server", () => {
  it("returns 402 for unpaid protected requests", async () => {
    const app = createArcPayX402Server(testConfig);

    const response = await request(app).get("/agent/research");

    expect(response.status).toBe(402);
    expect(response.body.error).toBe("PAYMENT_REQUIRED");
    expect(response.body.accepts.currency).toBe("USDC");
  });

  it("allows dev-paid research requests", async () => {
    const app = createArcPayX402Server(testConfig);

    const response = await request(app)
      .get("/agent/research")
      .set("x-arcpay-dev-payment", "paid");

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("Research endpoint accepted payment gate.");
    expect(response.body.liveProof).toBe(false);
    expect(response.body.paymentProof.proofType).toBe("development-bypass");
  });

  it("allows dev-paid task requests", async () => {
    const app = createArcPayX402Server(testConfig);

    const response = await request(app)
      .post("/agent/task")
      .set("x-arcpay-dev-payment", "paid")
      .send({ prompt: "run" });

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("Task endpoint accepted payment gate.");
    expect(response.body.liveProof).toBe(false);
    expect(response.body.paymentProof.proofType).toBe("development-bypass");
  });

  it("rejects production mode without a real verifier", () => {
    expect(() =>
      createArcPayX402Server({
        ...testConfig,
        paymentMode: "production",
      }),
    ).toThrow("Production x402 mode requires a payment verifier.");
  });

  it("uses the production verifier instead of the development bypass", async () => {
    const app = createArcPayX402Server(
      {
        ...testConfig,
        paymentMode: "production",
      },
      {
        paymentVerifier: {
          async verify() {
            return true;
          },
        },
      },
    );

    const response = await request(app)
      .get("/agent/research")
      .set("x-arcpay-dev-payment", "paid");

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("Research endpoint accepted payment gate.");
    expect(response.body.liveProof).toBe(true);
    expect(response.body.paymentProof.proofType).toBe("solana-verified");
  });

  it("reports QuickNode webhook as pending until a real event is received", async () => {
    const app = createArcPayX402Server(testConfig);

    const response = await request(app).get("/live/quicknode");

    expect(response.status).toBe(200);
    expect(response.body.liveProof).toBe(false);
    expect(response.body.receivedCount).toBe(0);
    expect(response.body.nextRequiredItems.length).toBeGreaterThan(0);
  });

  it("rejects live treasury requests for a mismatched selected network", async () => {
    const app = createArcPayX402Server(testConfig);

    const response = await request(app).get("/live/treasury?network=mainnet");

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("NETWORK_MISMATCH");
    expect(response.body.requestedNetwork).toBe("solana:mainnet");
    expect(response.body.serverNetwork).toBe("solana:devnet");
  });

  it("records a QuickNode webhook event as live proof", async () => {
    const app = createArcPayX402Server(testConfig);

    const postResponse = await request(app)
      .post("/webhooks/quicknode")
      .send({
        eventId: "quicknode-event-001",
        network: "solana-devnet",
        signature: "devnet-signature-from-quicknode",
      });

    expect(postResponse.status).toBe(202);
    expect(postResponse.body.liveProof).toBe(true);
    expect(postResponse.body.eventId).toBe("quicknode-event-001");

    const statusResponse = await request(app).get("/live/quicknode");

    expect(statusResponse.body.liveProof).toBe(true);
    expect(statusResponse.body.receivedCount).toBe(1);
    expect(statusResponse.body.latestEvent.eventId).toBe("quicknode-event-001");
  });

  it("rejects QuickNode webhooks when the configured secret is missing", async () => {
    const app = createArcPayX402Server({
      ...testConfig,
      quickNodeWebhookSecret: "secret",
    });

    const response = await request(app)
      .post("/webhooks/quicknode")
      .send({ eventId: "quicknode-event-002" });

    expect(response.status).toBe(401);
    expect(response.body.liveProof).toBe(false);
  });

  it("accepts QuickNode webhooks with the configured secret", async () => {
    const app = createArcPayX402Server({
      ...testConfig,
      quickNodeWebhookSecret: "secret",
    });

    const response = await request(app)
      .post("/webhooks/quicknode")
      .set("x-arcpay-webhook-secret", "secret")
      .send({ eventId: "quicknode-event-003" });

    expect(response.status).toBe(202);
    expect(response.body.eventId).toBe("quicknode-event-003");
  });

  it("accepts QuickNode webhooks with provider token headers", async () => {
    const app = createArcPayX402Server({
      ...testConfig,
      quickNodeWebhookSecret: "secret",
    });

    const response = await request(app)
      .post("/webhooks/quicknode")
      .set("x-qn-security-token", "secret")
      .send({ eventId: "quicknode-event-provider-token" });

    expect(response.status).toBe(202);
    expect(response.body.eventId).toBe("quicknode-event-provider-token");
  });

  it("accepts QuickNode signed webhooks with the configured security token", async () => {
    const app = createArcPayX402Server({
      ...testConfig,
      quickNodeWebhookSecret: "security-token",
    });
    const body = JSON.stringify({ eventId: "quicknode-event-004" });
    const nonce = "nonce";
    const timestamp = "1770000000";
    const contentHash = createHash("sha256").update(Buffer.from(body)).digest("hex");
    const signature = createHmac("sha256", "security-token")
      .update(`${nonce}${contentHash}${timestamp}`)
      .digest("base64");

    const response = await request(app)
      .post("/webhooks/quicknode")
      .set("content-type", "application/json")
      .set("x-qn-nonce", nonce)
      .set("x-qn-timestamp", timestamp)
      .set("x-qn-content-hash", contentHash)
      .set("x-qn-signature", signature)
      .send(body);

    expect(response.status).toBe(202);
    expect(response.body.eventId).toBe("quicknode-event-004");
  });

  it("accepts QuickNode signed wallet activity array payloads", async () => {
    const app = createArcPayX402Server({
      ...testConfig,
      quickNodeWebhookSecret: "security-token",
    });
    const body = JSON.stringify([
      {
        block: {
          blockhash: "quicknode-live-blockhash",
          blockHeight: 448097871,
          blockTime: 1777974862,
        },
        transactions: [
          {
            signature: "quicknode-live-transaction-signature",
          },
        ],
      },
    ]);
    const nonce = "nonce";
    const timestamp = "1770000000";
    const signature = createHmac("sha256", "security-token")
      .update(`${nonce}${timestamp}${body}`)
      .digest("hex");

    const response = await request(app)
      .post("/webhooks/quicknode")
      .set("content-type", "application/json")
      .set("x-qn-nonce", nonce)
      .set("x-qn-timestamp", timestamp)
      .set("x-qn-signature", signature)
      .send(body);

    expect(response.status).toBe(202);
    expect(response.body.eventId).toBe("quicknode-live-transaction-signature");
  });

  it("persists QuickNode live proof across store instances", async () => {
    const directory = mkdtempSync(join(tmpdir(), "arcpay-quicknode-"));
    const storePath = join(directory, "quicknode-events.json");

    try {
      const firstStore = new FileQuickNodeWebhookStore({
        path: storePath,
        securityConfigured: true,
      });
      firstStore.record({ eventId: "quicknode-persisted-event" }, new Date("2026-05-05T11:25:00.000Z"));

      const secondStore = new FileQuickNodeWebhookStore({
        path: storePath,
        securityConfigured: true,
      });

      expect(secondStore.status().liveProof).toBe(true);
      expect(secondStore.status().latestEvent?.eventId).toBe("quicknode-persisted-event");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

const testConfig: X402ServerConfig = {
  port: 4030,
  rpcUrl: "https://api.devnet.solana.com",
  programId: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
  agentWallet: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
  auddMint: "HJiQv34JpPDZHt9g5yCRpFqMTCBhSMuSudYCABiXGBEX",
  usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  network: "solana:devnet",
  paymentMode: "development",
  endpoints: [
    {
      method: "GET",
      path: "/agent/research",
      price: {
        amount: 0.01,
        currency: "USDC",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      },
      payTo: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
      network: "solana:devnet",
    },
    {
      method: "GET",
      path: "/agent/analysis",
      price: {
        amount: 0.05,
        currency: "AUDD",
        mint: "HJiQv34JpPDZHt9g5yCRpFqMTCBhSMuSudYCABiXGBEX",
      },
      payTo: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
      network: "solana:devnet",
    },
    {
      method: "POST",
      path: "/agent/task",
      price: {
        amount: 0.1,
        currency: "USDC",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      },
      payTo: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
      network: "solana:devnet",
    },
  ],
};
