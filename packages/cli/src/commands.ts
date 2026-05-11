import {
  ArcPayTreasury,
  calculateCounterpartyScore,
  createDevelopmentCloakClient,
  createDevelopmentDFlowClient,
  createDevelopmentKaminoClient,
  createDevelopmentTorqueClient,
  createDevelopmentUmbraClient,
  getRecommendation,
  type SupportedCurrency,
} from "@arcpay/sdk";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ZERION_CLI_COMMAND = "zerion";
const ZERION_API_KEY_ENV = "ZERION_API_KEY";
const ZERION_OFFICIAL_REPO = "https://github.com/zeriontech/zerion-ai";
const ZERION_API_DOCS = "https://developers.zerion.io";
const ZERION_DASHBOARD = "https://dashboard.zerion.io";

export interface CliResult {
  readonly ok: true;
  readonly command: string;
  readonly data: unknown;
}

export interface TreasuryInitOptions {
  readonly agentId: string;
  readonly dailyLimit: string;
  readonly maxSingleTx?: string;
}

export interface ReceiveOptions {
  readonly currency: "AUDD" | "USDC" | "PUSD";
  readonly webhook?: string;
}

export interface PayOptions {
  readonly to: string;
  readonly amount: string;
  readonly currency: SupportedCurrency;
  readonly private?: boolean;
}

export interface YieldOptions {
  readonly action: "deposit" | "withdraw";
  readonly amount: string;
  readonly provider: "kamino";
}

export interface BalanceOptions {
  readonly agent: string;
  readonly liveStatusUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export interface ScoreOptions {
  readonly wallet: string;
  readonly txCount?: string;
}

export interface ZerionStatusOptions {
  readonly apiKey?: string;
  readonly commandExists?: (command: string) => Promise<boolean>;
}

export interface ZerionPolicyOptions {
  readonly chain: string;
  readonly maxSpendUsd: string;
  readonly expiresAt: string;
  readonly wallet?: string;
  readonly route?: "swap" | "bridge" | "rebalance";
  readonly allowedAsset?: readonly string[];
  readonly blockedAction?: readonly string[];
  readonly now?: Date;
}

export interface ZerionStatusData {
  readonly officialRepo: string;
  readonly apiDocs: string;
  readonly dashboard: string;
  readonly cliCommand: string;
  readonly packageName: string;
  readonly installed: boolean;
  readonly apiKeyEnv: string;
  readonly apiKeyConfigured: boolean;
  readonly readyForReadOnlyAnalytics: boolean;
  readonly readyForTrading: boolean;
  readonly installCommands: readonly string[];
  readonly nextRequiredItems: readonly string[];
}

export interface ZerionPolicyData {
  readonly liveProof: false;
  readonly status: "policy-ready";
  readonly policy: {
    readonly chainLock: string;
    readonly maxSpendUsd: number;
    readonly expiresAt: string;
    readonly wallet?: string;
    readonly route: "swap" | "bridge" | "rebalance";
    readonly allowedAssets: readonly string[];
    readonly blockedActions: readonly string[];
  };
  readonly enforcedBy: readonly string[];
  readonly nextRequiredItems: readonly string[];
}

export async function handleTreasuryInit(options: TreasuryInitOptions): Promise<CliResult> {
  const dailyLimit = Number(options.dailyLimit);
  const maxSingleTx = Number(options.maxSingleTx ?? Math.min(dailyLimit, 1_000));
  const treasury = createCliTreasury();
  const result = await treasury.createAgentTreasury({
    agentId: options.agentId,
    acceptedCurrencies: ["AUDD", "USDC", "PUSD"],
    privacy: "umbra",
    yield: {
      provider: "kamino",
      autoDeposit: true,
    },
    spendingPolicy: {
      dailyLimit,
      maxSingleTx,
      requireGoldRushScore: 70,
    },
  });

  return { ok: true, command: "treasury:init", data: result };
}

export async function handleReceive(options: ReceiveOptions): Promise<CliResult> {
  return {
    ok: true,
    command: "receive",
    data: {
      currency: options.currency,
      webhook: options.webhook,
      liveProof: false,
      status: "blocked",
      message: "CLI receive does not fabricate x402 settlement.",
      nextRequiredItems: [
        "Start the ArcPay server with real env values.",
        "Use the protected x402 endpoint and record the real payment verifier response.",
      ],
    },
  };
}

export async function handlePay(options: PayOptions): Promise<CliResult> {
  return {
    ok: true,
    command: "pay",
    data: {
      to: options.to,
      amount: Number(options.amount),
      currency: options.currency,
      private: options.private === true,
      liveProof: false,
      status: "blocked",
      message: "CLI pay does not execute or fake value movement.",
      nextRequiredItems: [
        "Use a funded wallet and the SDK/program payment path for a real transaction signature.",
        "Skip this command for now if avoiding real-funds transactions.",
      ],
    },
  };
}

export async function handleYield(options: YieldOptions): Promise<CliResult> {
  return {
    ok: true,
    command: "yield",
    data: {
      action: options.action,
      amount: Number(options.amount),
      provider: options.provider,
      liveProof: false,
      status: "blocked",
      message: "CLI yield does not fake Kamino deposits or withdrawals.",
      nextRequiredItems: [
        "Use `npm run smoke:kamino -w @arcpay/agent` for unsigned transaction-builder proof.",
        "Use a funded wallet and signer flow for final submitted Kamino proof.",
      ],
    },
  };
}

export async function handleBalance(options: BalanceOptions): Promise<CliResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const liveStatusUrl =
    options.liveStatusUrl ??
    `${(process.env.X402_SERVER_URL ?? "http://localhost:4030").replace(/\/$/, "")}/live/treasury`;

