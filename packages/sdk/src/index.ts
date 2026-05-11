import { Connection, PublicKey } from "@solana/web3.js";
import { ArcPaySdkError } from "./errors.js";
import { getOptimalRate } from "./intelligence/birdeye.js";
import { executeOptimalSwap } from "./intelligence/dflow.js";
import { payContractorPrivately } from "./privacy/cloak.js";
import { shieldIncomingPayment } from "./privacy/umbra.js";
import { createGoldRushRestClient } from "./risk/goldrush.js";
import { scoreCounterparty } from "./risk/goldrush.js";
import { autoDepositToKamino } from "./yield/kamino.js";
import {
  assertNonEmptyString,
  assertPercentageScore,
  assertPositiveNumber,
  assertUrl,
} from "./validation.js";
import type {
  AgentTreasuryHandle,
  ArcPayConfig,
  GoldRushClientLike,
  PaymentParams,
  PaymentResult,
  RateQuote,
  ReceiveParams,
  ReceiveResult,
  ExecutePaymentOnChainParams,
  ShieldDepositOnChainParams,
  SpendingPolicy,
  SwapResult,
  TreasuryParams,
  OnChainTransactionResult,
} from "./types.js";

export * from "./errors.js";
export * from "./types.js";
export * from "./growth/development.js";
export * from "./growth/torque.js";
export * from "./intelligence/birdeye.js";
export * from "./intelligence/development.js";
export * from "./intelligence/dflow.js";
export * from "./intelligence/qvac-brain.js";
export * from "./privacy/cloak.js";
export * from "./privacy/cloak-devnet.js";
export * from "./privacy/development.js";
export * from "./privacy/umbra.js";
export * from "./program/arcpay-program.js";
export * from "./risk/goldrush.js";
export * from "./yield/kamino.js";
export * from "./yield/development.js";
export * from "./yield/meteora-lp.js";

/**
 * Main ArcPay SDK facade. Server, agent, CLI, and frontend code should depend on this
 * class instead of talking directly to partner SDKs.
 */
export class ArcPayTreasury {
  private readonly connection: Connection;
  private readonly config: ArcPayConfig;
  private activeTreasury?: AgentTreasuryHandle;

  public constructor(config: ArcPayConfig) {
    this.config = validateConfig(config);
    this.connection = config.connection ?? new Connection(this.config.rpcUrl, "confirmed");
  }

  /**
   * Registers an agent treasury and validates policy inputs.
   * If `programClient` and `ownerSigner` are provided, this submits the live
   * `initialize_treasury` instruction to the deployed Solana program.
   */
  public async createAgentTreasury(params: TreasuryParams): Promise<AgentTreasuryHandle> {
    const agentId = assertNonEmptyString(params.agentId, "agentId");
    const policy = validateSpendingPolicy(params.spendingPolicy);

    if (params.acceptedCurrencies.length === 0) {
      throw new ArcPaySdkError(
        "VALIDATION_ERROR",
        "acceptedCurrencies must include at least one currency.",
      );
    }

    const onChain = params.ownerSigner
      ? await this.config.programClient?.initializeTreasury({
          owner: params.ownerSigner,
          agentId,
          dailyLimit: policy.dailyLimit,
          maxSingleTx: policy.maxSingleTx,
          minGoldRushScore: policy.requireGoldRushScore,
        })
      : undefined;
    const derivedTreasury = this.deriveTreasuryAddress(agentId, params);

    const handle: AgentTreasuryHandle = {
      treasuryId: `arcpay_${agentId}`,
      agentId,
      treasuryAddress: onChain?.treasuryAddress ?? derivedTreasury,
      initializeSignature: onChain?.signature,
      policy,
    };

    this.activeTreasury = handle;
    return handle;
  }

  /**
   * Records a shielded deposit reference on-chain after privacy handling.
   */
  public async recordShieldDepositOnChain(
    params: ShieldDepositOnChainParams,
  ): Promise<OnChainTransactionResult> {
    return requireAdapter(this.config.programClient, "ArcPay program").shieldDeposit(params);
  }

  /**
   * Executes an SPL token payment through the deployed ArcPay program.
   */
  public async executeOnChainPayment(
    params: ExecutePaymentOnChainParams,
  ): Promise<OnChainTransactionResult> {
    return requireAdapter(this.config.programClient, "ArcPay program").executePayment(params);
  }

  /**
   * Processes a received x402 payment through the configured privacy and yield adapters.
   */
  public async receiveX402(params: ReceiveParams): Promise<ReceiveResult> {
    assertPositiveNumber(params.amountUSD, "amountUSD");

    if (params.webhook !== undefined) {
      assertUrl(params.webhook, "webhook");
    }

    const mint = assertNonEmptyString(params.mintAddress, "mintAddress");
    const payerWallet = assertNonEmptyString(params.payerWallet, "payerWallet");
    const agentWallet = assertNonEmptyString(params.agentWallet, "agentWallet");

    const shielded = await shieldIncomingPayment(
      requireAdapter(this.config.adapters?.umbra, "Umbra"),
      {
        payerWallet,
        amount: params.amountUSD,
        mint,
      },
    );

    let earned: string | undefined;
    let yielding = false;

    if (this.config.adapters?.kamino && this.config.kaminoMarketAddress) {
      const deposit = await autoDepositToKamino(this.config.adapters.kamino, {
        marketAddress: this.config.kaminoMarketAddress,
        mint,
        amount: params.amountUSD,
        agentWallet,
      });
      earned = deposit.earning;
      yielding = true;
    }

    return {
      txId: shielded.txId,
      shielded: shielded.shielded,
      yielding,
      earned,
      stealthAddress: shielded.stealthAddress,
    };
  }

