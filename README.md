# ArcPay

ArcPay is a private, policy-controlled treasury OS for AI agents on Solana.
It turns paid agent requests into verifiable treasury actions: risk scoring,
privacy, execution, yield routing, and growth telemetry are shown as live proof
or explicit blockers.

## Judge Start Path

1. Read `docs/track-submission-checklist.md` for the current completion matrix.
2. Read `docs/smoke-test.md` for transaction signatures and live API proof output.
3. Read `docs/production-readiness.md` for build, browser, audit, and Anchor checks.
4. Read `docs/funded-proof-safety-plan.md` before any mainnet transaction.
5. Run the proof commands below for the tracks you are judging.
6. Open the frontend dashboard to see user-facing treasury flows.

```bash
npm install
npm run build
npm test
```

## Frontend

```bash
npm run dev -w @arcpay/frontend -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`.

The frontend is now a customer-facing treasury product shell, not a proof-card
dashboard. Raw sponsor/proof evidence is separated into `/proofs`, while normal
operators use:

- `/dashboard` for cashflow, approvals, balances, and live treasury status;
- `/wallet`, `/payments`, `/invoices`, `/contractors`, `/swaps`, `/yield`,
  `/privacy`, and `/risk` for day-to-day treasury operations;
- `/policies` for policy settings that persist locally and show a save success
  message, with Supabase sync when the operator is signed in;
- `/audit` for date/search filtered audit records with CSV export;
- `/profile` and `/settings` for operator/workspace settings;
- `/sign-in`, `/sign-up`, `/forgot-password`, and `/reset-password` for
  Supabase-backed auth flows.

The product/UI brief is preserved at `docs/product-ui-brief.md`.

Live frontend integration routes:

- `/api/dflow`: live DFlow quote/signable transaction builder.
- `/api/risk`: server-side GoldRush counterparty risk lookup.
- `/api/lpagent`: LP Agent positions and Zap-In transaction builder proxy.
- `/api/torque`: Torque `custom_events` submission, triggered by payment creation.
- `/api/kamino`: Kamino deposit/withdraw unsigned transaction builder.
- `/api/magicblock`: MagicBlock Private Payments health + SPL deposit builder.
- `/api/cloak`: Cloak devnet program/proof-signature status check.
- `/api/umbra`: Umbra indexer reachability check.
- `/api/ika`: Ika pre-alpha program/dWallet/approval proof check.
- `/api/pusd`: official PUSD mint metadata + Palm circulation API proof.

The dashboard/proof model intentionally separates:

- `complete`: live provider response or transaction proof exists;
- `needs funds`: code/env are ready, but final value-moving proof needs funds;
- `waiting`: sponsor key or dWallet address is not available yet;
- `native Linux`: QVAC requires native linux-x64, not WSL.

## Core Proof Commands

```bash
npm run readiness:tracks -w @arcpay/agent
npm run proof:goldrush -w @arcpay/agent
npm run proof:pusd -w @arcpay/agent
npm run proof:cloak -w @arcpay/agent
npm run proof:torque -w @arcpay/agent
npm run proof:ika -w @arcpay/agent
npm run proof:ika:grpc -w @arcpay/agent
npm run proof:ika:create-dwallet -w @arcpay/agent
npm run proof:ika:approve -w @arcpay/agent
npm run proof:dflow -w @arcpay/agent
```

QVAC must be run on native Linux x64:

```bash
bash scripts/qvac-runtime-proof.sh
```

Do not use WSL for the final QVAC proof. The QVAC team confirmed linux-x64 is
tested, while WSL is currently untested.

## Sponsor Map

