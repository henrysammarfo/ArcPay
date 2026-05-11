import { describe, expect, it, vi } from "vitest";
import { getOptimalRate } from "./birdeye.js";
import { createDevelopmentDFlowClient, createDevelopmentQvacClient } from "./development.js";
import { createDFlowRestClient, executeOptimalSwap } from "./dflow.js";
import { createQvacLocalClient, makeTreasuryDecision } from "./qvac-brain.js";

describe("intelligence adapters", () => {
  it("fetches Birdeye rates through REST", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            value: 1.12,
            updateUnixTime: 1777663903,
          },
        }),
        { status: 200 },
      ),
    );

    const result = await getOptimalRate({
      fromMint: "AUDD-mint",
      toMint: "USDC-mint",
      apiKey: "birdeye-test",
      fetchImpl,
    });

    expect(result).toEqual({
      fromMint: "AUDD-mint",
      toMint: "USDC-mint",
      price: 1.12,
      updateTime: 1777663903,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://public-api.birdeye.so/defi/price?address=AUDD-mint",
      {
        headers: {
          "X-API-KEY": "birdeye-test",
          "x-chain": "solana",
        },
      },
    );
  });

  it("rejects malformed Birdeye rates", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            value: "1.12",
            updateUnixTime: 1777663903,
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      getOptimalRate({
        fromMint: "AUDD-mint",
        toMint: "USDC-mint",
        apiKey: "birdeye-test",
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
    });
  });

  it("executes a DFlow-compatible swap", async () => {
    const dflow = createDevelopmentDFlowClient({
      idFactory: () => "fixed",
      outputMultiplier: 1.05,
    });

    const result = await executeOptimalSwap(dflow, {
      fromMint: "AUDD-mint",
      toMint: "USDC-mint",
      amount: 100,
      slippageBps: 50,
    });

    expect(result).toEqual({
      received: 105,
      txId: "dev_dflow_swap_fixed",
      mevProtected: true,
    });
  });

  it("fetches a DFlow REST quote with validated request parameters", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({
          outAmount: "1050000",
          requestId: "quote-1",
        }),
        { status: 200 },
      );
    });
    const dflow = createDFlowRestClient({
      apiKey: "dflow-test",
      baseUrl: "https://dflow.test",
      fetchImpl,
    });

    const quote = await dflow.getQuote({
      fromMint: "AUDD-mint",
      toMint: "USDC-mint",
      amount: 1_000_000,
      slippageBps: 50,
    });

    expect(quote).toEqual({
      outAmount: "1050000",
      requestId: "quote-1",
    });
    expect(requestedUrls[0]).toBe(
      "https://dflow.test/quote?inputMint=AUDD-mint&outputMint=USDC-mint&amount=1000000&slippageBps=50",
    );
    const quoteRequestInit = fetchImpl.mock.calls[0]?.[1];
    expect(quoteRequestInit).toMatchObject({
      headers: expect.any(Headers),
    });
    expect((quoteRequestInit?.headers as Headers).get("x-api-key")).toBe("dflow-test");
  });

  it("refuses to execute an unsigned DFlow REST quote", async () => {
    const dflow = createDFlowRestClient();

    await expect(dflow.executeSwap({ outAmount: "100" })).rejects.toMatchObject({
      code: "UNSUPPORTED_OPERATION",
    });
  });

  it("fetches a DFlow order through the current order endpoint", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrls.push(String(input));
      expect((init?.headers as Headers).get("x-api-key")).toBeNull();
      return new Response(
        JSON.stringify({
          contextSlot: 123,
          executionMode: "sync",
          inAmount: "1000000",
          inputMint: "SOL",
          minOutAmount: "1000000",
          otherAmountThreshold: "1000000",
          outAmount: "1050000",
          outputMint: "USDC",
          priceImpactPct: "0.01",
          slippageBps: 50,
          routePlan: [],
        }),
        { status: 200 },
      );
    });
    const dflow = createDFlowRestClient({
      baseUrl: "https://dev-quote-api.dflow.net",
      fetchImpl,
    });

    const order = await dflow.getOrder({
      inputMint: "SOL",
      outputMint: "USDC",
      amount: 1_000_000n,
      slippageBps: 50,
      includeAddressLookupTables: false,
    });

    expect(order).toMatchObject({
      contextSlot: 123,
      executionMode: "sync",
      inAmount: "1000000",
      outAmount: "1050000",
    });
    expect(requestedUrls[0]).toBe(
      "https://dev-quote-api.dflow.net/order?inputMint=SOL&outputMint=USDC&amount=1000000&slippageBps=50&includeAddressLookupTables=false",
    );
  });

  it("fetches and submits a signed DFlow declarative intent", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/intent?")) {
        return new Response(
          JSON.stringify({
            feeBudget: 5_000,
            inAmount: "1000000",
            inputMint: "AUDD-mint",
            minOutAmount: "1000000",
            otherAmountThreshold: "1000000",
            outAmount: "1050000",
            outputMint: "USDC-mint",
            priceImpactPct: "0.01",
            slippageBps: 50,
            expiry: {
              slotsAfterOpen: 40,
            },
            lastValidBlockHeight: 10_000,
            openTransaction: "base64-open-transaction",
          }),
          { status: 200 },
        );
      }

      expect(init?.method).toBe("POST");
      return new Response(
        JSON.stringify({
          openTransactionSignature: "signature",
          orderAddress: "order-address",
          programId: "program-id",
        }),
        { status: 200 },
      );
    });
    const dflow = createDFlowRestClient({
      baseUrl: "https://dflow.test",
      fetchImpl,
    });

    const quote = await dflow.getIntentQuote({
      inputMint: "AUDD-mint",
      outputMint: "USDC-mint",
      amount: 1_000_000n,
      slippageBps: 50,
      userPublicKey: "owner-wallet",
    });
    const result = await dflow.submitIntent({
      quoteResponse: quote,
      signedOpenTransaction: "signed-open-transaction",
    });

    expect(quote.openTransaction).toBe("base64-open-transaction");
    expect(result).toEqual({
      openTransactionSignature: "signature",
      orderAddress: "order-address",
      programId: "program-id",
    });
  });

  it("rejects malformed DFlow REST quotes", async () => {
    const dflow = createDFlowRestClient({
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({
            outAmount: "not-numeric",
          }),
          { status: 200 },
        ),
      ),
    });

    await expect(
      dflow.getQuote({
        fromMint: "AUDD-mint",
        toMint: "USDC-mint",
        amount: 1_000_000,
        slippageBps: 50,
      }),
    ).rejects.toThrow("outAmount must be numeric");
  });

  it("gets a QVAC-compatible treasury decision", async () => {
    const qvac = createDevelopmentQvacClient({
      action: "KEEP_YIELDING",
      confidence: 0.91,
      reason: "Yield is preferable in this test.",
    });

    const result = await makeTreasuryDecision({
      qvac,
      balance: 1_000,
      currentRate: 1,
      pendingPayments: [],
      kaminoAPY: 0.06,
    });

    expect(result).toEqual({
      action: "KEEP_YIELDING",
      confidence: 0.91,
      reason: "Yield is preferable in this test.",
    });
  });

  it("gets a treasury decision from a local QVAC SDK response", async () => {
    const calls: string[] = [];
    const qvac = createQvacLocalClient({
      sdk: {
        LLAMA_3_2_1B_INST_Q4_0: "test-model",
        async loadModel(params) {
          calls.push(`load:${params.modelSrc}:${params.modelType}`);
          expect(params.modelConfig).toBeUndefined();
          return "model-id";
        },
        async completion(params) {
          expect(params.stream).toBe(false);
          calls.push(`complete:${params.modelId}:${params.history.length}`);
          return {
            final: Promise.resolve({
              contentText: JSON.stringify({
                action: "KEEP_YIELDING",
                confidence: 0.82,
                reason: "Local model selected yield because there are no urgent payments.",
              }),
              toolCalls: [],
              raw: {
                fullText: "",
              },
            }),
          };
        },
        async unloadModel(params) {
          calls.push(`unload:${params.modelId}`);
        },
        async close() {
          calls.push("close");
        },
      },
    });

    const result = await makeTreasuryDecision({
      qvac,
      balance: 500,
      currentRate: 1.002,
      pendingPayments: [],
      kaminoAPY: 5.2,
    });

    expect(result).toEqual({
      action: "KEEP_YIELDING",
      confidence: 0.82,
      reason: "Local model selected yield because there are no urgent payments.",
    });
    expect(calls).toEqual([
      "load:test-model:llamacpp-completion",
      "complete:model-id:2",
      "unload:model-id",
      "close",
    ]);
  });

  it("reads streamed QVAC tokens from the official completion shape", async () => {
    async function* tokenStream(): AsyncGenerator<string> {
      yield "{\"action\":\"WAIT\",";
      yield "\"confidence\":0.73,";
      yield "\"reason\":\"Streamed local model output.\"}";
    }

    const qvac = createQvacLocalClient({
      modelConfig: { ctx_size: 2048 },
      sdk: {
        LLAMA_3_2_1B_INST_Q4_0: "test-model",
        async loadModel(params) {
          expect(params.modelConfig).toEqual({ ctx_size: 2048 });
          return "model-id";
        },
        completion() {
          return {
            tokenStream: tokenStream(),
          };
        },
      },
    });

    await expect(
      makeTreasuryDecision({
        qvac,
        balance: 500,
        currentRate: 1,
        pendingPayments: [],
        kaminoAPY: 5,
      }),
    ).resolves.toEqual({
      action: "WAIT",
      confidence: 0.73,
      reason: "Streamed local model output.",
    });
  });

  it("rejects malformed local QVAC decisions", async () => {
    const qvac = createQvacLocalClient({
      sdk: {
        LLAMA_3_2_1B_INST_Q4_0: "test-model",
        async loadModel() {
          return "model-id";
        },
        async completion() {
          return {
            text: JSON.stringify({
              action: "SEND_ALL_FUNDS",
              confidence: 1,
              reason: "not allowed",
            }),
          };
        },
      },
    });

    await expect(
      makeTreasuryDecision({
        qvac,
        balance: 500,
        currentRate: 1,
        pendingPayments: [],
        kaminoAPY: 5,
      }),
    ).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
    });
  });
});
