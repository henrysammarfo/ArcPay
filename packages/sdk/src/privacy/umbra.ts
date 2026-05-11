import { ArcPaySdkError, wrapExternalError } from "../errors.js";
import {
  assertNonEmptyString,
  assertPositiveNumber,
} from "../validation.js";
import type { UmbraClient } from "../types.js";

export interface ShieldIncomingPaymentParams {
  readonly payerWallet: string;
  readonly amount: number;
  readonly mint: string;
}

export interface ShieldIncomingPaymentResult {
  readonly txId: string;
  readonly stealthAddress: string;
  readonly shielded: true;
}

export interface UmbraDirectDepositClientOptions {
  readonly sdk: UmbraDirectDepositSdk;
  readonly signer: unknown;
  readonly signerAddress: string;
  readonly network: "mainnet" | "devnet";
  readonly rpcUrl: string;
  readonly rpcSubscriptionsUrl?: string;
  readonly indexerApiEndpoint?: string;
  readonly amountToBaseUnits: (params: {
    readonly amount: number;
    readonly mint: string;
  }) => bigint;
}

export interface UmbraDirectDepositSdk {
  getUmbraClient(args: {
    readonly signer: unknown;
    readonly network: "mainnet" | "devnet";
    readonly rpcUrl: string;
    readonly rpcSubscriptionsUrl?: string;
    readonly indexerApiEndpoint?: string;
  }): Promise<unknown>;
  getUserRegistrationFunction(args: {
    readonly client: unknown;
  }): (params: { readonly confidential: boolean; readonly anonymous: boolean }) => Promise<unknown>;
  getPublicBalanceToEncryptedBalanceDirectDepositorFunction(args: {
    readonly client: unknown;
  }): (destinationAddress: string, mint: string, amount: bigint) => Promise<unknown>;
}

/**
 * Shields incoming agent payments through an injected Umbra-compatible client.
 */
export async function shieldIncomingPayment(
  umbra: UmbraClient,
  params: ShieldIncomingPaymentParams,
): Promise<ShieldIncomingPaymentResult> {
  const payerWallet = assertNonEmptyString(params.payerWallet, "payerWallet");
  const mint = assertNonEmptyString(params.mint, "mint");
  const amount = assertPositiveNumber(params.amount, "amount");

  try {
    const stealthAddress = await umbra.generateStealthAddress(payerWallet);
    const tx = await umbra.sendToStealth({
      stealthAddress,
      amount,
      mint,
      senderWallet: payerWallet,
    });

    return {
      txId: tx.signature,
      stealthAddress,
      shielded: true,
    };
  } catch (cause) {
    throw wrapExternalError("Umbra", "incoming payment shielding", cause);
  }
}

/**
 * Creates an Umbra production adapter for direct public-balance to encrypted-balance deposits.
 *
 * This wraps `@umbra-privacy/sdk` without making it a hard runtime dependency of
 * `@arcpay/sdk`. The caller supplies the concrete SDK functions, signer, RPC URL,
 * and amount conversion policy. The adapter signs only through the supplied Umbra
 * signer and never accepts raw private keys.
 */
export function createUmbraDirectDepositClient(
  options: UmbraDirectDepositClientOptions,
): UmbraClient {
  const signerAddress = assertNonEmptyString(options.signerAddress, "signerAddress");
  const rpcUrl = assertNonEmptyString(options.rpcUrl, "rpcUrl");

  return {
    async generateStealthAddress(): Promise<string> {
      return signerAddress;
    },

    async sendToStealth(params): Promise<{ readonly signature: string }> {
      assertNonEmptyString(params.stealthAddress, "stealthAddress");
      assertNonEmptyString(params.senderWallet, "senderWallet");
      const mint = assertNonEmptyString(params.mint, "mint");
      const amount = assertPositiveNumber(params.amount, "amount");

      if (params.senderWallet !== signerAddress) {
        throw new ArcPaySdkError(
          "VALIDATION_ERROR",
          "Umbra direct deposit senderWallet must match the configured signer address.",
        );
      }

      try {
        const client = await options.sdk.getUmbraClient({
          signer: options.signer,
          network: options.network,
          rpcUrl,
          rpcSubscriptionsUrl: options.rpcSubscriptionsUrl,
          indexerApiEndpoint: options.indexerApiEndpoint,
        });
        const register = options.sdk.getUserRegistrationFunction({ client });
        await register({ confidential: true, anonymous: true });

        const deposit = options.sdk.getPublicBalanceToEncryptedBalanceDirectDepositorFunction({
          client,
        });
        const result = await deposit(
          signerAddress,
          mint,
          options.amountToBaseUnits({ amount, mint }),
        );

        return {
          signature: extractSignature(result, "Umbra deposit"),
        };
      } catch (cause) {
        if (cause instanceof ArcPaySdkError) {
          throw cause;
        }

        throw wrapExternalError("Umbra", "direct encrypted-balance deposit", cause);
      }
    },
  };
}

function extractSignature(value: unknown, source: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "signature" in value &&
    typeof value.signature === "string" &&
    value.signature.length > 0
  ) {
    return value.signature;
  }

  throw new Error(`${source} did not return a transaction signature.`);
}
