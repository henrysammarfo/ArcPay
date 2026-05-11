import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadReadinessEnvironment, runTrackReadiness } from "./track-readiness.js";

describe("track readiness checker", () => {
  it("reports missing env without exposing secret values", () => {
    const checks = runTrackReadiness({});
    const dflow = checks.find((check) => check.track === "DFlow");

    expect(dflow).toMatchObject({
      status: "missing_env",
      missingEnv: expect.arrayContaining(["DFLOW_API_BASE_URL", "ARCPAY_SIGNER_KEYPAIR_PATH"]),
    });
    expect(JSON.stringify(checks)).not.toContain("secret");
  });

  it("separates funded proof readiness from missing integration", () => {
    const checks = runTrackReadiness({
      QUICKNODE_RPC_URL: "https://api.mainnet-beta.solana.com",
      ARCPAY_PROGRAM_ID: "program",
      ARCPAY_SIGNER_KEYPAIR_PATH: fileURLToPath(import.meta.url),
      DFLOW_API_BASE_URL: "https://dev-quote-api.dflow.net",
      DFLOW_INPUT_MINT_ADDRESS: "So11111111111111111111111111111111111111112",
      DFLOW_OUTPUT_MINT_ADDRESS: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      DFLOW_QUOTE_AMOUNT: "1000000",
      ZERION_API_KEY: "zk_real_key",
    });

    expect(checks.find((check) => check.track === "DFlow")).toMatchObject({
      status: "needs_funds",
      missingEnv: [],
    });
    expect(checks.find((check) => check.track === "Zerion")).toMatchObject({
      status: "needs_funds",
      missingEnv: [],
    });
  });

  it("marks LP Agent as Zap-In ready when configured and QVAC as a native Linux environment proof", () => {
    const checks = runTrackReadiness({
      ARCPAY_REQUIRE_LIVE_QVAC: "true",
      QVAC_SDK_PATH: "/missing/qvac/sdk",
      LP_AGENT_API_KEY: "lp_real",
      LP_AGENT_API_BASE_URL: "https://api.lpagent.io/open-api/v1",
      LP_AGENT_ZAP_IN_POOL_ID: "pool",
      LP_AGENT_ZAP_IN_WALLET_ADDRESS: "wallet",
      LP_AGENT_ZAP_IN_INPUT_SOL: "0.01",
    });

    expect(checks.find((check) => check.track === "QVAC")).toMatchObject({
      status: "missing_env",
      missingEnv: ["QVAC_LINUX_HOST_CONFIRMED"],
      nextAction: expect.stringContaining("native Linux x64"),
    });
    expect(checks.find((check) => check.track === "LP Agent")).toMatchObject({
      status: "needs_funds",
      missingEnv: [],
    });
  });

  it("treats Ika as the active pre-alpha implementation target, not an external blocker", () => {
    const checks = runTrackReadiness({
      IKA_SOLANA_RPC_URL: "https://api.devnet.solana.com",
      IKA_GRPC_ENDPOINT: "https://pre-alpha-dev-1.ika.ika-network.net:443",
      IKA_PROGRAM_ID: "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY",
      ARCPAY_SIGNER_KEYPAIR_PATH: fileURLToPath(import.meta.url),
    });

    expect(checks.find((check) => check.track === "Encrypt / Ika")).toMatchObject({
      status: "needs_funds",
      missingEnv: [],
      nextAction: expect.stringContaining("proof:ika:approve"),
    });
  });

  it("requires MagicBlock Private Payments API config for the MagicBlock track", () => {
    const owner = "DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm";
    const checks = runTrackReadiness({
      QUICKNODE_RPC_URL: "https://api.devnet.solana.com",
      ARCPAY_PAYMENT_MODE: "production",
      AGENT_WALLET_ADDRESS: owner,
      USDC_MINT_ADDRESS: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      MAGICBLOCK_PRIVATE_PAYMENTS_API_URL: "https://payments.magicblock.app",
      MAGICBLOCK_PAYMENT_OWNER_ADDRESS: owner,
      MAGICBLOCK_PAYMENT_MINT_ADDRESS: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    });

    expect(checks.find((check) => check.track === "x402 / MagicBlock")).toMatchObject({
      status: "needs_funds",
      missingEnv: [],
      nextAction: expect.stringContaining("proof:magicblock"),
    });
  });

  it("marks Cloak ready when a devnet proof signature is recorded", () => {
    const checks = runTrackReadiness({
      CLOAK_NETWORK: "devnet",
      CLOAK_RELAY_URL: "https://api.devnet.cloak.ag",
      CLOAK_PROGRAM_ID: "Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h",
      CLOAK_MOCK_USDC_MINT: "61ro7AExqfk4dZYoCyRzTahahCC2TdUUZ4M5epMPunJf",
      CLOAK_DEVNET_PROOF_SIGNATURE: "ce1H6WWLZdCRZaxJPxdBE1iQL2GX2euFrnQWp54vtqfcKNLhDpb3foaaVmRCr1Axj7Reugq7nVTWJmMaAbACc4Y",
      ARCPAY_SIGNER_KEYPAIR_PATH: fileURLToPath(import.meta.url),
    });

    expect(checks.find((check) => check.track === "Cloak")).toMatchObject({
      status: "ready",
      missingEnv: [],
      nextAction: expect.stringContaining("devnet SOL deposit proof is recorded"),
    });
  });

  it("loads root env files without overriding explicit process values", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "arcpay-readiness-env-"));
    const envPath = path.join(directory, ".env");
    await writeFile(
      envPath,
      [
        "ZERION_API_KEY=zk_from_file",
        "DFLOW_API_BASE_URL=\"https://dev-quote-api.dflow.net\"",
        "DFLOW_QUOTE_AMOUNT=1000000",
      ].join("\n"),
      "utf8",
    );

    const env = loadReadinessEnvironment(
      {
        ZERION_API_KEY: "zk_from_process",
      },
      envPath,
    );

    expect(env.ZERION_API_KEY).toBe("zk_from_process");
    expect(env.DFLOW_API_BASE_URL).toBe("https://dev-quote-api.dflow.net");
    expect(env.DFLOW_QUOTE_AMOUNT).toBe("1000000");
  });
});