  try {
    const response = await fetchImpl(liveStatusUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`ArcPay live status returned HTTP ${response.status}.`);
    }

    const liveStatus = await response.json();

    return {
      ok: true,
      command: "balance",
      data: {
        agent: options.agent,
        aggregateOnly: true,
        source: "live-arcpay-server",
        liveProof: true,
        liveStatus,
      },
    };
  } catch (error) {
    return {
      ok: true,
      command: "balance",
      data: {
        agent: options.agent,
        aggregateOnly: true,
        source: "unavailable",
        liveProof: false,
        message:
          error instanceof Error
            ? error.message
            : "ArcPay live status is unavailable.",
        nextRequiredItems: [
          "Start `npm run dev -w @arcpay/server` with real RPC and wallet env values.",
          "Re-run `arcpay balance --agent <id>` after `/live/treasury` is reachable.",
        ],
      },
    };
  }
}

export async function handleScore(options: ScoreOptions): Promise<CliResult> {
  const txCount = Number(options.txCount ?? 150);
  const score = calculateCounterpartyScore(txCount, [
    { contract_ticker_symbol: "USDC", balance: "1" },
  ]);

  return {
    ok: true,
    command: "score",
    data: {
      wallet: options.wallet,
      score,
      txCount,
      recommendation: getRecommendation(score),
    },
  };
}

export async function handleZerionStatus(options: ZerionStatusOptions = {}): Promise<CliResult> {
  const apiKey = options.apiKey ?? process.env[ZERION_API_KEY_ENV];
  const commandExists = options.commandExists ?? defaultCommandExists;
  const installed = await commandExists(ZERION_CLI_COMMAND);
  const apiKeyConfigured = typeof apiKey === "string" && apiKey.startsWith("zk_");
  const nextRequiredItems: string[] = [];

  if (!installed) {
    nextRequiredItems.push("Install the official Zerion CLI with `npm install -g zerion-cli`.");
  }

  if (!apiKeyConfigured) {
    nextRequiredItems.push(
      "Generate a Zerion API key at dashboard.zerion.io and set `ZERION_API_KEY=zk_...`.",
    );
  }

  const data: ZerionStatusData = {
    officialRepo: ZERION_OFFICIAL_REPO,
    apiDocs: ZERION_API_DOCS,
    dashboard: ZERION_DASHBOARD,
    cliCommand: ZERION_CLI_COMMAND,
    packageName: "zerion-cli",
    installed,
    apiKeyEnv: ZERION_API_KEY_ENV,
    apiKeyConfigured,
    readyForReadOnlyAnalytics: installed && apiKeyConfigured,
    readyForTrading: installed && apiKeyConfigured,
    installCommands: [
      "npm install -g zerion-cli",
      "npx -y zerion-cli init -y --browser",
      "zerion config set apiKey zk_...",
    ],
    nextRequiredItems,
  };

  return { ok: true, command: "zerion:status", data };
}

