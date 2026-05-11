const DEFAULT_ARCPAY_SERVER_URL = "http://localhost:4030";

export interface LiveTreasuryStatus {
  readonly source: "solana-rpc";
  readonly liveProof: true;
  readonly network: string;
  readonly rpcUrl: string;
  readonly agentWallet: string;
  readonly programId: string;
  readonly solBalance: {
    readonly lamports: number;
    readonly sol: number;
  };
  readonly tokenBalances: readonly LiveTokenBalance[];
  readonly endpoints: readonly LiveEndpoint[];
  readonly paymentMode: string;
  readonly generatedAt: string;
}

export interface LiveTokenBalance {
  readonly mint: string;
  readonly account: string;
  readonly amount: string;
  readonly decimals: number;
  readonly uiAmount: number | null;
}

export interface LiveEndpoint {
  readonly method: string;
  readonly path: string;
  readonly price: {
    readonly amount: number;
    readonly currency: string;
    readonly mint: string;
  };
  readonly payTo: string;
  readonly network: string;
}

export interface FetchLiveTreasuryStatusParams {
  readonly network?: "devnet" | "mainnet";
  readonly serverUrl?: string;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

export async function fetchLiveTreasuryStatus({
  network,
  serverUrl = DEFAULT_ARCPAY_SERVER_URL,
  signal,
  fetchImpl = fetch,
}: FetchLiveTreasuryStatusParams = {}): Promise<LiveTreasuryStatus> {
  const url = new URL(`${normalizeServerUrl(serverUrl)}/live/treasury`);
  if (network) {
    url.searchParams.set("network", network);
  }

  const response = await fetchImpl(url.toString(), {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`ArcPay server returned HTTP ${response.status}.`);
  }

  return parseLiveTreasuryStatus(await response.json());
}

export function parseLiveTreasuryStatus(value: unknown): LiveTreasuryStatus {
  if (!isRecord(value)) {
    throw new Error("Live treasury response must be an object.");
  }

  if (value.source !== "solana-rpc" || value.liveProof !== true) {
    throw new Error("Live treasury response must come from Solana RPC with liveProof=true.");
  }

  const solBalance = readRecord(value.solBalance, "solBalance");
  const tokenBalances = readArray(value.tokenBalances, "tokenBalances").map(parseTokenBalance);
  const endpoints = readArray(value.endpoints, "endpoints").map(parseEndpoint);
  const generatedAt = readString(value.generatedAt, "generatedAt");

  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("generatedAt must be an ISO timestamp.");
  }

  return {
    source: "solana-rpc",
    liveProof: true,
    network: readString(value.network, "network"),
    rpcUrl: readString(value.rpcUrl, "rpcUrl"),
    agentWallet: readString(value.agentWallet, "agentWallet"),
    programId: readString(value.programId, "programId"),
    solBalance: {
      lamports: readFiniteNumber(solBalance.lamports, "solBalance.lamports"),
      sol: readFiniteNumber(solBalance.sol, "solBalance.sol"),
    },
    tokenBalances,
    endpoints,
    paymentMode: readString(value.paymentMode, "paymentMode"),
    generatedAt,
  };
}

export function normalizeServerUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("ArcPay server URL is required.");
  }

  return trimmed.replace(/\/+$/, "");
}

function parseTokenBalance(value: unknown): LiveTokenBalance {
  const balance = readRecord(value, "tokenBalance");

  return {
    mint: readString(balance.mint, "tokenBalance.mint"),
    account: readString(balance.account, "tokenBalance.account"),
    amount: readString(balance.amount, "tokenBalance.amount"),
    decimals: readNonNegativeInteger(balance.decimals, "tokenBalance.decimals"),
    uiAmount:
      balance.uiAmount === null ? null : readFiniteNumber(balance.uiAmount, "tokenBalance.uiAmount"),
  };
}

function parseEndpoint(value: unknown): LiveEndpoint {
  const endpoint = readRecord(value, "endpoint");
  const price = readRecord(endpoint.price, "endpoint.price");

  return {
    method: readString(endpoint.method, "endpoint.method"),
    path: readString(endpoint.path, "endpoint.path"),
    price: {
      amount: readFiniteNumber(price.amount, "endpoint.price.amount"),
      currency: readString(price.currency, "endpoint.price.currency"),
      mint: readString(price.mint, "endpoint.price.mint"),
    },
    payTo: readString(endpoint.payTo, "endpoint.payTo"),
    network: readString(endpoint.network, "endpoint.network"),
  };
}

function readRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  return value;
}

function readArray(value: unknown, fieldName: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return value;
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value;
}

function readFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }

  return value;
}

function readNonNegativeInteger(value: unknown, fieldName: string): number {
  const parsed = readFiniteNumber(value, fieldName);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
