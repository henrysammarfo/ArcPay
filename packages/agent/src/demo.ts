import {
  ArcPayTreasury,
  createDevelopmentCloakClient,
  createDevelopmentDFlowClient,
  createDevelopmentKaminoClient,
  createDevelopmentQvacClient,
  createDevelopmentTorqueClient,
  createDevelopmentUmbraClient,
  registerReferral,
  scoreCounterparty,
  type ArcPayConfig,
  type GoldRushClientLike,
  type TreasuryDecision,
} from "@arcpay/sdk";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PROGRAM_ID = "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz";
const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEFAULT_AUDD_MINT = "HJiQv34JpPDZHt9g5yCRpFqMTCBhSMuSudYCABiXGBEX";
const DEFAULT_AGENT_WALLET = "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz";
const DEFAULT_KAMINO_MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
const DEFAULT_X402_SERVER_URL = "http://localhost:4030";

export interface DemoEnvironment {
  readonly rpcUrl: string;
  readonly programId: string;
  readonly agentWalletAddress: string;
  readonly auddMintAddress: string;
  readonly usdcMintAddress: string;
  readonly cloakViewingKey: string;
  readonly kaminoMarketAddress: string;
  readonly torqueCampaignId: string;
  readonly x402ServerUrl: string;
  readonly allowDevelopmentAdapters: boolean;
}

export interface DemoResult {
  readonly steps: readonly string[];
  readonly explorerLinks: readonly string[];
  readonly decision: TreasuryDecision;
  readonly x402ServerReachable: boolean;
}

interface X402ProbeResult {
  readonly reachable: boolean;
  readonly unpaidStatus?: number;
  readonly paidStatus?: number;
}

/**
 * Runs the build-bible live proof demo.
 *
 * By default this command prints only real readiness/proof state and does not
 * fabricate partner settlement. Set `ARCPAY_ALLOW_DEVELOPMENT_DEMO=true` only for
 * local engineering tests where deterministic development adapters are acceptable.
 */
