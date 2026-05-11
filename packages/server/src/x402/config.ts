export type X402Network = "solana:devnet" | "solana:mainnet";
export type X402PaymentMode = "development" | "production";

export interface AgentEndpointConfig {
  readonly method: "GET" | "POST";
  readonly path: "/agent/research" | "/agent/analysis" | "/agent/task";
  readonly price: {
    readonly amount: number;
    readonly currency: "USDC" | "AUDD";
    readonly mint: string;
  };
  readonly payTo: string;
  readonly network: X402Network;
}

export interface X402ServerConfig {
  readonly port: number;
  readonly rpcUrl: string;
  readonly programId: string;
  readonly agentWallet: string;
  readonly auddMint: string;
  readonly usdcMint: string;
  readonly network: X402Network;
  readonly paymentMode: X402PaymentMode;
  readonly quickNodeWebhookSecret?: string;
  readonly quickNodeWebhookStorePath?: string;
  readonly replayStorePath?: string;
  readonly endpoints: readonly AgentEndpointConfig[];
}

/**
 * Loads and validates x402 server configuration from environment variables.
 */
export function loadX402ServerConfig(env: NodeJS.ProcessEnv = process.env): X402ServerConfig {
  const port = Number(env.X402_SERVER_PORT ?? 4030);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("X402_SERVER_PORT must be a valid TCP port.");
  }

  const rpcUrl = readRequiredEnv(env, "QUICKNODE_RPC_URL");
  const programId = readRequiredEnv(env, "ARCPAY_PROGRAM_ID");
  const agentWallet = readRequiredEnv(env, "AGENT_WALLET_ADDRESS");
  const auddMint = readRequiredEnv(env, "AUDD_MINT_ADDRESS");
  const usdcMint = readRequiredEnv(env, "USDC_MINT_ADDRESS");
  const network = env.SOLANA_NETWORK === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
  const paymentMode = env.ARCPAY_PAYMENT_MODE === "production" ? "production" : "development";
  const quickNodeWebhookSecret = env.QUICKNODE_WEBHOOK_SECRET?.trim() || undefined;
  const quickNodeWebhookStorePath =
    env.ARCPAY_QUICKNODE_WEBHOOK_STORE_PATH?.trim() ||
    (quickNodeWebhookSecret === undefined ? undefined : ".arcpay-quicknode-webhooks.json");
  const replayStorePath =
    env.ARCPAY_REPLAY_STORE_PATH?.trim() ||
    (paymentMode === "production" ? ".arcpay-payment-replays.json" : undefined);

  return {
    port,
    rpcUrl,
    programId,
    agentWallet,
    auddMint,
    usdcMint,
    network,
    paymentMode,
    quickNodeWebhookSecret,
    quickNodeWebhookStorePath,
    replayStorePath,
    endpoints: [
      {
        method: "GET",
        path: "/agent/research",
        price: { amount: 0.01, currency: "USDC", mint: usdcMint },
        payTo: agentWallet,
        network,
      },
      {
        method: "GET",
        path: "/agent/analysis",
        price: { amount: 0.05, currency: "AUDD", mint: auddMint },
        payTo: agentWallet,
        network,
      },
      {
        method: "POST",
        path: "/agent/task",
        price: { amount: 0.1, currency: "USDC", mint: usdcMint },
        payTo: agentWallet,
        network,
      },
    ],
  };
}

function readRequiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}
