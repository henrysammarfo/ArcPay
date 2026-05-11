import type { Connection, PublicKey, Signer, TransactionSignature } from "@solana/web3.js";

export type SupportedCurrency = "AUDD" | "USDC" | "PUSD" | "SOL";
export type PrivacyProvider = "umbra";
export type YieldProvider = "kamino" | "meteora";
export type CounterpartyRecommendation = "APPROVE" | "REVIEW" | "REJECT";
export type TreasuryAction = "CONVERT_NOW" | "KEEP_YIELDING" | "EXECUTE_PAYMENTS" | "WAIT";

export interface ArcPayConfig {
  readonly rpcUrl: string;
  readonly programId: string;
  readonly goldRushApiKey?: string;
  readonly birdeyeApiKey?: string;
  readonly cloakApiKey?: string;
  readonly cloakViewingKey?: string;
  readonly torqueApiKey?: string;
  readonly torqueCampaignId?: string;
  readonly lpAgentApiKey?: string;
  readonly kaminoMarketAddress?: string;
  readonly umbraNetwork?: "devnet" | "mainnet-beta";
  readonly network?: "devnet" | "mainnet-beta";
  readonly connection?: Connection;
  readonly programClient?: ArcPayProgramClient;
  readonly adapters?: ArcPayAdapters;
}

export interface ArcPayAdapters {
  readonly umbra?: UmbraClient;
  readonly cloak?: CloakClient;
  readonly kamino?: KaminoClient;
  readonly dflow?: DFlowClient;
  readonly goldRush?: GoldRushClientLike;
  readonly torque?: TorqueClient;
  readonly qvac?: QvacClient;
  readonly fetch?: typeof fetch;
}

export interface SpendingPolicy {
  readonly dailyLimit: number;
  readonly maxSingleTx: number;
  readonly requireGoldRushScore: number;
}

export interface ContractorPayment {
  readonly wallet: string;
  readonly amount: number;
  readonly currency: SupportedCurrency;
  readonly note?: string;
}

export interface TreasuryParams {
  readonly agentId: string;
  readonly acceptedCurrencies: readonly SupportedCurrency[];
  readonly privacy: PrivacyProvider;
  readonly yield: {
    readonly provider: YieldProvider;
    readonly autoDeposit: boolean;
  };
  readonly spendingPolicy: SpendingPolicy;
  readonly contractors?: readonly ContractorPayment[];
  readonly ownerWallet?: string;
  readonly ownerSigner?: Signer;
}

export interface AgentTreasuryHandle {
  readonly treasuryId: string;
  readonly agentId: string;
  readonly treasuryAddress?: string;
  readonly initializeSignature?: TransactionSignature;
  readonly stealthAddress?: string;
  readonly vaultAddress?: string;
  readonly policy: SpendingPolicy;
}

export interface ArcPayProgramClient {
  deriveTreasuryAddress(params: {
    readonly owner: PublicKey;
    readonly agentId: string;
  }): PublicKey;
  initializeTreasury(params: InitializeTreasuryOnChainParams): Promise<OnChainTransactionResult>;
  shieldDeposit(params: ShieldDepositOnChainParams): Promise<OnChainTransactionResult>;
  executePayment(params: ExecutePaymentOnChainParams): Promise<OnChainTransactionResult>;
  fetchTreasury(address: PublicKey): Promise<OnChainAgentTreasury | null>;
}

export interface InitializeTreasuryOnChainParams {
  readonly owner: Signer;
  readonly agentId: string;
  readonly dailyLimit: number | bigint;
  readonly maxSingleTx: number | bigint;
  readonly minGoldRushScore: number;
}

export interface ShieldDepositOnChainParams {
  readonly owner: Signer;
  readonly treasury: PublicKey;
  readonly amount: number | bigint;
  readonly mint: PublicKey;
  readonly shieldRef: string;
}

export interface ExecutePaymentOnChainParams {
  readonly owner: Signer;
  readonly treasury: PublicKey;
  readonly treasuryTokenAccount: PublicKey;
  readonly recipientTokenAccount: PublicKey;
  readonly amount: number | bigint;
  readonly goldRushScore: number;
  readonly paymentRef: string;
}

export interface OnChainTransactionResult {
  readonly signature: TransactionSignature;
  readonly treasuryAddress?: string;
}

export interface OnChainAgentTreasury {
  readonly owner: string;
  readonly agentId: string;
  readonly dailyLimit: bigint;
  readonly maxSingleTx: bigint;
  readonly minGoldRushScore: number;
  readonly dailySpent: bigint;
  readonly lastReset: bigint;
  readonly isActive: boolean;
  readonly bump: number;
}

export interface ReceiveParams {
  readonly amountUSD: number;
  readonly currency: Extract<SupportedCurrency, "AUDD" | "USDC" | "PUSD">;
  readonly webhook?: string;
  readonly payerWallet?: string;
  readonly mintAddress?: string;
  readonly agentWallet?: string;
}