| Track | Code / docs | Current honest status |
| --- | --- | --- |
| Solana / Main | `packages/program`, `packages/sdk/src/program`, `packages/agent/src/program-*`, `docs/smoke-test.md` | Devnet program proofs recorded; final public demo pending. |
| QuickNode | `packages/server/src/x402/quicknode-webhook.ts`, `docs/smoke-test.md` | Devnet webhook/RPC proof complete. |
| Torque | `packages/sdk/src/growth/torque.ts`, `packages/agent/src/torque-proof.ts` | Custom events accepted; friction log/demo post pending. |
| GoldRush | `packages/sdk/src/risk/goldrush.ts`, `packages/agent/src/goldrush-proof.ts` | Live Solana data drives ArcPay risk `BLOCK` / `APPROVE` policy. |
| Cloak | `packages/sdk/src/privacy/cloak-devnet.ts`, `packages/agent/src/cloak-devnet-proof.ts` | Official Cloak devnet SDK transaction recorded. |
| PUSD | `packages/agent/src/pusd-proof.ts`, `docs/api-keys-and-env.md` | Official mint/API verified; real PUSD receive/pay proof still needed. |
| DFlow | `packages/sdk/src/intelligence/dflow.ts`, `packages/agent/src/dflow-order-proof.ts`, `/api/dflow` | Live quote/signable transaction route in frontend; final submit needs funded wallet signature. |
| Zerion | `docs/zerion-fork.md` | Fork/policy path ready; real routed transaction needs funds. |
| Ika | `packages/agent/src/ika-*`, `docs/ika-dwallet-steps.md` | Pre-alpha dWallet created and ArcPay policy-gated `ApproveMessage` tx submitted on devnet. |
| LP Agent | `packages/sdk/src/yield/meteora-lp.ts`, `/api/lpagent` | Live positions in frontend and Zap-In API proxy; final signed/submitted LP position proof still needs funds/approval. |
| QVAC | `packages/sdk/src/intelligence/qvac-brain.ts`, `scripts/qvac-runtime-proof.sh` | Code ready; final proof requires native Linux x64. |
| Frontend / Eitherway | `packages/frontend`, `docs/track-submission-checklist.md` | Next 16.2.6 responsive app builds and passes browser E2E; public deployment pending. |

## Key Docs

| File | Purpose |
| --- | --- |
| `ArcPay_Build_Bible.txt` | Original product vision and track thesis. |
| `docs/product-ui-brief.md` | Product/UI brief for replacing the dashboard with a real consumer/enterprise treasury app. |
| `docs/track-submission-checklist.md` | Track-by-track eligibility, proof status, and final artifacts. |
| `docs/smoke-test.md` | Live signatures, provider proof output, and proof commands. |
| `docs/funded-proof-safety-plan.md` | `$15` mainnet/devnet test budget rules and safe submit order. |
| `docs/api-keys-and-env.md` | API-key links, env setup, and expected empty-wallet results. |
| `docs/zerion-fork.md` | Zerion fork policy and final transaction plan. |
| `docs/ika-dwallet-steps.md` | Ika pre-alpha dWallet and `ApproveMessage` proof. |
| `docs/qvac-native-linux-vm.md` | Native Linux x64 QVAC proof route, because WSL is untested by QVAC. |

## Current Truth

ArcPay now has frontend-live routes for every active integration except QVAC.
That does not mean every sponsor prize requirement is closed. The repo is ready
for the next stage:

- public deployment;
- final `$15` funded proof pass for value-moving mainnet actions;
- QVAC native Linux x64 proof;
- LP Agent signed/submitted Zap-In or resulting LP position proof;
- Zerion real routed transaction proof;
- final demo videos and X/Superteam/Colosseum submission assets.

The completed proofs and pending items are intentionally documented instead of
hidden. That keeps the submission defensible and avoids fake track-completion
claims.

## Environment

Use `.env.example` as the source of required variables. Detailed setup links and
API-key steps live in `docs/api-keys-and-env.md`.

Secrets are read from environment variables and are not printed by proof
commands.

## No-Mock Policy

ArcPay does not mark a track complete from unit tests alone. Unit tests prove
code readiness. Track completion requires a live provider response, accepted
custom event, transaction signature, deployed app, or explicit sponsor-accepted
proof route.
