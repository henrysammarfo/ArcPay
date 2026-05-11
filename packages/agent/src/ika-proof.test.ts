import { Keypair } from "@solana/web3.js";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runIkaPreAlphaProof } from "./ika-proof.js";

describe("Ika pre-alpha proof", () => {
  it("passes when the documented program is executable and signer has lamports", async () => {
    const signerPath = await writeTempKeypair();
    const result = await runIkaPreAlphaProof(
      {
        rpcUrl: "https://api.devnet.solana.com",
        grpcEndpoint: "https://pre-alpha-dev-1.ika.ika-network.net:443",
        programId: "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY",
        signerKeypairPath: signerPath,
      },
      {
        connection: {
          getAccountInfo: async () => ({ executable: true }) as never,
          getBalance: async () => 1,
        },
      },
    );

    expect(result).toMatchObject({
      status: "passed",
      programExecutable: true,
      signerLamports: 1,
      nextStep: expect.stringContaining("official Ika dWallet transaction flow"),
    });
  });

  it("reports needs_funds without pretending a dWallet transaction happened", async () => {
    const signerPath = await writeTempKeypair();
    const result = await runIkaPreAlphaProof(
      {
        rpcUrl: "https://api.devnet.solana.com",
        grpcEndpoint: "https://pre-alpha-dev-1.ika.ika-network.net:443",
        programId: "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY",
        signerKeypairPath: signerPath,
      },
      {
        connection: {
          getAccountInfo: async () => ({ executable: true }) as never,
          getBalance: async () => 0,
        },
      },
    );

    expect(result).toMatchObject({
      status: "needs_funds",
      nextStep: expect.stringContaining("Fund the signer"),
    });
  });
});

async function writeTempKeypair(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "arcpay-ika-proof-"));
  const keypair = Keypair.generate();
  const signerPath = path.join(directory, "id.json");
  await writeFile(signerPath, JSON.stringify(Array.from(keypair.secretKey)), "utf8");
  return signerPath;
}
