import { wrapExternalError } from "../errors.js";
import { assertNonEmptyString } from "../validation.js";
import type { RateQuote } from "../types.js";

export interface GetOptimalRateParams {
  readonly fromMint: string;
  readonly toMint: string;
  readonly apiKey: string;
  readonly chain?: "solana";
  readonly fetchImpl?: typeof fetch;
}

interface BirdeyePriceResponse {
  readonly data?: {
    readonly value?: number;
    readonly updateUnixTime?: number;
  };
}

/**
 * Fetches the current Birdeye price for a token mint. The build bible mentions
 * `@birdeye/sdk`, but that package is not available on npm, so this uses the
 * documented public API surface via fetch.
 */
export async function getOptimalRate(params: GetOptimalRateParams): Promise<RateQuote> {
  const fetcher = params.fetchImpl ?? fetch;
  const fromMint = assertNonEmptyString(params.fromMint, "fromMint");
  const toMint = assertNonEmptyString(params.toMint, "toMint");
  const apiKey = assertNonEmptyString(params.apiKey, "apiKey");

  try {
    const response = await fetcher(
      `https://public-api.birdeye.so/defi/price?address=${encodeURIComponent(fromMint)}`,
      {
        headers: {
          "X-API-KEY": apiKey,
          "x-chain": params.chain ?? "solana",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Birdeye responded with HTTP ${response.status}.`);
    }

    const data = await response.json() as BirdeyePriceResponse;
    const price = data.data?.value;
    const updateTime = data.data?.updateUnixTime;

    if (typeof price !== "number" || !Number.isFinite(price)) {
      throw new Error("Birdeye response did not include a numeric price.");
    }

    if (
      updateTime !== undefined &&
      (!Number.isInteger(updateTime) || updateTime <= 0)
    ) {
      throw new Error("Birdeye response included an invalid update time.");
    }

    return {
      fromMint,
      toMint,
      price,
      updateTime: updateTime ?? Math.floor(Date.now() / 1000),
    };
  } catch (cause) {
    throw wrapExternalError("Birdeye", "rate fetch", cause);
  }
}
