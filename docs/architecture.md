# ArcPay Architecture

ArcPay is a private, yield-generating treasury for AI agents on Solana. The build bible in `ArcPay_Build_Bible.txt` is the source of truth. This document normalizes its implementation boundaries so code lands in the correct package.

## Package Boundaries

| Package | Responsibility | Must Not Do |
| --- | --- | --- |
| `packages/program` | On-chain treasury accounts and policy enforcement. | Call off-chain APIs, store secrets, or make yield/privacy decisions. |
| `packages/sdk` | Typed TypeScript facade over Solana program, privacy, yield, risk, swap, and growth integrations. | Render UI or host HTTP endpoints. |
| `packages/server` | x402 HTTP payment endpoints and post-payment orchestration. | Own frontend state or embed private keys in source. |
| `packages/agent` | Demo runner and local intelligence workflows. | Replace on-chain policy checks. |
| `packages/frontend` | Agency owner dashboard with Solflare/Phantom wallet connection. | Expose per-agent private balances. |
| `packages/cli` | ArcPay treasury developer CLI plus Zerion companion readiness checks. | Bypass SDK validation or on-chain policy checks. |

## Phase 1 Contract

The Solana program is named `arcpay`. It owns the `AgentTreasury` account and enforces spending policy before token transfer execution.

Required instructions:

- `initializeTreasury`: stores owner, agent identifier, daily limit, max single transaction amount, and minimum GoldRush score.
- `shieldDeposit`: records an incoming shielded deposit reference for auditability without handling privacy cryptography on-chain.
- `executePayment`: enforces active treasury status, single-transaction limit, daily limit, and minimum GoldRush score before transferring SPL tokens.

## Phase 2 SDK Contract

The SDK is the only package allowed to own partner integration logic. The server, agent, frontend, and CLI must call `@arcpay/sdk` instead of importing GoldRush, Umbra, Cloak, Kamino, DFlow, Birdeye, QVAC, Torque, or LP Agent directly.

Phase 2 modules:

- `src/index.ts`: `ArcPayTreasury` facade.
- `src/types.ts`: shared contracts consumed by all SDK modules.
- `src/errors.ts`: stable SDK error type.
- `src/validation.ts`: shared validation helpers.
- `src/program/arcpay-program.ts`: live Solana client for deriving treasury PDAs, initializing treasuries, recording shielded deposits, executing policy-enforced SPL payments, and decoding treasury accounts.
- `src/risk/goldrush.ts`: counterparty scoring.
- `src/privacy/umbra.ts`: Umbra-compatible privacy adapter.
- `src/privacy/cloak.ts`: Cloak-compatible private payroll adapter.
- `src/yield/kamino.ts`: Kamino-compatible yield adapter.
- `src/yield/meteora-lp.ts`: LP Agent REST wrapper for Meteora DLMM read proofs and unsigned Zap-In transaction generation.
- `src/intelligence/birdeye.ts`: Birdeye REST rate lookup.
- `src/intelligence/dflow.ts`: DFlow-compatible swap adapter and order/intent REST boundary.
- `src/intelligence/qvac-brain.ts`: QVAC-compatible local decision adapter.
- `src/growth/torque.ts`: Torque-compatible referral and leaderboard adapter.

Verified package gap: `@umbra/sdk` and `@birdeye/sdk` are not available on npm under the names listed in the build bible as of implementation. Npm currently exposes a likely Umbra Solana package as `@umbra-privacy/sdk`, but the concrete transaction flow must be integrated deliberately against its current API. ArcPay therefore uses a typed Umbra adapter and a validated Birdeye REST wrapper.

Read-only partner status: GoldRush REST scoring is implemented behind `createGoldRushRestClient` and can be selected through `goldRushApiKey`; Birdeye live price fetches are implemented behind `getOptimalRate`. Both fail through typed SDK errors when provider responses are malformed or unavailable. GoldRush's official Solana documentation lists wallet balances for `solana-mainnet`; transaction v3 scoring should be live-smoked with an API key before claiming Solana transaction-history coverage.

## Phase 3 Server Contract

The x402 server owns HTTP payment gating and agent task endpoints. It must not duplicate SDK integration logic; after payment verification it should call `@arcpay/sdk` for shielding, yield, scoring, and future orchestration.

Required routes:

- `GET /agent/research`: `0.01 USDC`.
- `GET /agent/analysis`: `0.05 AUDD`.
- `POST /agent/task`: `0.10 USDC`.
- `GET /live/treasury`: unprotected aggregate live Solana RPC status for the configured agent wallet.
- `POST /webhooks/quicknode`: QuickNode webhook receiver for live event proof.
- `GET /live/quicknode`: QuickNode webhook proof status.

