import type { TorqueClient } from "../types.js";

export interface DevelopmentTorqueClientOptions {
  readonly idFactory?: () => string;
}

/**
 * Creates a Torque-compatible client for local referral and leaderboard tests.
 */
export function createDevelopmentTorqueClient(
  options: DevelopmentTorqueClientOptions = {},
): TorqueClient {
  const nextId = options.idFactory ?? (() => crypto.randomUUID());

  return {
    campaigns: {
      async get(campaignId: string) {
        return { id: campaignId };
      },
    },
    referrals: {
      async create(params) {
        return {
          id: `dev_torque_referral_${nextId()}`,
          ...params,
          active: true,
        };
      },
    },
    leaderboard: {
      async get(params) {
        return {
          id: `dev_torque_leaderboard_${nextId()}`,
          ...params,
          entries: [],
        };
      },
    },
  };
}
