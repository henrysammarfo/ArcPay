import type { KaminoClient, KaminoMarket, KaminoReserve } from "../types.js";

export interface DevelopmentKaminoClientOptions {
  readonly apy?: number;
  readonly idFactory?: () => string;
}

/**
 * Creates a Kamino-compatible client for local smoke tests.
 *
 * This adapter does not move funds. It mirrors the SDK contract so orchestration
 * can be tested before live Kamino transactions are enabled.
 */
export function createDevelopmentKaminoClient(
  options: DevelopmentKaminoClientOptions = {},
): KaminoClient {
  const apy = options.apy ?? 0.06;
  const nextId = options.idFactory ?? (() => crypto.randomUUID());

  return {
    async loadMarket(): Promise<KaminoMarket> {
      const reserve: KaminoReserve = {
        stats: {
          supplyInterestAPY: apy,
        },
      };

      return {
        getReserveByMint() {
          return reserve;
        },

        async depositToReserve() {
          return {
            txId: `dev_kamino_deposit_${nextId()}`,
          };
        },

        async withdrawFromReserve() {
          return {
            txId: `dev_kamino_withdraw_${nextId()}`,
          };
        },
      };
    },
  };
}