export async function handleZerionPolicy(options: ZerionPolicyOptions): Promise<CliResult> {
  const chainLock = normalizePolicyText(options.chain, "chain");
  const maxSpendUsd = parsePositiveAmount(options.maxSpendUsd, "maxSpendUsd");
  const expiry = parseFutureDate(options.expiresAt, options.now ?? new Date());
  const allowedAssets = normalizePolicyList(options.allowedAsset ?? []);
  const blockedActions = normalizePolicyList(options.blockedAction ?? []);
  const route = parseZerionRoute(options.route ?? "swap");
  const wallet = options.wallet === undefined ? undefined : normalizePolicyText(options.wallet, "wallet");

  const data: ZerionPolicyData = {
    liveProof: false,
    status: "policy-ready",
    policy: {
      chainLock,
      maxSpendUsd,
      expiresAt: expiry.toISOString(),
      ...(wallet === undefined ? {} : { wallet }),
      route,
      allowedAssets,
      blockedActions,
    },
    enforcedBy: [
      "ArcPay CLI preflight policy validation",
      "Forked Zerion CLI execution wrapper before any live swap or bridge",
    ],
    nextRequiredItems: [
      "Fork `https://github.com/zeriontech/zerion-ai` and apply this policy in the execution command.",
      "Set `ZERION_API_KEY` from dashboard.zerion.io.",
      "Fund the execution wallet with enough mainnet gas and a tiny swap amount.",
      "Execute one real Zerion-routed transaction and record the transaction signature.",
    ],
  };

  return { ok: true, command: "zerion:policy", data };
}

export function printResult(result: CliResult): void {
  console.log(JSON.stringify(result, null, 2));
}

async function defaultCommandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ["--help"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

function createCliTreasury(): ArcPayTreasury {
  return new ArcPayTreasury({
    rpcUrl: process.env.QUICKNODE_RPC_URL ?? "https://api.devnet.solana.com",
    programId:
      process.env.ARCPAY_PROGRAM_ID ?? "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz",
    cloakViewingKey: process.env.CLOAK_VIEWING_KEY ?? "dev-viewing-key",
    kaminoMarketAddress:
      process.env.KAMINO_MARKET_ADDRESS ?? "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
    adapters: {
      cloak: createDevelopmentCloakClient(),
      dflow: createDevelopmentDFlowClient(),
      kamino: createDevelopmentKaminoClient(),
      torque: createDevelopmentTorqueClient(),
      umbra: createDevelopmentUmbraClient(),
    },
  });
}

function parsePositiveAmount(value: string, fieldName: string): number {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${fieldName} must be a positive number.`);
  }

  return amount;
}

function parseFutureDate(value: string, now: Date): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("expiresAt must be a valid ISO date.");
  }

  if (date.getTime() <= now.getTime()) {
    throw new Error("expiresAt must be in the future.");
  }

  return date;
}

function normalizePolicyList(values: readonly string[]): readonly string[] {
  return values.map((value) => normalizePolicyText(value, "policy list value"));
}

function normalizePolicyText(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function parseZerionRoute(value: string): "swap" | "bridge" | "rebalance" {
  if (value === "swap" || value === "bridge" || value === "rebalance") {
    return value;
  }

  throw new Error("route must be one of: swap, bridge, rebalance.");
}
