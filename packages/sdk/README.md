# `@arcpay/sdk`

Phase 2 package for the TypeScript SDK described in `ArcPay_Build_Bible.txt`.

This package will own the `ArcPayTreasury` facade and integration modules for:

- Umbra and Cloak privacy flows.
- Kamino and Meteora LP Agent yield flows.
- Birdeye, DFlow, and QVAC intelligence flows.
- GoldRush risk scoring.
- Torque referral tracking.

The SDK must remain UI-agnostic and server-agnostic. Frontend, CLI, server, and agent code consume this package instead of duplicating integration logic.

## Implementation Status

- `ArcPayTreasury` is the public facade for future server, agent, CLI, and frontend packages.
- `SolanaArcPayProgramClient` is implemented for live devnet/mainnet program transactions: treasury PDA derivation, `initialize_treasury`, `shield_deposit`, `execute_payment`, and `AgentTreasury` account decoding.
- GoldRush scoring is implemented with both injected-client support and a REST adapter for live API usage.
- Birdeye is implemented via REST because `@birdeye/sdk` is not available on npm under the build-bible package name. Responses are validated before quotes are returned.
- DFlow REST order, quote, and declarative signed-intent boundaries are implemented. Unsigned quote execution is intentionally rejected.
- Kamino REST unsigned deposit/withdraw transaction builders are implemented. Signing and submission stay outside the SDK adapter.
- Umbra is implemented through a typed adapter. The build bible names `@umbra/sdk`, but npm currently exposes the likely Solana privacy SDK as `@umbra-privacy/sdk`.
- Umbra production direct encrypted-balance deposits are implemented through an injected `@umbra-privacy/sdk` function surface.
- Cloak production SOL private sends are implemented through an injected `@cloak.dev/sdk` functional UTXO surface.
- Cloak, Kamino, DFlow, QVAC, Torque, and GoldRush are represented as typed adapter contracts so their concrete SDK clients can be injected without leaking partner APIs across ArcPay.
- Development-only privacy adapters are available for local smoke tests. They do not provide real privacy or settlement.
- Development-only Kamino adapter is available for local yield smoke tests. It does not move funds.
- Development-only DFlow and QVAC adapters are available for local intelligence smoke tests. They do not submit trades or run real local AI inference.
- Development-only Torque adapter is available for local referral and leaderboard tests.

## Verified Package Names

| Package | npm status | ArcPay integration mode |
| --- | --- | --- |
| `@cloak.dev/sdk` | available | optional peer dependency + adapter |
| `@covalenthq/client-sdk` | available | optional peer dependency + adapter |
| `@dflow-protocol/client` | available | optional peer dependency + adapter |
| `@kamino-finance/klend-sdk` | available | optional peer dependency + adapter |
| `@qvac/sdk` | available | optional peer dependency + adapter |
| `@torque-labs/sdk` | available | optional peer dependency + adapter |
| `@umbra/sdk` | not found | build-bible name, not used |
| `@umbra-privacy/sdk` | available | optional peer dependency pending concrete adapter |
| `@birdeye/sdk` | not found | REST API wrapper |

## Live Read-Only Partner APIs

GoldRush can be enabled by passing `goldRushApiKey` to `ArcPayTreasury`; the SDK will create a REST-backed client automatically when no injected `goldRush` adapter is supplied:

```ts
const treasury = new ArcPayTreasury({
  rpcUrl: process.env.QUICKNODE_RPC_URL!,
  programId: process.env.ARCPAY_PROGRAM_ID!,
  goldRushApiKey: process.env.GOLDRUSH_API_KEY!,
});
```

Birdeye live price checks use the documented REST endpoint and require `birdeyeApiKey`:

```ts
const quote = await treasury.convertCurrency(
  process.env.AUDD_MINT_ADDRESS!,
  process.env.USDC_MINT_ADDRESS!,
  500,
);
```

`convertCurrency` still requires a DFlow adapter for execution. Birdeye only provides the validated price quote.

DFlow live order proof and signed-intent flow:

```ts
import { createDFlowRestClient } from "@arcpay/sdk";

const dflow = createDFlowRestClient({
  apiKey: process.env.DFLOW_API_KEY,
  baseUrl: process.env.DFLOW_API_BASE_URL ?? "https://dev-quote-api.dflow.net",
});

const order = await dflow.getOrder({
  inputMint: process.env.AUDD_MINT_ADDRESS!,
  outputMint: process.env.USDC_MINT_ADDRESS!,
  amount: 1_000_000n,
  slippageBps: 50,
  includeAddressLookupTables: false,
});

const quote = await dflow.getIntentQuote({
  inputMint: process.env.AUDD_MINT_ADDRESS!,
  outputMint: process.env.USDC_MINT_ADDRESS!,
  amount: 1_000_000n,
  slippageBps: 50,
  userPublicKey: process.env.AGENT_WALLET_ADDRESS!,
});

// Sign quote.openTransaction with the authorized wallet before submitting.
await dflow.submitIntent({
  quoteResponse: quote,
  signedOpenTransaction: "base64-signed-open-transaction",
});
```

The SDK does not sign or fake DFlow transactions. Production orchestration must verify wallet authority, sign the returned order/intent transaction, and keep the signed payload out of logs.

Run the read-only live partner smoke from WSL after setting credentials:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export BIRDEYE_API_KEY="your_birdeye_key"
export GOLDRUSH_API_KEY="your_goldrush_key"
export ARCPAY_REQUIRE_LIVE_PARTNERS=true
export ARCPAY_REQUIRE_LIVE_DFLOW=true
export DFLOW_API_BASE_URL="https://dev-quote-api.dflow.net"
npm run smoke:partners -w @arcpay/agent
```

This command validates Birdeye, GoldRush, and DFlow order access through SDK adapters only. It does not execute DFlow swaps, Cloak payroll, Umbra shielding, or Kamino deposits. GoldRush Solana transaction-history coverage still needs this live smoke result before being claimed as production-verified.

DFlow signable order proof:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export QUICKNODE_RPC_URL="https://api.mainnet-beta.solana.com"
export ARCPAY_SIGNER_KEYPAIR_PATH="$HOME/.config/solana/id.json"
export DFLOW_API_BASE_URL="https://dev-quote-api.dflow.net"
export ARCPAY_DFLOW_SUBMIT=false
npm run proof:dflow -w @arcpay/agent
```

Set `ARCPAY_DFLOW_SUBMIT=true` only with a funded wallet when you want to submit the signed transaction and produce a swap signature.

## Privacy Development Adapters

Use these only for local testing and demos before real Umbra/Cloak settlement is wired:

```ts
import {
  createDevelopmentCloakClient,
  createDevelopmentUmbraClient,
} from "@arcpay/sdk";
```

They preserve ArcPay's method contracts but intentionally return `dev_*` identifiers.

## Live Privacy Adapters

Umbra direct encrypted-balance deposit:

```ts
import {
  createUmbraDirectDepositClient,
} from "@arcpay/sdk";
import {
  getPublicBalanceToEncryptedBalanceDirectDepositorFunction,
  getUmbraClient,
  getUserRegistrationFunction,
} from "@umbra-privacy/sdk";

const umbra = createUmbraDirectDepositClient({
  sdk: {
    getUmbraClient,
    getUserRegistrationFunction,
    getPublicBalanceToEncryptedBalanceDirectDepositorFunction,
  },
  signer,
  signerAddress: signer.address,
  network: "mainnet",
  rpcUrl: process.env.QUICKNODE_RPC_URL!,
  rpcSubscriptionsUrl: process.env.SOLANA_WS_URL,
  indexerApiEndpoint: process.env.UMBRA_INDEXER_API_ENDPOINT,
  amountToBaseUnits: ({ amount }) => BigInt(Math.round(amount * 1_000_000)),
});
```

Cloak SOL private send:

```ts
import { Connection, PublicKey } from "@solana/web3.js";
import {
  CLOAK_PROGRAM_ID,
  createUtxo,
  createZeroUtxo,
  fullWithdraw,
  generateUtxoKeypair,
  transact,
} from "@cloak.dev/sdk";
import { createCloakFunctionalClient } from "@arcpay/sdk";

const cloak = createCloakFunctionalClient({
  sdk: {
    createUtxo,
    createZeroUtxo,
    fullWithdraw,
    generateUtxoKeypair,
    transact,
  },
  signerPublicKey: new PublicKey(process.env.AGENT_WALLET_ADDRESS!),
  transactionOptions: {
    connection: new Connection(process.env.QUICKNODE_RPC_URL!, "confirmed"),
    programId: CLOAK_PROGRAM_ID,
    relayUrl: process.env.CLOAK_RELAY_URL,
    walletPublicKey: new PublicKey(process.env.AGENT_WALLET_ADDRESS!),
  },
  amountToBaseUnits: ({ amount }) => BigInt(Math.round(amount * 1_000_000_000)),
});
```

Live privacy execution requires a funded mainnet signer. Do not pass or log raw private keys. Cloak USDC/SPL private payroll is intentionally not enabled until its mint-scoped UTXO flow is separately configured and smoke-tested.

## Live Program Client

Use this when a backend process has a funded Solana signer and needs to call the deployed ArcPay program:

```ts
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { ArcPayTreasury, SolanaArcPayProgramClient } from "@arcpay/sdk";

const connection = new Connection(process.env.QUICKNODE_RPC_URL!, "confirmed");
const owner = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.AGENT_WALLET_PRIVATE_KEY!)));
const programClient = new SolanaArcPayProgramClient({
  connection,
  programId: process.env.ARCPAY_PROGRAM_ID!,
});

const treasury = new ArcPayTreasury({
  rpcUrl: process.env.QUICKNODE_RPC_URL!,
  programId: process.env.ARCPAY_PROGRAM_ID!,
  programClient,
});

const handle = await treasury.createAgentTreasury({
  agentId: `ada-research-agent-${Date.now()}`,
  acceptedCurrencies: ["AUDD", "USDC", "PUSD"],
  privacy: "umbra",
  yield: { provider: "kamino", autoDeposit: true },
  spendingPolicy: {
    dailyLimit: 5_000,
    maxSingleTx: 1_000,
    requireGoldRushScore: 70,
  },
  ownerSigner: owner,
});
```

`executeOnChainPayment` requires real SPL token accounts:

```ts
await treasury.executeOnChainPayment({
  owner,
  treasury: new PublicKey(handle.treasuryAddress!),
  treasuryTokenAccount: new PublicKey("owner-token-account"),
  recipientTokenAccount: new PublicKey("recipient-token-account"),
  amount: 1_000_000n,
  goldRushScore: 91,
  paymentRef: "contractor-batch-12",
});
```

## Yield Development Adapter

Use this only for local orchestration tests before live Kamino transactions are enabled:

```ts
import { createDevelopmentKaminoClient } from "@arcpay/sdk";
```

## Live Kamino Transaction Builder

Use this when a backend process needs to build unsigned Kamino Lend transactions for a known market reserve:

```ts
import { autoDepositToKamino, createKaminoRestClient } from "@arcpay/sdk";

const kamino = createKaminoRestClient({
  reserveByMint: {
    [process.env.USDC_MINT_ADDRESS!]: process.env.KAMINO_USDC_RESERVE_ADDRESS!,
  },
});

const deposit = await autoDepositToKamino(kamino, {
  marketAddress: process.env.KAMINO_MARKET_ADDRESS!,
  mint: process.env.USDC_MINT_ADDRESS!,
  amount: 2.0,
  agentWallet: process.env.AGENT_WALLET_ADDRESS!,
});
```

`deposit.transaction` is an unsigned Solana transaction returned by Kamino. ArcPay must sign it with the authorized treasury wallet and submit it through RPC. Do not log signed transactions or private keys.

## Intelligence Development Adapters

Use these only for local orchestration tests before live DFlow/QVAC wiring:

```ts
import {
  createDevelopmentDFlowClient,
  createDevelopmentQvacClient,
} from "@arcpay/sdk";
```

## Growth Development Adapter

Use this only for local referral tests before live Torque campaign wiring:

```ts
import { createDevelopmentTorqueClient } from "@arcpay/sdk";
```

## Validation

Run from the repo root:

```bash
npm run build -w @arcpay/sdk
```

Run tests from WSL if Windows blocks Vitest worker spawning:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay/packages/sdk
npm test
```
