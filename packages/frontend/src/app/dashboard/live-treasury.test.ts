import { describe, expect, it } from "vitest";
import {
  fetchLiveTreasuryStatus,
  normalizeServerUrl,
  parseLiveTreasuryStatus,
} from "./live-treasury";

describe("dashboard live treasury contract", () => {
  it("accepts a live Solana RPC treasury response", () => {
    const status = parseLiveTreasuryStatus(createLiveTreasuryStatus());

    expect(status.liveProof).toBe(true);
    expect(status.source).toBe("solana-rpc");
    expect(status.tokenBalances).toHaveLength(1);
    expect(status.endpoints[0]?.path).toBe("/agent/research");
  });

  it("rejects non-live or fabricated treasury responses", () => {
    expect(() =>
      parseLiveTreasuryStatus({
        ...createLiveTreasuryStatus(),
        liveProof: false,
      }),
    ).toThrow("Live treasury response must come from Solana RPC with liveProof=true.");
  });

  it("rejects malformed token balance rows", () => {
    expect(() =>
      parseLiveTreasuryStatus({
        ...createLiveTreasuryStatus(),
        tokenBalances: [{ mint: "mint-only" }],
      }),
    ).toThrow("tokenBalance.account must be a non-empty string.");
  });

  it("normalizes configured server URLs", () => {
    expect(normalizeServerUrl("http://localhost:4030/")).toBe("http://localhost:4030");
  });

  it("fetches and validates live treasury data", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));

      return {
        ok: true,
        json: async () => createLiveTreasuryStatus(),
      } as Response;
    };

    const status = await fetchLiveTreasuryStatus({
      serverUrl: "http://localhost:4030/",
      fetchImpl,
    });

    expect(calls).toEqual(["http://localhost:4030/live/treasury"]);
    expect(status.agentWallet).toBe("2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz");
  });

  it("passes selected network to the live treasury endpoint", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));

      return {
        ok: true,
        json: async () => createLiveTreasuryStatus(),
      } as Response;
    };

    await fetchLiveTreasuryStatus({
      fetchImpl,
      network: "mainnet",
    });

    expect(calls).toEqual(["http://localhost:4030/live/treasury?network=mainnet"]);
  });
});

function createLiveTreasuryStatus(): Record<string, unknown> {
  return {
    source: "solana-rpc",
    liveProof: true,
    network: "solana:devnet",
    rpcUrl: "https://api.devnet.solana.com",
    agentWallet: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
    programId: "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
    solBalance: {
      lamports: 1_000_000_000,
      sol: 1,
    },
    tokenBalances: [
      {
        mint: "HRyoekCs5hErv5wYpawrj5MdK3s4Y7DBFZLotTAt41Nj",
        account: "HHz3XNE36rU5PTMX2XPUDMnZraNvPst5aSxzrT2k8kcu",
        amount: "10000",
        decimals: 6,
        uiAmount: 0.01,
      },
    ],
    endpoints: [
      {
        method: "GET",
        path: "/agent/research",
        price: {
          amount: 0.01,
          currency: "USDC",
          mint: "HRyoekCs5hErv5wYpawrj5MdK3s4Y7DBFZLotTAt41Nj",
        },
        payTo: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
        network: "solana:devnet",
      },
    ],
    paymentMode: "production",
    generatedAt: "2026-05-05T16:30:00.000Z",
  };
}
