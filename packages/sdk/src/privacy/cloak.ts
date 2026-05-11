import { PublicKey } from "@solana/web3.js";
import { ArcPaySdkError, wrapExternalError } from "../errors.js";
import { assertNonEmptyString, assertPositiveNumber } from "../validation.js";
import type { CloakClient, ContractorPayment } from "../types.js";

export interface PayContractorPrivatelyParams {
  readonly contractors: readonly ContractorPayment[];
  readonly ownerViewingKey: string;
}

export interface PayContractorPrivatelyResult {
  readonly batchId: string;
  readonly private: true;
  readonly settled: boolean;
}

export interface CloakFunctionalClientOptions {
  readonly sdk: CloakFunctionalSdk;
  readonly transactionOptions: CloakTransactionOptions;
  readonly signerPublicKey: PublicKey;
  readonly nativeSolMint?: PublicKey;
  readonly amountToBaseUnits: (payment: {
    readonly amount: number;
    readonly currency: ContractorPayment["currency"];
  }) => bigint;
}

export interface CloakFunctionalSdk {
  createUtxo(amount: bigint, owner: unknown, mintAddress?: PublicKey): Promise<unknown>;
  createZeroUtxo(mintAddress?: PublicKey): Promise<unknown>;
  fullWithdraw(
    inputUtxos: readonly unknown[],
    recipient: PublicKey,
    options: CloakTransactionOptions,
  ): Promise<{ readonly signature: string }>;
  generateUtxoKeypair(): Promise<unknown>;
  transact(
    params: {
      readonly inputUtxos: readonly unknown[];
      readonly outputUtxos: readonly unknown[];
      readonly externalAmount: bigint;
      readonly depositor: PublicKey;
    },
    options: CloakTransactionOptions,
  ): Promise<{
    readonly signature: string;
    readonly outputUtxos: readonly unknown[];
    readonly merkleTree?: unknown;
  }>;
}

export interface CloakTransactionOptions {
  readonly connection: unknown;
  readonly programId: PublicKey;
  readonly relayUrl?: string;
  readonly depositorKeypair?: unknown;
  readonly signTransaction?: unknown;
  readonly signMessage?: unknown;
  readonly depositorPublicKey?: PublicKey;
  readonly walletPublicKey?: PublicKey;
  readonly [key: string]: unknown;
}

interface CloakPrivateBatch {
  readonly id: string;
  readonly payments: readonly {
    readonly recipient: PublicKey;
    readonly amount: bigint;
    readonly currency: ContractorPayment["currency"];
  }[];
}

/**
 * Creates and executes a private Cloak payroll batch.
 */
export async function payContractorPrivately(
  cloak: CloakClient,
  params: PayContractorPrivatelyParams,
): Promise<PayContractorPrivatelyResult> {
  const ownerViewingKey = assertNonEmptyString(params.ownerViewingKey, "ownerViewingKey");

  if (params.contractors.length === 0) {
    throw new ArcPaySdkError(
      "VALIDATION_ERROR",
      "At least one contractor payment is required.",
    );
  }

  const payments = params.contractors.map((contractor) => ({
    recipient: assertNonEmptyString(contractor.wallet, "contractor.wallet"),
    amount: assertPositiveNumber(contractor.amount, "contractor.amount"),
    currency: contractor.currency,
    note: contractor.note,
  }));

  try {
    const batch = await cloak.createPrivateBatch({
      payments,
      viewingKey: ownerViewingKey,
    });
    const result = await cloak.executeBatch(batch);

    return {
      batchId: result.id,
      private: true,
      settled: result.settled,
    };
  } catch (cause) {
    throw wrapExternalError("Cloak", "private contractor payroll", cause);
  }
}

/**
 * Creates a Cloak production adapter around the supported functional UTXO API.
 *
 * The adapter supports SOL private sends by performing deposit -> private pool ->
 * full withdraw to the recipient using the supplied Cloak SDK functions and
 * signer configuration. Raw private keys are not accepted here.
 */
export function createCloakFunctionalClient(options: CloakFunctionalClientOptions): CloakClient {
  const nativeSolMint =
    options.nativeSolMint ?? new PublicKey("So11111111111111111111111111111111111111112");

  return {
    async createPrivateBatch(params): Promise<CloakPrivateBatch> {
      if (params.payments.length === 0) {
        throw new ArcPaySdkError(
          "VALIDATION_ERROR",
          "At least one private Cloak payment is required.",
        );
      }

      return {
        id: `cloak_batch_${Date.now()}`,
        payments: params.payments.map((payment) => {
          if (payment.currency !== "SOL") {
            throw new ArcPaySdkError(
              "UNSUPPORTED_OPERATION",
              "Cloak functional adapter currently supports SOL private sends only.",
            );
          }

          return {
            recipient: new PublicKey(assertNonEmptyString(payment.recipient, "recipient")),
            amount: options.amountToBaseUnits({
              amount: assertPositiveNumber(payment.amount, "amount"),
              currency: payment.currency,
            }),
            currency: payment.currency,
          };
        }),
      };
    },

    async executeBatch(batch): Promise<{ readonly id: string; readonly settled: boolean }> {
      const parsed = parseCloakPrivateBatch(batch);
      const signatures: string[] = [];

      try {
        for (const payment of parsed.payments) {
          const outputOwner = await options.sdk.generateUtxoKeypair();
          const output = await options.sdk.createUtxo(payment.amount, outputOwner, nativeSolMint);
          const deposited = await options.sdk.transact(
            {
              inputUtxos: [await options.sdk.createZeroUtxo(nativeSolMint)],
              outputUtxos: [output],
              externalAmount: payment.amount,
              depositor: options.signerPublicKey,
            },
            options.transactionOptions,
          );
          const withdrawn = await options.sdk.fullWithdraw(deposited.outputUtxos, payment.recipient, {
            ...options.transactionOptions,
            cachedMerkleTree: deposited.merkleTree,
          });

          signatures.push(deposited.signature, withdrawn.signature);
        }

        return {
          id: signatures.join(":"),
          settled: true,
        };
      } catch (cause) {
        if (cause instanceof ArcPaySdkError) {
          throw cause;
        }

        throw wrapExternalError("Cloak", "functional private payroll", cause);
      }
    },
  };
}

function parseCloakPrivateBatch(batch: unknown): CloakPrivateBatch {
  if (
    typeof batch !== "object" ||
    batch === null ||
    !("id" in batch) ||
    typeof batch.id !== "string" ||
    !("payments" in batch) ||
    !Array.isArray(batch.payments)
  ) {
    throw new Error("Invalid Cloak private batch.");
  }

  return batch as CloakPrivateBatch;
}
