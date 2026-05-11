# ArcPay product UI Product Brief

Use this brief to generate the public-facing ArcPay app. The goal is not a
judge proof board. The goal is a polished fintech treasury product that a real
agency, enterprise, DAO, or AI-agent business could use every day.

## Product Definition

ArcPay is a private, policy-controlled treasury OS for AI agents on Solana.
It lets businesses and AI-agent operators receive paid requests, route funds,
shield balances, earn yield, score counterparties, enforce spend policies, and
pay contractors without exposing the full treasury trail publicly.

One-line product:

> ArcPay is the private operating account for AI agents: receive, shield, earn,
> swap, and pay on Solana with policy guardrails.

Primary persona:

Ada runs a multi-agent digital agency. Clients pay her agents in USDC, AUDD, or
PUSD. Contractors want SOL or stablecoins. Ada needs one dashboard that shows
aggregate treasury health, pending payments, risk, yield, and private settlement
status without leaking per-agent balances.

## Important UX Rule

The normal user dashboard must not look like a hackathon proof checklist.

Daily users should see:

- balances;
- cashflow;
- invoices;
- pending approvals;
- contractor payments;
- yield positions;
- swaps/routes;
- privacy status;
- spend policies;
- counterparty risk;
- audit exports;
- workspace settings.

Judge/developer proof evidence should live in a separate route such as:

- `/proofs`
- `/developer`
- `/evidence`

Do not put raw sponsor proof cards as the main dashboard experience.

## Network Model

The app has one interface with an explicit network switch:

- `Devnet mode`: safe judge testing, faucet funds, Cloak devnet, Ika pre-alpha,
  MagicBlock devnet/private payments builder, QuickNode devnet webhooks, Solana
  program proofs.
- `Mainnet mode`: production settlement, PUSD, Zerion-routed transactions,
  DFlow routes, Kamino positions, real payment flows.

Every money-moving action must show:

- network;
- wallet;
- token;
- amount;
- expected fees;
- minimum route/deposit requirement;
- slippage/max loss;
- recipient;
- provider route;
- final review step.

If the wallet has insufficient funds, no pool, no route, or a minimum amount is
not met, show a clear provider-style error message instead of pretending it
worked.

Example empty-wallet states:

- "Insufficient SOL for network fees."
- "USDC token account missing."
- "Route minimum is 10 USDC."
- "No active PUSD/USDC pool found for this provider."
- "Deposit builder returned a transaction, but wallet has no token balance."

## App Structure

### Public Marketing Site

Routes:

- `/`
- `/pricing`
- `/solutions`
- `/docs`
- `/security`
- `/sign-in`
- `/sign-up`

Landing sections:

- premium hero;
- "how ArcPay works";
- treasury workflow;
- privacy and audit;
- yield routing;
- risk and policy;
- network support;
- customer persona;
- FAQ;
- footer.

Use the provided Halo-style visual language as inspiration, but rewrite all copy
for ArcPay. Do not keep "Halo" content.

### Auth

Routes:

- `/sign-in`
- `/sign-up`
- `/forgot-password`
- `/reset-password`

Auth design should feel like a fintech product, not a generic SaaS form.

Auth methods:

- wallet connect first;
- email/password or magic-link ready for Supabase;
- workspace creation after first login.

### Main App Dashboard

Routes:

- `/dashboard`
- `/wallet`
- `/payments`
- `/invoices`
- `/contractors`
- `/swaps`
- `/yield`
- `/privacy`
- `/risk`
- `/policies`
- `/audit`
- `/settings`
- `/profile`
- `/proofs`

The left sidebar should feel like a real finance product:

- Overview
- Wallet
- Payments
- Invoices
- Contractors
- Swaps
- Yield
- Privacy
- Risk
- Policies
- Audit
- Settings

Top bar:

- workspace switcher;
- network switch: Devnet / Mainnet;
- connected wallet;
- notifications;
- command/search button;
- profile menu.

### Dashboard Overview

The overview page should show:

- total operating balance;
- available balance;
- shielded balance;
- idle balance;
- yield deployed;
- 24h inflow/outflow;
- pending approvals;
- risk alerts;
- latest activity;
- next best action.

Cards should look like a real finance dashboard, not test cards.

Example cards:

- "Operating Balance"
- "Shielded Treasury"
- "Idle Funds"
- "Yield Running"
- "Pending Payments"
- "Risk Queue"
- "Routes Available"

