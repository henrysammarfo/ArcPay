import express, { type Express } from "express";
import { Connection, PublicKey } from "@solana/web3.js";
import { loadX402ServerConfig, type X402ServerConfig } from "./config.js";
import {
  createPaymentMiddleware,
  type PaymentProofStatus,
  type PaymentVerifier,
} from "./payment-middleware.js";
import {
  FilePaymentReplayStore,
  InMemoryPaymentReplayStore,
  SolanaPaymentVerifier,
} from "./solana-payment-verifier.js";
import {
  FileQuickNodeWebhookStore,
  InMemoryQuickNodeWebhookStore,
  QUICKNODE_WEBHOOK_SECRET_HEADER,
  validateQuickNodeWebhookPayload,
  verifyQuickNodeWebhookSecret,
  type QuickNodeWebhookStore,
} from "./quicknode-webhook.js";
import { readLiveQvacDecision } from "./qvac-live.js";

export interface CreateArcPayX402ServerOptions {
  readonly paymentVerifier?: PaymentVerifier;
  readonly quickNodeWebhookStore?: QuickNodeWebhookStore;
}

/**
 * Creates the ArcPay x402 Express app.
 */
export function createArcPayX402Server(
  config: X402ServerConfig,
  options: CreateArcPayX402ServerOptions = {},
): Express {
  const app = express();
  const connection = new Connection(config.rpcUrl, "confirmed");
  const quickNodeWebhookStore =
    options.quickNodeWebhookStore ??
    (config.quickNodeWebhookStorePath === undefined
      ? new InMemoryQuickNodeWebhookStore({
          securityConfigured: config.quickNodeWebhookSecret !== undefined,
        })
      : new FileQuickNodeWebhookStore({
          path: config.quickNodeWebhookStorePath,
          securityConfigured: config.quickNodeWebhookSecret !== undefined,
        }));

  app.use((request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader(
      "Access-Control-Allow-Headers",
      `content-type,x-payment,x-arcpay-dev-payment,${QUICKNODE_WEBHOOK_SECRET_HEADER}`,
    );
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });
  app.use(
    express.json({
      verify(request, _response, buffer) {
        (request as typeof request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      },
    }),
  );

  for (const endpoint of config.endpoints) {
    const middleware = createPaymentMiddleware({
      endpoint,
      mode: config.paymentMode,
      verifier: options.paymentVerifier,
    });

    if (endpoint.method === "GET" && endpoint.path === "/agent/research") {
      app.get(endpoint.path, middleware, (_request, response) => {
        response.json({
          result: "Research endpoint accepted payment gate.",
          paidIn: "USDC",
          liveProof: getPaymentProof(response.locals.paymentProof).liveProof,
          paymentProof: getPaymentProof(response.locals.paymentProof),
          timestamp: Date.now(),
        });
      });
    }

    if (endpoint.method === "GET" && endpoint.path === "/agent/analysis") {
      app.get(endpoint.path, middleware, (_request, response) => {
        response.json({
          result: "Analysis endpoint accepted payment gate.",
          paidIn: "AUDD",
          liveProof: getPaymentProof(response.locals.paymentProof).liveProof,
          paymentProof: getPaymentProof(response.locals.paymentProof),
          timestamp: Date.now(),
        });
      });
    }

    if (endpoint.method === "POST" && endpoint.path === "/agent/task") {
      app.post(endpoint.path, middleware, (_request, response) => {
        response.json({
          result: "Task endpoint accepted payment gate.",
          paidIn: "USDC",
          liveProof: getPaymentProof(response.locals.paymentProof).liveProof,
          paymentProof: getPaymentProof(response.locals.paymentProof),
          timestamp: Date.now(),
        });
      });
    }
  }

  app.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "arcpay-x402",
      programId: config.programId,
      network: config.network,
    });
  });

  app.get("/live/treasury", async (request, response, next) => {
    try {
      const requestedNetwork = parseRequestedNetwork(request.query.network);
      if (requestedNetwork && requestedNetwork !== config.network) {
        response.status(409).json({
          error: "NETWORK_MISMATCH",
          requestedNetwork,
          serverNetwork: config.network,
          message:
            "Restart the ArcPay server with matching SOLANA_NETWORK/RPC env before using this network.",
        });
        return;
      }

      response.json(await readLiveTreasuryStatus(config, connection));
    } catch (error) {
      next(error);
    }
  });

  app.post("/webhooks/quicknode", (request, response, next) => {
    try {
      if (!verifyQuickNodeWebhookSecret(request, response, config.quickNodeWebhookSecret)) {
        return;
      }

      validateQuickNodeWebhookPayload(request.body);
      const event = quickNodeWebhookStore.record(request.body);

      response.status(202).json({
        accepted: true,
        liveProof: true,
        source: event.source,
        eventId: event.eventId,
        receivedAt: event.receivedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/live/quicknode", (_request, response) => {
    response.json(quickNodeWebhookStore.status());
  });

  app.get("/live/qvac", async (_request, response, next) => {
    try {
      response.json(await readLiveQvacDecision());
    } catch (error) {
      next(error);
    }
  });

  return app;
}

function parseRequestedNetwork(value: unknown): X402ServerConfig["network"] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "devnet" || raw === "solana:devnet") {
    return "solana:devnet";
  }

  if (raw === "mainnet" || raw === "solana:mainnet") {
    return "solana:mainnet";
  }

  throw new Error("network query must be devnet or mainnet.");
}

