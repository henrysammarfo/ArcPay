import { describe, expect, it, vi } from "vitest";
import { createDevelopmentKaminoClient } from "./development.js";
import { autoDepositToKamino, createKaminoRestClient, withdrawFromKamino } from "./kamino.js";
import { createLpAgentRestClient } from "./meteora-lp.js";

const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const wallet = "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz";
const marketAddress = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
const reserveAddress = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWZ2bFpg3A5bD5Yz";

describe("yield adapters", () => {
  it("deposits idle funds through a Kamino-compatible adapter", async () => {
    const kamino = createDevelopmentKaminoClient({
      apy: 0.08,
      idFactory: () => "fixed",
    });

    const result = await autoDepositToKamino(kamino, {
      marketAddress,
      mint: usdcMint,
      amount: 100,
      agentWallet: wallet,
    });

    expect(result).toEqual({
      deposited: 100,
      apy: 0.08,
      earning: `${100 * 0.08 / 365}/day`,
      txId: "dev_kamino_deposit_fixed",
    });
  });

  it("withdraws funds through a Kamino-compatible adapter", async () => {
    const kamino = createDevelopmentKaminoClient({ idFactory: () => "fixed" });

    const result = await withdrawFromKamino(kamino, {
      marketAddress,
      mint: usdcMint,
      amount: 40,
      agentWallet: wallet,
    });

    expect(result).toEqual({
      withdrawn: 40,
      txId: "dev_kamino_withdraw_fixed",
    });
  });

  it("builds an unsigned Kamino REST deposit transaction", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          transaction: "base64-deposit-transaction",
        }),
        { status: 200 },
      ),
    );
    const kamino = createKaminoRestClient({
      baseUrl: "https://kamino.test",
      fetchImpl,
      reserveByMint: {
        [usdcMint]: reserveAddress,
      },
      apyByMint: {
        [usdcMint]: 0.07,
      },
    });

    const result = await autoDepositToKamino(kamino, {
      marketAddress,
      mint: usdcMint,
      amount: 100,
      agentWallet: wallet,
    });

    expect(result).toEqual({
      deposited: 100,
      apy: 0.07,
      earning: `${100 * 0.07 / 365}/day`,
      transaction: "base64-deposit-transaction",
      txId: undefined,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://kamino.test/ktx/klend/deposit",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const depositRequestInit = fetchImpl.mock.calls[0]?.[1];
    expect(JSON.parse(String(depositRequestInit?.body))).toEqual({
      wallet,
      market: marketAddress,
      reserve: reserveAddress,
      amount: "100",
    });
  });

  it("builds an unsigned Kamino REST withdraw transaction", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          transaction: "base64-withdraw-transaction",
        }),
        { status: 200 },
      ),
    );
    const kamino = createKaminoRestClient({
      baseUrl: "https://kamino.test",
      fetchImpl,
      reserveByMint: {
        [usdcMint]: reserveAddress,
      },
    });

    const result = await withdrawFromKamino(kamino, {
      marketAddress,
      mint: usdcMint,
      amount: 40,
      agentWallet: wallet,
    });

    expect(result).toEqual({
      withdrawn: 40,
      transaction: "base64-withdraw-transaction",
      txId: undefined,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://kamino.test/ktx/klend/withdraw",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("rejects malformed Kamino REST transaction responses", async () => {
    const kamino = createKaminoRestClient({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
      reserveByMint: {
        [usdcMint]: reserveAddress,
      },
    });

    await expect(
      autoDepositToKamino(kamino, {
        marketAddress,
        mint: usdcMint,
        amount: 100,
        agentWallet: wallet,
      }),
    ).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
    });
  });

  it("fetches Meteora pool info through the official LP Agent REST API", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            id: "pool-1",
          },
        }),
        { status: 200 },
      ),
    );

    const client = createLpAgentRestClient({
      apiKey: "lp-test",
      fetchImpl,
    });
    const result = await client.getPoolInfo({ poolId: "pool-1" });

    expect(result.poolId).toBe("pool-1");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.lpagent.io/open-api/v1/pools/pool-1/info",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-api-key": "lp-test",
        }),
      }),
    );
  });

  it("fetches LP Agent positions without leaking the API key", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [{ id: "position-1" }, { id: "position-2" }],
        }),
        { status: 200 },
      ),
    );

    const client = createLpAgentRestClient({
      apiKey: "lp-secret",
      baseUrl: "https://api.lpagent.io/open-api/v1/",
      fetchImpl,
    });
    const result = await client.getPositions({ ownerAddress: wallet });

    expect(result.ownerAddress).toBe(wallet);
    expect(result.positionCount).toBe(2);
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://api.lpagent.io/open-api/v1/lp-positions/opening?owner=${wallet}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-api-key": "lp-secret",
        }),
      }),
    );
  });

  it("builds an unsigned LP Agent Zap-In transaction request", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          data: {
            addLiquidityTxsWithJito: ["base64-zap-in-transaction"],
          },
        }),
        { status: 200 },
      ),
    );

    const client = createLpAgentRestClient({
      apiKey: "lp-secret",
      baseUrl: "https://api.lpagent.io/open-api/v1/",
      fetchImpl,
    });
    const result = await client.generateZapInTransaction({
      poolId: "pool-1",
      ownerAddress: wallet,
      inputSol: 0.01,
      percentX: 0.5,
      slippageBps: 25,
    });

    expect(result).toEqual({
      ownerAddress: wallet,
      poolId: "pool-1",
      raw: {
        data: {
          addLiquidityTxsWithJito: ["base64-zap-in-transaction"],
        },
      },
      transactionCount: 1,
      transactions: ["base64-zap-in-transaction"],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.lpagent.io/open-api/v1/pools/pool-1/add-tx",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-api-key": "lp-secret",
        }),
      }),
    );
    const requestInit = fetchImpl.mock.calls[0]?.[1];
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      inputSOL: 0.01,
      mode: "zap-in",
      owner: wallet,
      percentX: 0.5,
      provider: "JUPITER_ULTRA",
      slippage_bps: 25,
      stratergy: "Spot",
    });
  });

  it("rejects malformed LP Agent Zap-In responses", async () => {
    const client = createLpAgentRestClient({
      apiKey: "lp-secret",
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })),
    });

    await expect(
      client.generateZapInTransaction({
        poolId: "pool-1",
        ownerAddress: wallet,
        inputSol: 0.01,
      }),
    ).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
    });
  });
});
