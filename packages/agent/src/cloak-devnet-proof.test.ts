import { describe, expect, it } from "vitest";
import { loadCloakDevnetProofEnvironment } from "./cloak-devnet-proof.js";

describe("Cloak devnet proof runner", () => {
  it("loads devnet proof settings from env", () => {
    const env = loadCloakDevnetProofEnvironment({
      QUICKNODE_RPC_URL: " https://api.devnet.solana.com ",
      ARCPAY_SIGNER_KEYPAIR_PATH: " /tmp/id.json ",
      CLOAK_RELAY_URL: " https://api.devnet.cloak.ag ",
      CLOAK_DEPOSIT_LAMPORTS: "2000000",
      CLOAK_SDK_PATH: " /opt/cloak-sdk ",
      CLOAK_PROOF_TIMEOUT_MS: "30000",
      CLOAK_SKIP_BALANCE_PREFLIGHT: "true",
      CLOAK_VERBOSE_PROGRESS: "false",
    });

    expect(env).toMatchObject({
      rpcUrl: "https://api.devnet.solana.com",
      relayUrl: "https://api.devnet.cloak.ag",
      depositLamports: 2_000_000n,
      sdkPath: "/opt/cloak-sdk",
      timeoutMs: 30_000,
      skipBalancePreflight: true,
      verboseProgress: false,
    });
  });

  it("uses safe devnet defaults", () => {
    const env = loadCloakDevnetProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
    });

    expect(env.relayUrl).toBe("https://api.devnet.cloak.ag");
    expect(env.depositLamports).toBe(10_000_000n);
    expect(env.timeoutMs).toBe(900_000);
    expect(env.skipBalancePreflight).toBe(false);
    expect(env.verboseProgress).toBe(true);
  });
});