export async function runArcPayDemo(
  env: DemoEnvironment = loadDemoEnvironment(),
): Promise<DemoResult> {
  const steps: string[] = [];
  const explorerLinks: string[] = [
    `https://explorer.solana.com/address/${env.programId}?cluster=devnet`,
  ];

  steps.push("Starting ArcPay demo on Solana devnet");
  steps.push(`Program ID: ${env.programId}`);
  steps.push(`Explorer: ${explorerLinks[0]}`);

  const x402 = await probeX402Server(env.x402ServerUrl);
  if (x402.reachable) {
    steps.push(`x402 unpaid probe returned HTTP ${x402.unpaidStatus}`);
    steps.push(
      `x402 development bypass probe returned HTTP ${x402.paidStatus}; this is not live payment proof`,
    );
  } else {
    steps.push(`x402 server not reachable at ${env.x402ServerUrl}; no payment proof recorded`);
  }

  if (!env.allowDevelopmentAdapters) {
    const decision: TreasuryDecision = {
      action: "WAIT",
      confidence: 1,
      reason:
        "Live proof mode does not run development adapters. Configure real partner credentials or explicitly enable ARCPAY_ALLOW_DEVELOPMENT_DEMO for local-only testing.",
    };

    steps.push("Skipped Umbra, Cloak, Kamino, DFlow, GoldRush, QVAC, and Torque demo adapters.");
    steps.push("No private settlement, yield deposit, swap, referral, or counterparty score was claimed.");
    steps.push("ArcPay live proof check complete");

    return {
      steps,
      explorerLinks,
      decision,
      x402ServerReachable: x402.reachable,
    };
  }

  steps.push("Development adapter mode enabled; following outputs are not submission proof.");

  const qvac = createDevelopmentQvacClient({
    action: "KEEP_YIELDING",
    confidence: 0.87,
    reason: "Balance is healthy and there are no urgent pending payments.",
  });
  const torque = createDevelopmentTorqueClient({ idFactory: createSequentialIdFactory("torque") });
  const treasury = createDemoTreasury(env, torque);

  const handle = await treasury.createAgentTreasury({
    agentId: "ada-research-agent-01",
    acceptedCurrencies: ["AUDD", "USDC", "PUSD"],
    privacy: "umbra",
    yield: {
      provider: "kamino",
      autoDeposit: true,
    },
    spendingPolicy: {
      dailyLimit: 5_000,
      maxSingleTx: 1_000,
      requireGoldRushScore: 70,
    },
  });

  steps.push(`Treasury initialized: ${handle.treasuryId}`);
  steps.push(
    "DEVELOPMENT ONLY treasury handle created; run proof:program:init for live PDA and transaction proof.",
  );

  const received = await treasury.receiveX402({
    amountUSD: 500,
    currency: "AUDD",
    mintAddress: env.auddMintAddress,
    payerWallet: "australian-client-wallet",
    agentWallet: env.agentWalletAddress,
  });

  steps.push(`DEVELOPMENT ONLY AUDD receive adapter returned: ${received.txId}`);
  steps.push(
    `DEVELOPMENT ONLY Umbra adapter shielded: ${received.shielded}; stealth address: ${received.stealthAddress}`,
  );
  steps.push(
    `DEVELOPMENT ONLY Kamino adapter depositing: ${received.yielding}; estimated earning: ${received.earned}`,
  );

  const decision = await qvac.reason({
    context: "Agent treasury: 500 AUDD received for Ada's agency.",
    context2: "Kamino APY: 6%. Pending payments: []",
    question: "Should ArcPay convert, keep yielding, execute payments, or wait?",
    options: ["CONVERT_NOW", "KEEP_YIELDING", "EXECUTE_PAYMENTS", "WAIT"],
  });
  steps.push(`DEVELOPMENT ONLY QVAC decision: ${decision.action} (${Math.round(decision.confidence * 100)}%)`);
  steps.push(`DEVELOPMENT ONLY QVAC reason: ${decision.reason}`);

  const conversion = await treasury.convertCurrency(
    env.auddMintAddress,
    env.usdcMintAddress,
    500,
  );
  steps.push(`DEVELOPMENT ONLY Birdeye-style AUDD/USDC rate: ${conversion.quote.price}`);
  steps.push(
    `DEVELOPMENT ONLY DFlow adapter swap prepared: ${conversion.txId}; MEV protected: ${conversion.mevProtected}`,
  );

  const goldRush = createDemoGoldRushClient(150);
  const counterparty = await scoreCounterparty(goldRush, "contractor-sol-address");
  steps.push(
    `DEVELOPMENT ONLY GoldRush-style score: ${counterparty.score}/100 ${counterparty.recommendation} for ${counterparty.wallet}`,
  );

  const payment = await treasury.payContractor({
    contractorId: "contractor-sol-address",
    amount: 200,
    currency: "SOL",
    note: "Content delivery batch 12",
    ownerViewingKey: env.cloakViewingKey,
  });
  steps.push(
    `DEVELOPMENT ONLY Cloak adapter batch: ${payment.txId}; private: ${payment.private}; settled: ${payment.settled}`,
  );

  const referral = await registerReferral(torque, {
    campaignId: env.torqueCampaignId,
    referrerWallet: env.agentWalletAddress,
    newCustomerWallet: "referred-agency-wallet",
  });
  steps.push(`DEVELOPMENT ONLY Torque adapter referral: ${formatUnknownId(referral)}; rebate active: true`);

  steps.push(`Real devnet program link: ${explorerLinks.join(", ")}`);
  steps.push("ArcPay demo complete");

  return {
    steps,
    explorerLinks,
    decision,
    x402ServerReachable: x402.reachable,
  };
}