interface LiveTokenBalance {
  readonly mint: string;
  readonly account: string;
  readonly amount: string;
  readonly decimals: number;
  readonly uiAmount: number | null;
}

interface LiveTreasuryStatus {
  readonly source: "solana-rpc";
  readonly liveProof: true;
  readonly network: X402ServerConfig["network"];
  readonly rpcUrl: string;
  readonly agentWallet: string;
  readonly programId: string;
  readonly solBalance: {
    readonly lamports: number;
    readonly sol: number;
  };
  readonly tokenBalances: readonly LiveTokenBalance[];
  readonly endpoints: X402ServerConfig["endpoints"];
  readonly paymentMode: X402ServerConfig["paymentMode"];
  readonly generatedAt: string;
}

async function readLiveTreasuryStatus(
  config: X402ServerConfig,
  connection: Connection,
): Promise<LiveTreasuryStatus> {
  const owner = new PublicKey(config.agentWallet);
  const [lamports, tokenAccounts] = await Promise.all([
    connection.getBalance(owner, "confirmed"),
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    }),
  ]);

  return {
    source: "solana-rpc",
    liveProof: true,
    network: config.network,
    rpcUrl: config.rpcUrl,
    agentWallet: config.agentWallet,
    programId: config.programId,
    solBalance: {
      lamports,
      sol: lamports / 1_000_000_000,
    },
    tokenBalances: tokenAccounts.value.map((account) => {
      const info = account.account.data.parsed.info;
      const tokenAmount = info.tokenAmount;

      return {
        mint: String(info.mint),
        account: account.pubkey.toBase58(),
        amount: String(tokenAmount.amount),
        decimals: Number(tokenAmount.decimals),
        uiAmount: tokenAmount.uiAmount === null ? null : Number(tokenAmount.uiAmount),
      };
    }),
    endpoints: config.endpoints,
    paymentMode: config.paymentMode,
    generatedAt: new Date().toISOString(),
  };
}

function getPaymentProof(value: unknown): PaymentProofStatus {
  if (
    typeof value === "object" &&
    value !== null &&
    "liveProof" in value &&
    "mode" in value &&
    "proofType" in value
  ) {
    return value as PaymentProofStatus;
  }

  return {
    liveProof: false,
    mode: "development",
    proofType: "development-bypass",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadX402ServerConfig();
  const paymentVerifier =
    config.paymentMode === "production"
      ? new SolanaPaymentVerifier({
          connection: new Connection(config.rpcUrl, "confirmed"),
          replayStore: config.replayStorePath
            ? new FilePaymentReplayStore(config.replayStorePath)
            : new InMemoryPaymentReplayStore(),
        })
      : undefined;
  const app = createArcPayX402Server(config, { paymentVerifier });

  app.listen(config.port, () => {
    console.log(`ArcPay x402 server listening on :${config.port}`);
  });
}
