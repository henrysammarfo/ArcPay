import { Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  loadDFlowOrderProofEnvironment,
  runDFlowOrderProof,
  type DFlowOrderProofEnvironment,
} from "./dflow-order-proof.js";

describe("DFlow order proof runner", () => {
  it("loads safe order proof defaults without enabling submission", () => {
    const env = loadDFlowOrderProofEnvironment({
      QUICKNODE_RPC_URL: "https://api.mainnet-beta.solana.com",
      SOLANA_NETWORK: "mainnet-beta",
      ARCPAY_SIGNER_KEYPAIR_PATH: "/tmp/id.json",
    });

    expect(env.network).toBe("mainnet-beta");
    expect(env.signerKeypairPath).toBe(path.resolve("/tmp/id.json"));
    expect(env.dflowApiBaseUrl).toBe("https://dev-quote-api.dflow.net");
    expect(env.inputMintAddress).toBe("So11111111111111111111111111111111111111112");
    expect(env.quoteAmount).toBe(1_000_000n);
    expect(env.slippageBps).toBe(50);
    expect(env.submit).toBe(false);
  });

  it("signs a DFlow order transaction without submitting by default", async () => {
    const owner = Keypair.generate();
    const keypairPath = await writeKeypair(owner);
    const transaction = createUnsignedTransaction(owner);
    const dflow = {
      getOrder: vi.fn(async () => ({
        contextSlot: 123,
        executionMode: "sync" as const,
        inAmount: "1000000",
        inputMint: "SOL",
        minOutAmount: "1000000",
        otherAmountThreshold: "1000000",
        outAmount: "1050000",
        outputMint: "USDC",
        priceImpactPct: "0.01",
        slippageBps: 50,
        lastValidBlockHeight: 10_000,
        transaction: Buffer.from(transaction.serialize()).toString("base64"),
      })),
    };
    const env: DFlowOrderProofEnvironment = {
      rpcUrl: "https://api.mainnet-beta.solana.com",
      network: "mainnet-beta",
      signerKeypairPath: keypairPath,
      dflowApiBaseUrl: "https://dev-quote-api.dflow.net",
      inputMintAddress: "SOL",
      outputMintAddress: "USDC",
      quoteAmount: 1_000_000n,
      slippageBps: 50,
      submit: false,
    };

    const proof = await runDFlowOrderProof(env, { dflow });

    expect(proof).toMatchObject({
      status: "ready",
      source: "dflow-order",
      liveProof: true,
      owner: owner.publicKey.toBase58(),
      inAmount: "1000000",
      outAmount: "1050000",
      contextSlot: 123,
    });
    expect(proof.signedTransactionBytes).toBeGreaterThan(0);
    expect(dflow.getOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        userPublicKey: owner.publicKey.toBase58(),
        includeAddressLookupTables: false,
      }),
    );
  });

  it("submits the signed transaction only when explicitly enabled", async () => {
    const owner = Keypair.generate();
    const keypairPath = await writeKeypair(owner);
    const transaction = createUnsignedTransaction(owner);
    const connection = {
      sendRawTransaction: vi.fn(async () => "dflow-signature"),
      confirmTransaction: vi.fn(async () => ({
        context: { slot: 123 },
        value: { err: null },
      })),
    };
    const dflow = {
      getOrder: vi.fn(async () => ({
        contextSlot: 123,
        executionMode: "sync" as const,
        inAmount: "1000000",
        inputMint: "SOL",
        minOutAmount: "1000000",
        otherAmountThreshold: "1000000",
        outAmount: "1050000",
        outputMint: "USDC",
        priceImpactPct: "0.01",
        slippageBps: 50,
        lastValidBlockHeight: 10_000,
        transaction: Buffer.from(transaction.serialize()).toString("base64"),
      })),
    };

    const proof = await runDFlowOrderProof(
      {
        rpcUrl: "https://api.mainnet-beta.solana.com",
        network: "mainnet-beta",
        signerKeypairPath: keypairPath,
        dflowApiBaseUrl: "https://dev-quote-api.dflow.net",
        inputMintAddress: "SOL",
        outputMintAddress: "USDC",
        quoteAmount: 1_000_000n,
        slippageBps: 50,
        submit: true,
      },
      { dflow, connection },
    );

    expect(proof).toMatchObject({
      status: "submitted",
      transactionSignature: "dflow-signature",
      explorerTransactionUrl: "https://explorer.solana.com/tx/dflow-signature",
    });
    expect(connection.sendRawTransaction).toHaveBeenCalledOnce();
    expect(connection.confirmTransaction).toHaveBeenCalledOnce();
  });

  it("returns explicit insufficient funds status instead of throwing on funded-submit preflight failure", async () => {
    const owner = Keypair.generate();
    const keypairPath = await writeKeypair(owner);
    const transaction = createUnsignedTransaction(owner);
    const connection = {
      sendRawTransaction: vi.fn(async () => {
        throw new Error("Simulation failed: Attempt to debit an account but found no record of a prior credit.");
      }),
      confirmTransaction: vi.fn(),
    };
    const dflow = {
      getOrder: vi.fn(async () => ({
        contextSlot: 123,
        executionMode: "sync" as const,
        inAmount: "1000000",
        inputMint: "SOL",
        minOutAmount: "1000000",
        otherAmountThreshold: "1000000",
        outAmount: "1050000",
        outputMint: "USDC",
        priceImpactPct: "0.01",
        slippageBps: 50,
        lastValidBlockHeight: 10_000,
        transaction: Buffer.from(transaction.serialize()).toString("base64"),
      })),
    };

    const proof = await runDFlowOrderProof(
      {
        rpcUrl: "https://api.mainnet-beta.solana.com",
        network: "mainnet-beta",
        signerKeypairPath: keypairPath,
        dflowApiBaseUrl: "https://dev-quote-api.dflow.net",
        inputMintAddress: "SOL",
        outputMintAddress: "USDC",
        quoteAmount: 1_000_000n,
        slippageBps: 50,
        submit: true,
      },
      { dflow, connection },
    );

    expect(proof.status).toBe("insufficient_funds");
    expect(proof.submitError).toContain("Attempt to debit");
    expect(connection.confirmTransaction).not.toHaveBeenCalled();
  });

  it("requires a signable DFlow order transaction", async () => {
    const owner = Keypair.generate();
    const keypairPath = await writeKeypair(owner);
    const dflow = {
      getOrder: vi.fn(async () => ({
        contextSlot: 123,
        executionMode: "sync" as const,
        inAmount: "1000000",
        inputMint: "SOL",
        minOutAmount: "1000000",
        otherAmountThreshold: "1000000",
        outAmount: "1050000",
        outputMint: "USDC",
        priceImpactPct: "0.01",
        slippageBps: 50,
      })),
    };

    await expect(
      runDFlowOrderProof(
        {
          rpcUrl: "https://api.mainnet-beta.solana.com",
          network: "mainnet-beta",
          signerKeypairPath: keypairPath,
          dflowApiBaseUrl: "https://dev-quote-api.dflow.net",
          inputMintAddress: "SOL",
          outputMintAddress: "USDC",
          quoteAmount: 1_000_000n,
          slippageBps: 50,
          submit: false,
        },
        { dflow },
      ),
    ).rejects.toThrow("DFlow order did not include a signable transaction");
  });
});

async function writeKeypair(keypair: Keypair): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "arcpay-dflow-proof-"));
  const keypairPath = path.join(directory, "id.json");
  await writeFile(keypairPath, JSON.stringify(Array.from(keypair.secretKey)), "utf8");
  return keypairPath;
}

function createUnsignedTransaction(owner: Keypair): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: owner.publicKey,
    recentBlockhash: "11111111111111111111111111111111",
    instructions: [],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
