import type { CloakClient, SupportedCurrency, UmbraClient } from "../types.js";
import { assertNonEmptyString, assertPositiveNumber } from "../validation.js";

export interface DevelopmentPrivacyAdapterOptions {
  readonly idFactory?: () => string;
}

/**
 * Creates a deterministic Umbra-compatible adapter for local smoke tests.
 *
 * This adapter does not provide real privacy. It exists so server, CLI, and agent
 * flows can exercise ArcPay orchestration before the production Umbra API is wired.
 */
export function createDevelopmentUmbraClient(
  options: DevelopmentPrivacyAdapterOptions = {},
): UmbraClient {
  const nextId = options.idFactory ?? (() => crypto.randomUUID());

  return {
    async generateStealthAddress(payerWallet: string): Promise<string> {
      const payer = assertNonEmptyString(payerWallet, "payerWallet");
      return `dev_umbra_${payer.slice(0, 8)}_${nextId()}`;
    },

    async sendToStealth(params): Promise<{ readonly signature: string }> {
      assertNonEmptyString(params.stealthAddress, "stealthAddress");
      assertNonEmptyString(params.mint, "mint");
      assertNonEmptyString(params.senderWallet, "senderWallet");
      assertPositiveNumber(params.amount, "amount");

      return {
        signature: `dev_umbra_tx_${nextId()}`,
      };
    },
  };
}

/**
 * Creates a deterministic Cloak-compatible adapter for local smoke tests.
 *
 * This adapter does not perform private settlement. It preserves the ArcPay
 * contract shape while the real Cloak UTXO transaction flow is integrated.
 */
export function createDevelopmentCloakClient(
  options: DevelopmentPrivacyAdapterOptions = {},
): CloakClient {
  const nextId = options.idFactory ?? (() => crypto.randomUUID());

  return {
    async createPrivateBatch(params): Promise<DevelopmentCloakBatch> {
      assertNonEmptyString(params.viewingKey, "viewingKey");

      if (params.payments.length === 0) {
        throw new Error("At least one payment is required.");
      }

      return {
        id: `dev_cloak_batch_${nextId()}`,
        payments: params.payments.map((payment) => ({
          recipient: assertNonEmptyString(payment.recipient, "recipient"),
          amount: assertPositiveNumber(payment.amount, "amount"),
          currency: payment.currency,
          note: payment.note,
        })),
      };
    },

    async executeBatch(batch: unknown): Promise<{ readonly id: string; readonly settled: boolean }> {
      const parsed = parseDevelopmentCloakBatch(batch);

      return {
        id: parsed.id,
        settled: true,
      };
    },
  };
}

interface DevelopmentCloakBatch {
  readonly id: string;
  readonly payments: readonly {
    readonly recipient: string;
    readonly amount: number;
    readonly currency: SupportedCurrency;
    readonly note?: string;
  }[];
}

function parseDevelopmentCloakBatch(batch: unknown): DevelopmentCloakBatch {
  if (
    typeof batch !== "object" ||
    batch === null ||
    !("id" in batch) ||
    typeof batch.id !== "string"
  ) {
    throw new Error("Invalid development Cloak batch.");
  }

  return batch as DevelopmentCloakBatch;
}
