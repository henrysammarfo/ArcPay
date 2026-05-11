import { Buffer } from "node:buffer";
import type { ParsedTransactionWithMeta } from "@solana/web3.js";
import type { Request } from "express";
import { describe, expect, it } from "vitest";
import type { AgentEndpointConfig } from "./config.js";
import {
  hasTokenPayment,
  InMemoryPaymentReplayStore,
  parsePaymentProof,
  SolanaPaymentVerifier,
} from "./solana-payment-verifier.js";

const VALID_SIGNATURE = "5".repeat(88);
const OTHER_SIGNATURE = "6".repeat(88);
const NOW_MS = 1_777_663_903_000;

const endpoint: AgentEndpointConfig = {
  method: "GET",
  path: "/agent/research",
  price: {
    amount: 0.01,
    currency: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  payTo: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
  network: "solana:devnet",
};

describe("Solana payment verifier", () => {
  it("parses raw, JSON, and base64 payment proofs", () => {
    const jsonProof = JSON.stringify({ signature: VALID_SIGNATURE });
    const base64Proof = Buffer.from(jsonProof, "utf8").toString("base64url");

    expect(parsePaymentProof(VALID_SIGNATURE)).toEqual({ signature: VALID_SIGNATURE });
    expect(parsePaymentProof(jsonProof)).toEqual({ signature: VALID_SIGNATURE });
    expect(parsePaymentProof(base64Proof)).toEqual({ signature: VALID_SIGNATURE });
    expect(parsePaymentProof("not-a-proof")).toBeNull();
  });

  it("accepts a confirmed token payment and rejects replay", async () => {
    const verifier = createVerifier(
      createTransaction({
        owner: endpoint.payTo,
        mint: endpoint.price.mint,
        postAmount: "10000",
      }),
    );

    await expect(verifier.verify(createRequest(VALID_SIGNATURE), endpoint)).resolves.toBe(true);
    await expect(verifier.verify(createRequest(VALID_SIGNATURE), endpoint)).resolves.toBe(false);
  });

  it("rejects payments to the wrong owner", async () => {
    const verifier = createVerifier(
      createTransaction({
        owner: "WrongOwner111111111111111111111111111111111",
        mint: endpoint.price.mint,
        postAmount: "10000",
      }),
    );

    await expect(verifier.verify(createRequest(VALID_SIGNATURE), endpoint)).resolves.toBe(false);
  });

  it("rejects payments using the wrong mint", async () => {
    const verifier = createVerifier(
      createTransaction({
        owner: endpoint.payTo,
        mint: "HJiQv34JpPDZHt9g5yCRpFqMTCBhSMuSudYCABiXGBEX",
        postAmount: "10000",
      }),
    );

    await expect(verifier.verify(createRequest(VALID_SIGNATURE), endpoint)).resolves.toBe(false);
  });

  it("rejects underpayments", async () => {
    const verifier = createVerifier(
      createTransaction({
        owner: endpoint.payTo,
        mint: endpoint.price.mint,
        postAmount: "9999",
      }),
    );

    await expect(verifier.verify(createRequest(VALID_SIGNATURE), endpoint)).resolves.toBe(false);
  });

  it("rejects stale transactions", async () => {
    const verifier = createVerifier(
      createTransaction({
        blockTime: Math.floor((NOW_MS - 11 * 60 * 1000) / 1000),
        owner: endpoint.payTo,
        mint: endpoint.price.mint,
        postAmount: "10000",
      }),
    );

    await expect(verifier.verify(createRequest(VALID_SIGNATURE), endpoint)).resolves.toBe(false);
  });

  it("detects token-balance deltas", () => {
    const transaction = createTransaction({
      owner: endpoint.payTo,
      mint: endpoint.price.mint,
      preAmount: "5000",
      postAmount: "15000",
    });

    expect(hasTokenPayment(transaction, endpoint)).toBe(true);
  });
});

function createVerifier(transaction: ParsedTransactionWithMeta | null): SolanaPaymentVerifier {
  return new SolanaPaymentVerifier({
    connection: {
      async getParsedTransaction(signature: string) {
        return signature === OTHER_SIGNATURE ? null : transaction;
      },
    },
    replayStore: new InMemoryPaymentReplayStore(() => NOW_MS),
    now: () => NOW_MS,
  });
}

function createRequest(paymentHeader: string): Request {
  return {
    header(name: string): string | undefined {
      return name.toLowerCase() === "x-payment" ? paymentHeader : undefined;
    },
  } as Request;
}

function createTransaction(params: {
  readonly blockTime?: number;
  readonly owner: string;
  readonly mint: string;
  readonly preAmount?: string;
  readonly postAmount: string;
}): ParsedTransactionWithMeta {
  return {
    blockTime: params.blockTime ?? Math.floor(NOW_MS / 1000),
    meta: {
      err: null,
      preTokenBalances: [
        {
          accountIndex: 1,
          mint: params.mint,
          owner: params.owner,
          programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          uiTokenAmount: {
            amount: params.preAmount ?? "0",
            decimals: 6,
            uiAmount: 0,
            uiAmountString: "0",
          },
        },
      ],
      postTokenBalances: [
        {
          accountIndex: 1,
          mint: params.mint,
          owner: params.owner,
          programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          uiTokenAmount: {
            amount: params.postAmount,
            decimals: 6,
            uiAmount: Number(params.postAmount) / 1_000_000,
            uiAmountString: String(Number(params.postAmount) / 1_000_000),
          },
        },
      ],
    },
    transaction: {},
  } as ParsedTransactionWithMeta;
}
