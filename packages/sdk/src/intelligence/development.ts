import type { DFlowClient, QvacClient, TreasuryAction, TreasuryDecision } from "../types.js";

export interface DevelopmentDFlowClientOptions {
  readonly idFactory?: () => string;
  readonly outputMultiplier?: number;
}

export interface DevelopmentQvacClientOptions {
  readonly action?: TreasuryAction;
  readonly confidence?: number;
  readonly reason?: string;
}

/**
 * Creates a DFlow-compatible client for local swap orchestration tests.
 *
 * This adapter does not submit trades.
 */
export function createDevelopmentDFlowClient(
  options: DevelopmentDFlowClientOptions = {},
): DFlowClient {
  const nextId = options.idFactory ?? (() => crypto.randomUUID());
  const outputMultiplier = options.outputMultiplier ?? 1;

  return {
    async getQuote(params) {
      return {
        ...params,
        quotedOutAmount: params.amount * outputMultiplier,
      };
    },

    async executeSwap(quote) {
      const quoted = quote as { readonly quotedOutAmount?: number };

      return {
        outAmount: quoted.quotedOutAmount ?? 0,
        txId: `dev_dflow_swap_${nextId()}`,
      };
    },
  };
}

/**
 * Creates a QVAC-compatible client for local treasury-decision tests.
 */
export function createDevelopmentQvacClient(
  options: DevelopmentQvacClientOptions = {},
): QvacClient {
  return {
    async reason(): Promise<TreasuryDecision> {
      return {
        action: options.action ?? "KEEP_YIELDING",
        confidence: options.confidence ?? 0.87,
        reason: options.reason ?? "Development policy selected a stable treasury action.",
      };
    },
  };
}
