import { describe, expect, it } from "vitest";
import { loadQvacProofEnvironment, runQvacProof } from "./qvac-proof.js";

describe("QVAC proof runner", () => {
  it("skips unless live QVAC proof is required", async () => {
    const result = await runQvacProof({
      balance: 500,
      currentRate: 1,
      kaminoAPY: 5,
      sdkPath: undefined,
      modelSrc: undefined,
      modelConfigJson: undefined,
      pendingPaymentsJson: "[]",
      requireLiveQvac: false,
      timeoutMs: 180_000,
    });

    expect(result).toEqual({
      status: "skipped",
      message: "ARCPAY_REQUIRE_LIVE_QVAC is not true.",
    });
  });

  it("loads QVAC proof settings from environment variables", () => {
    const env = loadQvacProofEnvironment({
      QVAC_MODEL_SRC: "model-src",
      QVAC_SDK_PATH: "/home/pridator/arcpay-qvac-runtime/node_modules/@qvac/sdk",
      QVAC_MODEL_CONFIG_JSON: "{\"ctx_size\":2048}",
      QVAC_BALANCE: "100",
      QVAC_CURRENT_RATE: "1.01",
      QVAC_KAMINO_APY: "6.5",
      QVAC_PENDING_PAYMENTS_JSON: "[]",
      QVAC_PROOF_TIMEOUT_MS: "30000",
      ARCPAY_REQUIRE_LIVE_QVAC: "true",
    });

    expect(env).toEqual({
      modelSrc: "model-src",
      sdkPath: "/home/pridator/arcpay-qvac-runtime/node_modules/@qvac/sdk",
      modelConfigJson: "{\"ctx_size\":2048}",
      balance: 100,
      currentRate: 1.01,
      kaminoAPY: 6.5,
      pendingPaymentsJson: "[]",
      requireLiveQvac: true,
      timeoutMs: 30_000,
    });
  });
});