### Payments

Payments page:

- create payment request;
- x402 paid endpoint links;
- client payment history;
- received funds;
- settlement status;
- route payment into shield/yield/swap.

Payment detail drawer:

- payer;
- token;
- amount;
- network;
- transaction signature;
- privacy route;
- risk score;
- final treasury action.

### Invoices

Invoices page:

- create invoice;
- choose USDC, AUDD, PUSD, SOL;
- set due date;
- attach memo;
- copy pay link;
- show paid/pending/failed states.

### Contractors

Contractors page:

- contractor directory;
- wallet address;
- preferred currency;
- country/region;
- risk score;
- payment history;
- private payroll status.

Batch payroll:

- select contractors;
- enter amounts;
- run GoldRush risk check;
- route through Cloak/Umbra where available;
- review final fees;
- submit.

### Swaps

Swaps page:

- from token;
- to token;
- amount;
- route provider: DFlow / Zerion;
- priority: fastest / cheapest / balanced;
- slippage;
- MEV protection indicator;
- route quote;
- minimum received;
- error state for no route/minimum/insufficient funds.

Do not auto-submit swaps. Always show a final review modal.

### Yield

Yield page:

- idle funds;
- Kamino opportunities;
- LP Agent/Meteora opportunities backed by live Zap-In builder proof;
- APY;
- risk level;
- liquidity lock/unlock notes;
- deposit/withdraw buttons;
- minimum deposit requirements.

If LP Agent funding is missing, show:

> LP Agent Zap-In route is ready. Fund and approve only when you want to create the LP position.

### Privacy

Privacy page:

- shield balance;
- private payment route;
- Cloak devnet/private payroll;
- Umbra shielding status;
- viewing/audit key management;
- disclosure scope.

Privacy copy must be honest:

- say "devnet" when devnet;
- say "pre-alpha" for Ika;
- do not claim production MPC or final privacy if the rail is not fully live.

### Risk

Risk page:

- counterparty wallet lookup;
- GoldRush score;
- wallet age/activity;
- token balances;
- recommendation: approve/review/block;
- reason codes;
- saved counterparties.

### Policies

Policies page:

- daily spend limit;
- max single transaction;
- allowed tokens;
- allowed networks;
- blocked actions;
- minimum GoldRush score;
- approval expiry;
- contractor allowlist;
- emergency pause.

This is central to the product. It should feel like an enterprise control panel.

### Audit

Audit page:

- export date range;
- show transaction signatures;
- viewing-key request flow;
- compliance report cards;
- "public ledger shows this / private report reveals this" explanation.

### Proofs / Developer Evidence

This route is for judges and developers, not daily customers.

It can show:

- provider;
- status;
- command;
- latest signature or event ID;
- docs link;
- what is complete;
- what needs funds/key/native host.

Keep it clean and factual, but do not make it the main app.

## Track Integration UX Mapping

### QuickNode

User-facing use:

- real-time wallet activity;
- incoming payment notifications;
- webhook-backed activity feed.

UI surface:

- activity feed;
- live status pill;
- "last webhook received" in developer/proofs route.

### MagicBlock / x402

User-facing use:

- paid agent endpoints;
- private payment builder;
- protected request flow.

UI surface:

- payment links;
- agent API monetization;
- request pricing;
- 402/payment required states.

### Torque

User-facing use:

- referral/rebate growth loop;
- paid request and wallet-connect events.

UI surface:

- referrals page;
- rebate earned;
- campaign activity.

### Birdeye

User-facing use:

- live market rates;
- swap decision support;
- token intelligence.

UI surface:

- price cards;
- route decision;
- market trend sparkline.

### GoldRush

User-facing use:

- counterparty risk scoring before payment.

UI surface:

- risk page;
- payment review risk section;
- approve/review/block recommendation.

### DFlow

User-facing use:

- MEV-aware conversion route.

UI surface:

- swap quote;
- fastest/cheapest route toggle;
- quote expiration;
- minimum received.

### Zerion

User-facing use:

- wallet/execution layer with scoped policy.

UI surface:

- routed transaction review;
- policy lock;
- spend limit;
- quote options.

### Kamino

User-facing use:

- deploy idle funds into yield.

UI surface:

- yield page;
- APY;
- deposit/withdraw;
- projected daily yield.

### LP Agent

