# ArcPay Judge Guide

This is the fastest path for a judge, reviewer, or sponsor engineer to
understand ArcPay, run it locally, and find the honest proof for each track.

## 1. What ArcPay Is

ArcPay is a private, policy-controlled treasury operating system for AI-agent
businesses on Solana.

Core product surfaces:

- wallet-first onboarding and treasury access
- payments and invoices
- contractor risk checks and payout controls
- swaps and yield routing
- privacy rails and audit records
- policy enforcement over token, network, and action permissions

## 2. Fast Start

From the repo root:

```bash
npm install
npm run build
```

Start the frontend:

```bash
npm run dev -w @arcpay/frontend -- --hostname 127.0.0.1 --port 3000
```

Open:

```text
http://127.0.0.1:3000
```

Important routes:

- `/onboard`
- `/dashboard`
- `/wallet`
- `/payments`
- `/invoices`
- `/contractors`
- `/risk`
- `/swaps`
- `/yield`
- `/privacy`
- `/policies`
- `/audit`
- `/proofs`

## 3. What To Read First

Read these in order:

1. [README.md](C:/Users/RICHEY_SON/Desktop/ArcPay/README.md)
2. [docs/track-proof-index.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/track-proof-index.md)
3. [docs/smoke-test.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/smoke-test.md)
4. [docs/track-submission-checklist.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/track-submission-checklist.md)
5. [docs/api-keys-and-env.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/api-keys-and-env.md)

Use these when relevant:

- [docs/production-readiness.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/production-readiness.md)
- [docs/funded-proof-safety-plan.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/funded-proof-safety-plan.md)
- [docs/ika-dwallet-steps.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/ika-dwallet-steps.md)
- [docs/zerion-fork.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/zerion-fork.md)
- [docs/qvac-native-linux-vm.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/qvac-native-linux-vm.md)

## 4. Local Judge Flow

Recommended local walkthrough:

1. Open `/onboard` and connect a wallet or use email auth.
2. Open `/dashboard` to inspect balances, activity, and treasury state.
3. Open `/risk` and score a wallet.
4. Open `/payments` and create a request.
5. Open `/privacy` and inspect the enabled devnet or mainnet rails.
6. Open `/proofs` to see provider-level evidence and honest blockers.

## 5. Honest Status Rules

ArcPay does not treat tests, mocks, or static UI cards as final proof.

A track is only treated as complete when at least one of these exists:

- real provider/API response
- real accepted event
- real signed transaction
- real explorer/account proof
- real deployed app behavior

## 6. Environment Notes

Use `.env.example` for the canonical variable list.

Production/live backends are documented around:

- devnet backend: `http://20.208.46.195:4030`
- mainnet backend: `http://20.208.46.195:4031`

Do not rely on localhost values for deployed verification.

## 7. Known Important Boundaries

- QVAC final proof is native Linux x64, not WSL.
- Zerion is not a browser-native flow in the current product; its strongest
  proof is a real funded CLI-routed transaction.
- Umbra is not complete until a real privacy transaction exists.
- Ika is honest only as devnet / pre-alpha.
- Cloak is honest as devnet live proof unless a stronger mainnet proof is added.

## 8. Best Single Proof Page

For an in-product summary, open:

```text
/proofs
```

For the full evidence trail, use:

[docs/track-proof-index.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/track-proof-index.md)