Package reality: `@x402/express` is available, but `@x402/solana` is not available on npm under the build-bible package name. The current implementation keeps Solana x402 settlement behind `src/x402/payment-middleware.ts`; it returns real `402 Payment Required` responses and supports a development-only paid header for smoke tests. Production settlement must replace this middleware boundary once the correct Solana facilitator API is confirmed.

Production safety rule: `ARCPAY_PAYMENT_MODE=production` requires an injected `PaymentVerifier`; the development payment bypass is rejected in production mode. Development bypass responses are explicitly marked `liveProof: false` so they cannot be treated as real settlement.

Current production verifier: `packages/server/src/x402/solana-payment-verifier.ts` verifies Solana transaction signatures against RPC, checks token mint/recipient/amount/freshness, and claims the signature through a replay store before granting endpoint access. The built-in file replay store is suitable for one server process; multi-instance production must use an atomic database or Redis-backed replay store.

QuickNode webhook status: the server exposes a real webhook receiver and status endpoint. It does not fabricate events; `/live/quicknode` remains `liveProof: false` until QuickNode posts a payload to `/webhooks/quicknode`. If `QUICKNODE_WEBHOOK_SECRET` is configured, ArcPay verifies QuickNode signed webhook headers (`x-qn-*`) with the dashboard Security Token; `x-arcpay-webhook-secret` remains available for local curl tests only.

## Phase 4 Privacy Contract

The privacy layer lives in `packages/sdk/src/privacy`. It owns the ArcPay privacy contracts for incoming payment shielding and private contractor payroll.

Current implementation:

- `umbra.ts`: Umbra-compatible adapter contract plus production direct encrypted-balance deposit adapter for `@umbra-privacy/sdk`.
- `cloak.ts`: Cloak-compatible private payroll adapter plus production functional UTXO adapter for `@cloak.dev/sdk` SOL private sends.
- `development.ts`: development-only Umbra/Cloak adapters for local smoke tests.

Production constraint: `@cloak.dev/sdk@0.1.6` does not expose the build-bible sample methods `createPrivateBatch` and `executeBatch`; its published types say legacy transaction-emitting methods were removed and replaced with functional UTXO APIs. ArcPay must not call nonexistent methods directly.

Current production privacy status: `createUmbraDirectDepositClient` maps ArcPay shielding onto Umbra's public-balance to encrypted-balance direct deposit flow. `createCloakFunctionalClient` maps ArcPay private contractor payroll onto Cloak's supported functional UTXO API for SOL sends. `runCloakDevnetSolDepositProof` maps the official Cloak devnet docs onto `@cloak.dev/sdk-devnet` for faucet-funded proof runs against `https://api.devnet.cloak.ag` and program `Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h`. Live execution still requires funded signer configuration and explicit wallet signing; the SDK does not accept raw private keys. Cloak SPL/private USDC payroll remains blocked until the mint-scoped UTXO flow is configured and smoke-tested.

## Phase 5 Yield Contract

The yield layer lives in `packages/sdk/src/yield`. It owns idle treasury deployment and liquidity withdrawal boundaries.

Current implementation:

- `kamino.ts`: Kamino-compatible auto-deposit and withdraw functions plus REST unsigned transaction-builder adapter.
- `meteora-lp.ts`: LP Agent REST wrapper for official open API read proofs and unsigned Meteora Zap-In transaction generation.
- `development.ts`: development-only Kamino adapter for local orchestration tests.

Production constraint: live yield functions must be called only after token mints, agent wallet ownership, and liquidity needs are validated by the calling orchestration layer. The SDK exposes typed boundaries, but it does not bypass on-chain spending policy enforcement.

Kamino production status: `createKaminoRestClient` builds unsigned Kamino Lend deposit/withdraw transactions from explicit mint-to-reserve configuration. The SDK does not sign or submit these transactions; production orchestration must verify the reserve belongs to the configured market, sign with the authorized treasury wallet, and submit through Solana RPC.

LP Agent production status: `createLpAgentRestClient` uses the official `https://api.lpagent.io/open-api/v1` REST boundary with `x-api-key` authentication. Current ArcPay support includes read-only live proof for pool info or owner positions via `GET /lp-positions/opening` plus unsigned Zap-In transaction generation through `POST /pools/{poolId}/add-tx`. The official LP Agent track requires a feature that uses LP Agent endpoints and Zap In or Zap Out inside the app, so read-only pool data is only an engineering proof, not final track completion. Signing/submitting the generated transaction and proving the resulting position remain blocked on funded wallet approval and confirmed pool/input parameters.

## Phase 6 Intelligence Contract

The intelligence layer lives in `packages/sdk/src/intelligence`. It owns rate lookup, swap execution boundaries, and local treasury decision boundaries.

Current implementation:

- `birdeye.ts`: Birdeye REST rate lookup.
- `dflow.ts`: DFlow-compatible swap execution adapter plus REST order, quote, and signed declarative-intent submission boundary.
- `qvac-brain.ts`: QVAC-compatible treasury decision adapter.
- `development.ts`: development-only DFlow/QVAC adapters for local orchestration tests.

Production constraint: DFlow swaps and QVAC decisions must remain advisory or execution-boundary operations. They must not bypass GoldRush scoring, spending policy checks, or the on-chain treasury program.

DFlow production status: live REST order, quote, and declarative intent submission boundaries are implemented in `createDFlowRestClient`. Current smoke proof uses the documented no-key dev order endpoint at `https://dev-quote-api.dflow.net/order`; production can switch to `https://quote-api.dflow.net` with `x-api-key`. The SDK intentionally refuses to execute unsigned REST quotes; production orchestration must request an order or intent transaction, sign it with the authorized treasury wallet, and submit the signed transaction through DFlow/Solana. The agent package exposes `proof:dflow` for this boundary; it signs locally and only submits when `ARCPAY_DFLOW_SUBMIT=true`.

QVAC production status: `createQvacLocalClient` dynamically loads the official local `@qvac/sdk`, requests a strict JSON treasury decision, and validates the returned action, confidence, and reason before ArcPay can use it. The adapter follows the official QVAC completion flow: `loadModel()` with `modelType: "llm"`, `completion()` with streamed tokens, then `unloadModel()` and `close()`. It resolves QVAC as an optional peer from either the SDK package, the consuming workspace, or an explicit `QVAC_SDK_PATH` external runtime directory, and accepts both raw model source strings and QVAC registry descriptor objects. QVAC team confirmed linux-x64 binaries are tested and WSL is currently untested, so final live proof must run on native Linux x64 with `QVAC_LINUX_HOST_CONFIRMED=true`.

## Phase 8 Growth Contract

The growth layer lives in `packages/sdk/src/growth`. It owns Torque growth-loop integration and must keep incentives separate from treasury custody.

Current implementation:

- `torque.ts`: Torque-compatible referral and treasury-volume leaderboard adapter plus the official Torque MCP custom event sender for `POST https://ingest.torque.so/events` with `x-api-key` authentication.
- `development.ts`: development-only Torque adapter for local tests.

Production constraint: referral rewards must remain accounting metadata. They must not alter treasury balances or bypass payment policy enforcement.

Torque production status: the official Torque track requires measurable live activity through Torque MCP or API by passing `custom_events`, triggering incentives, or using distributors. ArcPay can now submit custom events with a Torque event API key through the SDK and `packages/agent` smoke runner. It is not track-complete until the dashboard event definition exists, a real live event is accepted by Torque, the event appears in Torque reporting, and the friction log is recorded.

## Phase 9 Frontend And CLI Contract

The frontend lives in `packages/frontend` and owns the agency owner dashboard. It must show aggregate treasury state only and must not expose per-agent private balances.

Dashboard data rule: dashboard metrics must come from live server/RPC responses or a connected wallet. Static treasury balances, fake DFlow history, fake Torque rebates, and fake GoldRush rows are not allowed.

The CLI lives in `packages/cli` and must call `@arcpay/sdk` instead of duplicating integration logic.

Zerion CLI status: the valid official source is `https://github.com/zeriontech/zerion-ai`, with the npm package `zerion-cli`. ArcPay does not vendor or fork Zerion into `packages/cli`; it keeps ArcPay treasury commands separate and exposes `arcpay zerion status` to verify the external `zerion` binary and `ZERION_API_KEY` readiness. Zerion commands are companion wallet-analysis/trading tools and must not bypass ArcPay SDK validation, on-chain policy checks, or server payment verification.

## Phase 10-13 Demo Contract

The demo runner lives in `packages/agent/src/demo.ts`. It is allowed to orchestrate the SDK, probe the local x402 server, and print demo-ready terminal output. It must not store private keys, bypass on-chain spending policy, or claim development-adapter actions are production partner settlements.

Current implementation:

- Prints the deployed devnet program ID and Solana Explorer link.
- Probes the local x402 server without claiming development bypass as live proof.
- Defaults to live-proof mode and skips partner settlement claims unless real provider responses or transaction signatures exist.
- Allows deterministic development adapters only when `ARCPAY_ALLOW_DEVELOPMENT_DEMO=true`; those outputs are local engineering checks, not submission proof.

Phase 12 smoke-test status is tracked in `docs/smoke-test.md`.

## Security Rules

- Secrets must live in `.env`, never source files.
- On-chain code must validate user-controlled strings and numeric limits.
- Off-chain services must validate environment variables at startup.
- External integration code must wrap third-party failures in typed domain errors.
- Frontend must show aggregate treasury state only, not per-agent private balances.