User-facing use:

- advanced LP Zap-In/Zap-Out using the live LP Agent key.

UI surface:

- Meteora strategy card;
- Zap-In builds an unsigned transaction first; signed submission stays behind the funded review step.

### Cloak

User-facing use:

- private payroll/private B2B settlement.

UI surface:

- contractor payroll;
- private transfer status;
- viewing-key audit.

### Umbra

User-facing use:

- private balances / shielded incoming funds once SDK route is confirmed.

UI surface:

- privacy page;
- shield/unshield;
- encrypted balance state.

### Ika

User-facing use:

- policy-gated dWallet approval for AI-agent treasury signing.

UI surface:

- policy approval;
- dWallet status;
- pre-alpha caveat in developer/proofs route.

### QVAC

User-facing use:

- local/offline treasury brain deciding hold/yield/swap/pay.

UI surface:

- "AI treasury recommendation";
- confidence;
- reason;
- action preview.

Proof caveat:

- final QVAC proof must run on native Linux x64, not WSL.

### PUSD

User-facing use:

- non-freezable stablecoin payment option.

UI surface:

- invoice currency;
- payment rail;
- mint verification;
- real payment pending until funded.

### AUDD

User-facing use:

- AUD settlement currency for Australian clients.

UI surface:

- invoice currency;
- FX/rate route;
- payment history.

## Mainnet Testing Budget Model

Treat the mainnet budget as reusable principal, but not risk-free.

If you swap between your own wallets, most principal should stay under your
control, but these costs can reduce it:

- network fees;
- failed transaction fees;
- token account rent/ATA creation;
- slippage;
- spread;
- route minimums;
- LP deposit/withdraw fees;
- price movement;
- tokens getting stuck in a position if withdrawal flow is not tested.

Therefore, the safe mainnet plan is:

1. Start with read-only/quote calls.
2. Run empty-wallet or low-balance attempts to capture provider errors.
3. Do one tiny funded transaction per critical route.
4. Avoid LP deposits unless withdrawal is also ready.
5. Do not use full balance in one transaction.

Suggested flow with 10-15 USD:

- Keep about 5 USD equivalent in SOL for fees/retries.
- Use about 5-10 USD equivalent for a single mainnet swap route.
- Prefer one real Zerion-routed transaction first because Zerion explicitly
  requires a real transaction.
- Try DFlow next only if the quote minimum allows.
- Do not force Kamino/LP if minimums or withdrawal risk are unclear.

## Design Direction

Use the provided Halo-style prompt as the base visual language:

- warm off-white background;
- premium fintech spacing;
- big soft cards;
- elegant typography;
- cinematic hero;
- rounded but not childish;
- dark navy/charcoal panels;
- orange/gold Solana-energy accent;
- real partner logos where possible;
- no generic purple AI SaaS look.

The dashboard should share the landing page visual system:

- same font;
- same radius;
- same button language;
- same card depth;
- same background;
- same brand mark;
- same premium spacing.

Avoid:

- fake balances;
- "judge status" as the main dashboard;
- generic icon grids;
- unstyled tables;
- tiny dense enterprise clutter;
- AI-gradient slop;
- unsupported claims.

## Data Wiring Contract

Every UI widget should be designed to accept real data later:

- `balance.available`
- `balance.shielded`
- `balance.idle`
- `yield.positions`
- `payments.recent`
- `invoices`
- `contractors`
- `riskScores`
- `swapQuotes`
- `privacyRoutes`
- `policy`
- `auditEvents`
- `proofs`

If data is not available, use production empty states:

- "Connect wallet to load live balance."
- "No token account found."
- "No route available."
- "LP Agent Zap-In ready; funded LP position proof pending."
- "Native Linux QVAC proof pending."

Do not use fake charts or fake transaction rows unless they are clearly labelled
as placeholder design data in the frontend source and replaced during wiring.

## Output Requirements

Generate:

- React + TypeScript + Tailwind app;
- responsive desktop/tablet/mobile;
- landing page;
- auth pages;
- full app shell;
- all dashboard routes listed above;
- reusable components;
- modal and drawer patterns;
- transaction review flow;
- network switch;
- wallet-connect state;
- empty/error/loading states;
- `/proofs` evidence route separated from user dashboard.

If using Vite, keep components clean so they can be ported into the existing
Next.js app. Do not rely on Vite-only router patterns if avoidable.
