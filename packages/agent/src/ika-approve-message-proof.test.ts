import { Keypair, PublicKey } from "@solana/web3.js";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runIkaApproveMessageProof } from "./ika-approve-message-proof.js";

const IKA_PROGRAM_ID = "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY";

describe("Ika ApproveMessage proof", () => {
  it("builds a real Ika ApproveMessage transaction without submitting by default", async () => {
    const signerPath = await writeTempKeypair();
    const dWalletAddress = Keypair.generate().publicKey.toBase58();
    const proof = await runIkaApproveMessageProof(
      {
        rpcUrl: "https://api.devnet.solana.com",
        programId: IKA_PROGRAM_ID,
        signerKeypairPath: signerPath,
        dWalletAddress,
        requestedSpendUsd: 5,
        maxSpendUsd: 8,
        policyExpirySeconds: 900,
        submit: false,
      },
      {
        now: () => 1_778_000_000_000,
        connection: {
          getAccountInfo: async () => ({
            owner: new PublicKey(IKA_PROGRAM_ID),
            data: buildDWalletData(signerPath),
          }) as never,
          getLatestBlockhash: async () => ({
            blockhash: "11111111111111111111111111111111",
          }) as never,
          sendRawTransaction: async () => {
            throw new Error("submit should not be called");
          },
          confirmTransaction: async () => undefined as never,
        },
      },
    );

    expect(proof).toMatchObject({
      status: "ready",
      dWalletAddress,
      requestedSpendUsd: 5,
      maxSpendUsd: 8,
    });
    expect(proof.transactionSignature).toBeUndefined();
    expect(proof.message).toContain("ArcPay Ika policy approval");
    expect(proof.messageHashHex).toMatch(/^[0-9a-f]{64}$/);
    expect(proof.transactionSize).toBeGreaterThan(0);
  });

  it("rejects Ika approvals that exceed ArcPay policy", async () => {
    const signerPath = await writeTempKeypair();

    await expect(
      runIkaApproveMessageProof({
        rpcUrl: "https://api.devnet.solana.com",
        programId: IKA_PROGRAM_ID,
        signerKeypairPath: signerPath,
        dWalletAddress: Keypair.generate().publicKey.toBase58(),
        requestedSpendUsd: 9,
        maxSpendUsd: 8,
        policyExpirySeconds: 900,
        submit: false,
      }),
    ).rejects.toThrow("ArcPay policy rejected Ika approval");
  });
});

async function writeTempKeypair(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "arcpay-ika-approve-"));
  const keypair = Keypair.generate();
  const signerPath = path.join(directory, "id.json");
  await writeFile(signerPath, JSON.stringify(Array.from(keypair.secretKey)), "utf8");
  return signerPath;
}

function buildDWalletData(_signerPath: string): Buffer {
  const data = Buffer.alloc(153);
  data[0] = 2;
  data[1] = 1;
  data.writeUInt16LE(2, 34);
  data[36] = 1;
  data[37] = 32;
  Buffer.alloc(32, 7).copy(data, 38);
  return data;
}
