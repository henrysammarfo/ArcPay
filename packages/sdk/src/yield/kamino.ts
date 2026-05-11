import { PublicKey } from "@solana/web3.js";
import { ArcPaySdkError, wrapExternalError } from "../errors.js";
import { assertNonEmptyString, assertPositiveNumber } from "../validation.js";
import type { KaminoClient, KaminoMarket, KaminoReserve } from "../types.js";

const DEFAULT_KAMINO_API_BASE_URL = "https://api.kamino.finance";

export interface KaminoYieldParams {
  readonly marketAddress: string;
  readonly mint: string;
  readonly amount: number;
  readonly agentWallet: string;
}

export interface KaminoDepositResult {
  readonly deposited: number;
  readonly apy: number;
  readonly earning: string;
  readonly txId?: string;
  readonly transaction?: string;
}

export interface KaminoWithdrawResult {
  readonly withdrawn: number;
  readonly txId?: string;
  readonly transaction?: string;
}

export interface KaminoRestClientOptions {
  readonly reserveByMint: Readonly<Record<string, string>>;
  readonly apyByMint?: Readonly<Record<string, number>>;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

interface KaminoTransactionResponse {
  readonly transaction?: string;
}

/**
 * Deposits idle agent funds into a Kamino reserve through an injected Kamino adapter.
 */
export async function autoDepositToKamino(
  kamino: KaminoClient,
  params: KaminoYieldParams,
): Promise<KaminoDepositResult> {
  const marketAddress = assertNonEmptyString(params.marketAddress, "marketAddress");
  const mint = new PublicKey(assertNonEmptyString(params.mint, "mint"));
  const depositor = new PublicKey(assertNonEmptyString(params.agentWallet, "agentWallet"));
  const amount = assertPositiveNumber(params.amount, "amount");

  try {
    const market = await kamino.loadMarket({ marketAddress });
    const reserve = market.getReserveByMint(mint);

    if (!reserve) {
      throw new ArcPaySdkError("VALIDATION_ERROR", "No Kamino reserve exists for mint.");
    }

    const apy = reserve.stats?.supplyInterestAPY ?? 0;
    const tx = await market.depositToReserve({ amount, mint, depositor });

    return {
      deposited: amount,
      apy,
      earning: `${amount * apy / 365}/day`,
      txId: tx.txId ?? tx.signature,
      transaction: tx.transaction,
    };
  } catch (cause) {
    if (cause instanceof ArcPaySdkError) {
      throw cause;
    }

    throw wrapExternalError("Kamino", "auto deposit", cause);
  }
}

/**
 * Withdraws funds from Kamino when payments need liquidity.
 */
export async function withdrawFromKamino(
  kamino: KaminoClient,
  params: KaminoYieldParams,
): Promise<KaminoWithdrawResult> {
  const marketAddress = assertNonEmptyString(params.marketAddress, "marketAddress");
  const mint = new PublicKey(assertNonEmptyString(params.mint, "mint"));
  const depositor = new PublicKey(assertNonEmptyString(params.agentWallet, "agentWallet"));
  const amount = assertPositiveNumber(params.amount, "amount");

  try {
    const market = await kamino.loadMarket({ marketAddress });
    const tx = await market.withdrawFromReserve({ amount, mint, depositor });

    return {
      withdrawn: amount,
      txId: tx.txId ?? tx.signature,
      transaction: tx.transaction,
    };
  } catch (cause) {
    throw wrapExternalError("Kamino", "withdraw", cause);
  }
}

/**
 * Creates a Kamino REST-backed client that builds unsigned deposit/withdraw
 * transactions for a configured market reserve map.
 *
 * The returned transactions must be signed by the agent/treasury wallet and
 * submitted by orchestration code. This adapter does not hold keys or send funds.
 */
export function createKaminoRestClient(options: KaminoRestClientOptions): KaminoClient {
  const baseUrl = (options.baseUrl ?? DEFAULT_KAMINO_API_BASE_URL).replace(/\/+$/, "");
  const fetcher = options.fetchImpl ?? fetch;
  const reserveByMint = normalizeReserveMap(options.reserveByMint);
  const apyByMint = options.apyByMint ?? {};

  return {
    async loadMarket(params): Promise<KaminoMarket> {
      const marketAddress = assertNonEmptyString(params.marketAddress, "marketAddress");

      return {
        getReserveByMint(mint) {
          const mintAddress = mint.toBase58();
          const reserveAddress = reserveByMint.get(mintAddress);

          if (!reserveAddress) {
            return undefined;
          }

          return {
            address: new PublicKey(reserveAddress),
            stats: {
              supplyInterestAPY: apyByMint[mintAddress] ?? 0,
            },
          };
        },

        async depositToReserve(depositParams) {
          const reserveAddress = getReserveAddress(reserveByMint, depositParams.mint);
          const transaction = await requestKaminoTransaction({
            amount: depositParams.amount,
            baseUrl,
            fetcher,
            marketAddress,
            reserveAddress,
            wallet: depositParams.depositor.toBase58(),
            path: "/ktx/klend/deposit",
          });

          return { transaction };
        },

        async withdrawFromReserve(withdrawParams) {
          const reserveAddress = getReserveAddress(reserveByMint, withdrawParams.mint);
          const transaction = await requestKaminoTransaction({
            amount: withdrawParams.amount,
            baseUrl,
            fetcher,
            marketAddress,
            reserveAddress,
            wallet: withdrawParams.depositor.toBase58(),
            path: "/ktx/klend/withdraw",
          });

          return { transaction };
        },
      };
    },
  };
}

async function requestKaminoTransaction(params: {
  readonly amount: number;
  readonly baseUrl: string;
  readonly fetcher: typeof fetch;
  readonly marketAddress: string;
  readonly reserveAddress: string;
  readonly wallet: string;
  readonly path: "/ktx/klend/deposit" | "/ktx/klend/withdraw";
}): Promise<string> {
  const response = await params.fetcher(`${params.baseUrl}${params.path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      wallet: params.wallet,
      market: params.marketAddress,
      reserve: params.reserveAddress,
      amount: params.amount.toString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Kamino responded with HTTP ${response.status}.`);
  }

  const data = await response.json() as KaminoTransactionResponse;

  if (typeof data.transaction !== "string" || data.transaction.length === 0) {
    throw new Error("Kamino response did not include an encoded transaction.");
  }

  return data.transaction;
}

function normalizeReserveMap(reserveByMint: Readonly<Record<string, string>>): ReadonlyMap<string, string> {
  const entries = Object.entries(reserveByMint);

  if (entries.length === 0) {
    throw new ArcPaySdkError(
      "CONFIGURATION_ERROR",
      "Kamino reserveByMint must include at least one mint to reserve mapping.",
    );
  }

  return new Map(
    entries.map(([mint, reserve]) => [
      new PublicKey(assertNonEmptyString(mint, "reserveByMint mint")).toBase58(),
      new PublicKey(assertNonEmptyString(reserve, "reserveByMint reserve")).toBase58(),
    ]),
  );
}

function getReserveAddress(
  reserveByMint: ReadonlyMap<string, string>,
  mint: PublicKey,
): string {
  const reserveAddress = reserveByMint.get(mint.toBase58());

  if (!reserveAddress) {
    throw new ArcPaySdkError("VALIDATION_ERROR", "No Kamino reserve exists for mint.");
  }

  return reserveAddress;
}