export interface ReceiveResult {
  readonly txId: string;
  readonly shielded: boolean;
  readonly yielding: boolean;
  readonly earned?: string;
  readonly stealthAddress?: string;
}

export interface PaymentParams {
  readonly contractorId: string;
  readonly amount: number;
  readonly currency: SupportedCurrency;
  readonly note?: string;
  readonly ownerViewingKey?: string;
}

export interface PaymentResult {
  readonly txId: string;
  readonly private: boolean;
  readonly goldRushScore: number;
  readonly settled: boolean;
  readonly recommendation: CounterpartyRecommendation;
}

export interface CounterpartyScore {
  readonly wallet: string;
  readonly score: number;
  readonly txCount: number;
  readonly recommendation: CounterpartyRecommendation;
}

export interface RateQuote {
  readonly fromMint: string;
  readonly toMint: string;
  readonly price: number;
  readonly updateTime: number;
}

export interface SwapResult {
  readonly received: number;
  readonly txId: string;
  readonly mevProtected: boolean;
}

export interface TreasuryDecision {
  readonly action: TreasuryAction;
  readonly confidence: number;
  readonly reason: string;
}

export interface PendingPayment {
  readonly amount: number;
  readonly currency: SupportedCurrency;
  readonly recipient: string;
  readonly dueAt?: string;
}

export interface UmbraClient {
  generateStealthAddress(payerWallet: string): Promise<string>;
  sendToStealth(params: {
    readonly stealthAddress: string;
    readonly amount: number;
    readonly mint: string;
    readonly senderWallet: string;
  }): Promise<{ readonly signature: string }>;
}

export interface CloakClient {
  createPrivateBatch(params: {
    readonly payments: readonly {
      readonly recipient: string;
      readonly amount: number;
      readonly currency: SupportedCurrency;
      readonly note?: string;
    }[];
    readonly viewingKey: string;
  }): Promise<unknown>;
  executeBatch(batch: unknown): Promise<{ readonly id: string; readonly settled: boolean }>;
}

export interface KaminoClient {
  readonly connection?: Connection;
  loadMarket(params: {
    readonly marketAddress: string;
  }): Promise<KaminoMarket>;
}

export interface KaminoMarket {
  getReserveByMint(mint: PublicKey): KaminoReserve | undefined;
  depositToReserve(params: {
    readonly amount: number;
    readonly mint: PublicKey;
    readonly depositor: PublicKey;
  }): Promise<{ readonly signature?: string; readonly txId?: string; readonly transaction?: string }>;
  withdrawFromReserve(params: {
    readonly amount: number;
    readonly mint: PublicKey;
    readonly depositor: PublicKey;
  }): Promise<{ readonly signature?: string; readonly txId?: string; readonly transaction?: string }>;
}

export interface KaminoReserve {
  readonly address?: PublicKey;
  readonly stats?: {
    readonly supplyInterestAPY?: number;
  };
}

export interface DFlowClient {
  getQuote(params: {
    readonly fromMint: string;
    readonly toMint: string;
    readonly amount: number;
    readonly slippageBps: number;
  }): Promise<unknown>;
  executeSwap(quote: unknown): Promise<{
    readonly outAmount: number | string;
    readonly txId: string;
  }>;
}

export interface GoldRushClientLike {
  readonly TransactionService: {
    getAllTransactionsForAddress(
      chainName: string,
      walletAddress: string,
      params: { readonly pageSize: number },
    ): Promise<{ readonly data?: { readonly items?: readonly unknown[] } }>;
  };
  readonly BalanceService: {
    getTokenBalancesForWalletAddress(
      chainName: string,
      walletAddress: string,
    ): Promise<{ readonly data?: { readonly items?: readonly GoldRushBalanceItem[] } }>;
  };
}

export interface GoldRushBalanceItem {
  readonly contract_ticker_symbol?: string;
  readonly balance?: string | number;
}

export interface TorqueClient {
  readonly campaigns: {
    get(campaignId: string): Promise<{ readonly id: string }>;
  };
  readonly referrals: {
    create(params: {
      readonly campaignId: string;
      readonly referrer: string;
      readonly referee: string;
      readonly reward: { readonly type: "FEE_REBATE"; readonly percent: number };
    }): Promise<unknown>;
  };
  readonly leaderboard: {
    get(params: {
      readonly campaignId: string;
      readonly metric: "treasury_volume";
      readonly limit: number;
    }): Promise<unknown>;
  };
}

export interface QvacClient {
  reason(params: {
    readonly context: string;
    readonly context2: string;
    readonly question: string;
    readonly options: readonly TreasuryAction[];
  }): Promise<TreasuryDecision>;
}
