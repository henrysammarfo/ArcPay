import { describe, expect, it } from "vitest";
import {
  loadMagicBlockPrivatePaymentsEnvironment,
  runMagicBlockPrivatePaymentsProof,
} from "./magicblock-private-payments-proof.js";

const OWNER = "DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm";
const MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

describe("MagicBlock Private Payments proof", () => {
  it("loads documented defaults and validates Solana addresses", () => {
    const env = loadMagicBlockPrivatePaymentsEnvironment({
      MAGICBLOCK_PAYMENT_OWNER_ADDRESS: OWNER,
      MAGICBLOCK_PAYMENT_MINT_ADDRESS: MINT,
    });

    expect(env).toMatchObject({
      apiBaseUrl: "https://payments.magicblock.app",
      cluster: "devnet",
      ownerAddress: OWNER,
      mintAddress: MINT,
      amount: "1000000",
      buildDeposit: true,
      submitDeposit: false,
    });
  });

  it("calls health and SPL deposit builder", async () => {
    const calls: Array<{ readonly url: string; readonly init: RequestInit }> = [];
    const proof = await runMagicBlockPrivatePaymentsProof(
      {
        apiBaseUrl: "https://payments.magicblock.app",
        cluster: "devnet",
        ownerAddress: OWNER,
        mintAddress: MINT,
        amount: "1000000",
        buildDeposit: true,
        submitDeposit: false,
        rpcUrl: "https://api.devnet.solana.com",
        signerKeypairPath: "unused.json",
      },
      {
        fetchImpl: async (url, init) => {
          calls.push({ url: String(url), init: init ?? {} });
          if (String(url).endsWith("/health")) {
            return new Response(JSON.stringify({ status: "ok" }));
          }

          return new Response(JSON.stringify({ transactionBase64: Buffer.from("tx").toString("base64") }));
        },
      },
    );

    expect(calls.map((call) => call.url)).toEqual([
      "https://payments.magicblock.app/health",
      "https://payments.magicblock.app/v1/spl/deposit",
    ]);
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({
      owner: OWNER,
      mint: MINT,
      amount: 1000000,
      cluster: "devnet",
      initIfMissing: true,
      initVaultIfMissing: true,
      initAtasIfMissing: true,
      idempotent: true,
    });
    expect(proof).toMatchObject({
      status: "passed",
      health: "ok",
      depositBuilderReached: true,
      depositTransactionBytes: 2,
      depositResponseKeys: ["transactionBase64"],
      depositSubmitStatus: "not_requested",
    });
  });
});
