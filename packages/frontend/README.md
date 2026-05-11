# `@arcpay/frontend`

Phase 9 package for the agency owner dashboard.

The dashboard must preserve privacy by showing aggregate treasury state only. It must not display per-agent private balances or raw contractor payment amounts.

## Architecture Role

This package owns the Solflare/Phantom-connected agency owner UI from the build bible Phase 9. It consumes public environment configuration only and must call SDK/server boundaries for real treasury data instead of importing partner SDKs directly.

## Local Run

Windows Vitest and some Next.js child-process paths can hit `spawn EPERM`, so run verification through WSL for now:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
npm run build -w @arcpay/frontend
npm run dev -w @arcpay/frontend
```

Optional public RPC override:

```bash
export NEXT_PUBLIC_QUICKNODE_RPC_URL="https://api.devnet.solana.com"
export NEXT_PUBLIC_ARCPAY_SERVER_URL="http://localhost:4030"
```

The dashboard fetches live aggregate state from `GET /live/treasury` on the
ArcPay server. If the server is unavailable, the page displays the blocker
instead of dummy balances.

The response is runtime-validated before rendering. The dashboard requires
`source: "solana-rpc"` and `liveProof: true`; malformed or non-live responses
are rejected instead of being shown as proof.

## Privacy Requirements

- Show aggregate treasury data from live server/RPC responses only.
- Show contractor payment counts, not raw private payment amounts.
- Hide conversion/risk/referral summaries until real provider responses or transaction signatures exist.