  /**
   * Scores and privately pays a contractor if the configured risk policy permits it.
   */
  public async payContractor(params: PaymentParams): Promise<PaymentResult> {
    const treasury = this.requireActiveTreasury();
    const amount = assertPositiveNumber(params.amount, "amount");
    const contractorId = assertNonEmptyString(params.contractorId, "contractorId");

    const counterparty = await scoreCounterparty(this.requireGoldRushClient(), contractorId);

    if (counterparty.score < treasury.policy.requireGoldRushScore) {
      throw new ArcPaySdkError(
        "POLICY_REJECTION",
        `Counterparty score ${counterparty.score} is below required score ${treasury.policy.requireGoldRushScore}.`,
      );
    }

    const payment = await payContractorPrivately(
      requireAdapter(this.config.adapters?.cloak, "Cloak"),
      {
        contractors: [
          {
            wallet: contractorId,
            amount,
            currency: params.currency,
            note: params.note,
          },
        ],
        ownerViewingKey: assertNonEmptyString(
          params.ownerViewingKey ?? this.config.cloakViewingKey,
          "ownerViewingKey",
        ),
      },
    );

    return {
      txId: payment.batchId,
      private: payment.private,
      goldRushScore: counterparty.score,
      settled: payment.settled,
      recommendation: counterparty.recommendation,
    };
  }

  /**
   * Converts between supported token mints using Birdeye pricing and DFlow execution.
   */
  public async convertCurrency(
    fromMint: string,
    toMint: string,
    amount: number,
    slippageBps = 50,
  ): Promise<SwapResult & { readonly quote: RateQuote }> {
    const quote = await getOptimalRate({
      fromMint,
      toMint,
      apiKey: assertNonEmptyString(this.config.birdeyeApiKey, "birdeyeApiKey"),
      fetchImpl: this.config.adapters?.fetch,
    });

    const swap = await executeOptimalSwap(
      requireAdapter(this.config.adapters?.dflow, "DFlow"),
      {
        fromMint,
        toMint,
        amount,
        slippageBps,
      },
    );

    return { ...swap, quote };
  }

  private requireActiveTreasury(): AgentTreasuryHandle {
    if (!this.activeTreasury) {
      throw new ArcPaySdkError(
        "CONFIGURATION_ERROR",
        "createAgentTreasury must be called before this operation.",
      );
    }

    return this.activeTreasury;
  }

  private requireGoldRushClient(): GoldRushClientLike {
    const adapter = this.config.adapters?.goldRush;

    if (adapter) {
      return adapter;
    }

    if (this.config.goldRushApiKey) {
      return createGoldRushRestClient({
        apiKey: this.config.goldRushApiKey,
        fetchImpl: this.config.adapters?.fetch,
      });
    }

    throw new ArcPaySdkError(
      "CONFIGURATION_ERROR",
      "GoldRush adapter or goldRushApiKey is required for this operation.",
    );
  }

  private deriveTreasuryAddress(agentId: string, params: TreasuryParams): string | undefined {
    const owner =
      params.ownerSigner?.publicKey ??
      (params.ownerWallet ? new PublicKey(params.ownerWallet) : undefined);

    if (!owner || !this.config.programClient) {
      return undefined;
    }

    return this.config.programClient.deriveTreasuryAddress({ owner, agentId }).toBase58();
  }
}

export default ArcPayTreasury;

function validateConfig(config: ArcPayConfig): ArcPayConfig {
  assertUrl(config.rpcUrl, "rpcUrl");
  assertNonEmptyString(config.programId, "programId");
  return config;
}

function validateSpendingPolicy(policy: SpendingPolicy): SpendingPolicy {
  const dailyLimit = assertPositiveNumber(policy.dailyLimit, "dailyLimit");
  const maxSingleTx = assertPositiveNumber(policy.maxSingleTx, "maxSingleTx");
  const requireGoldRushScore = assertPercentageScore(
    policy.requireGoldRushScore,
    "requireGoldRushScore",
  );

  if (maxSingleTx > dailyLimit) {
    throw new ArcPaySdkError(
      "VALIDATION_ERROR",
      "maxSingleTx cannot exceed dailyLimit.",
    );
  }

  return { dailyLimit, maxSingleTx, requireGoldRushScore };
}

function requireAdapter<T>(adapter: T | undefined, name: string): T {
  if (!adapter) {
    throw new ArcPaySdkError(
      "CONFIGURATION_ERROR",
      `${name} adapter is required for this operation.`,
    );
  }

  return adapter;
}