export function loadDemoEnvironment(source: NodeJS.ProcessEnv = process.env): DemoEnvironment {
  return {
    rpcUrl: source.QUICKNODE_RPC_URL ?? DEFAULT_RPC_URL,
    programId: source.ARCPAY_PROGRAM_ID ?? DEFAULT_PROGRAM_ID,
    agentWalletAddress: source.AGENT_WALLET_ADDRESS ?? DEFAULT_AGENT_WALLET,
    auddMintAddress: source.AUDD_MINT_ADDRESS ?? DEFAULT_AUDD_MINT,
    usdcMintAddress: source.USDC_MINT_ADDRESS ?? DEFAULT_USDC_MINT,
    cloakViewingKey: source.CLOAK_VIEWING_KEY ?? "not-configured",
    kaminoMarketAddress: source.KAMINO_MARKET_ADDRESS ?? DEFAULT_KAMINO_MARKET,
    torqueCampaignId: source.TORQUE_CAMPAIGN_ID ?? "not-configured",
    x402ServerUrl: source.X402_SERVER_URL ?? DEFAULT_X402_SERVER_URL,
    allowDevelopmentAdapters: source.ARCPAY_ALLOW_DEVELOPMENT_DEMO === "true",
  };
}

export function createDemoGoldRushClient(txCount: number): GoldRushClientLike {
  return {
    TransactionService: {
      async getAllTransactionsForAddress() {
        return {
          data: {
            items: Array.from({ length: txCount }, (_, index) => ({ id: index })),
          },
        };
      },
    },
    BalanceService: {
      async getTokenBalancesForWalletAddress() {
        return {
          data: {
            items: [{ contract_ticker_symbol: "USDC", balance: "1" }],
          },
        };
      },
    },
  };
}

async function probeX402Server(serverUrl: string): Promise<X402ProbeResult> {
  try {
    const unpaid = await fetch(`${serverUrl}/agent/analysis`);
    const paid = await fetch(`${serverUrl}/agent/analysis`, {
      headers: {
        "x-arcpay-dev-payment": "paid",
      },
    });

    return {
      reachable: true,
      unpaidStatus: unpaid.status,
      paidStatus: paid.status,
    };
  } catch {
    return { reachable: false };
  }
}

function createDemoTreasury(env: DemoEnvironment, torque = createDevelopmentTorqueClient()): ArcPayTreasury {
  const ids = createSequentialIdFactory("demo");
  const config: ArcPayConfig = {
    rpcUrl: env.rpcUrl,
    programId: env.programId,
    birdeyeApiKey: "development-birdeye-key",
    cloakViewingKey: env.cloakViewingKey,
    kaminoMarketAddress: env.kaminoMarketAddress,
    adapters: {
      cloak: createDevelopmentCloakClient({ idFactory: ids }),
      dflow: createDevelopmentDFlowClient({ idFactory: ids, outputMultiplier: 1.002 }),
      fetch: createDevelopmentFetch(),
      goldRush: createDemoGoldRushClient(150),
      kamino: createDevelopmentKaminoClient({ apy: 0.06, idFactory: ids }),
      torque,
      umbra: createDevelopmentUmbraClient({ idFactory: ids }),
    },
  };

  return new ArcPayTreasury(config);
}

function createDevelopmentFetch(): typeof fetch {
  return async () =>
    new Response(
      JSON.stringify({
        data: {
          value: 1.002,
          updateUnixTime: Math.floor(Date.now() / 1000),
        },
      }),
      {
        headers: {
          "content-type": "application/json",
        },
        status: 200,
      },
    );
}

function createSequentialIdFactory(prefix: string): () => string {
  let id = 0;

  return () => `${prefix}_${(id += 1).toString().padStart(3, "0")}`;
}

function formatUnknownId(value: unknown): string {
  if (typeof value === "object" && value !== null && "id" in value && typeof value.id === "string") {
    return value.id;
  }

  return "unknown";
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  try {
    const result = await runArcPayDemo();
    for (const step of result.steps) {
      console.log(step);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
