# `@arcpay/agent`

Phase 6 and Phase 13 package for local intelligence workflows and the live-proof demo runner.

This package can make treasury decisions, but it must not bypass on-chain policy enforcement in `packages/program`.

## Architecture Role

The agent package owns terminal demo orchestration only. It calls `@arcpay/sdk` adapters and may probe the local x402 server, but it must not import partner SDKs directly or embed private keys.

## Demo

Run from WSL for the same reason as the other Vitest/Next checks:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
npm run demo -w @arcpay/agent
```

By default the demo prints only live readiness/proof state. It does not claim Umbra shielding, Kamino deposits, DFlow swaps, Cloak payroll, Torque referrals, or GoldRush risk decisions unless those actions have real provider responses or transaction signatures.

For local engineering tests only, deterministic development adapters can be enabled explicitly:

```bash
export ARCPAY_ALLOW_DEVELOPMENT_DEMO=true
npm run demo -w @arcpay/agent
```

Outputs from this mode are not submission proof.

## Verification

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
npm run build -w @arcpay/agent
npm test -w @arcpay/agent
npm run readiness:tracks -w @arcpay/agent
```

The demo prints real devnet program explorer links. Partner actions are skipped unless live proof is available or development mode is explicitly enabled.

`readiness:tracks` is the pre-funding audit. It reports missing env, external
blocks, and tracks that are ready but still need wallet funds. It does not print
secret values.
