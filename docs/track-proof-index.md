# ArcPay Track Proof Index

This file maps each sponsor or partner track to the exact code, docs, proof
command, and current honest status.

## Legend

- `Live`: real provider response, accepted event, or real transaction proof exists.
- `Devnet`: real proof exists, but it is honestly limited to devnet or pre-alpha.
- `Needs funds`: integration is real, but the final value-moving proof still needs a funded wallet.
- `Partial`: implementation and some proof exist, but the final required track artifact is still missing.

## Track Index

| Track | Product surface | Main code/docs | Proof command or route | Current status |
| --- | --- | --- | --- | --- |
| Main Frontier / Solana | Treasury OS | `packages/program`, `packages/frontend`, [docs/smoke-test.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/smoke-test.md) | `npm run readiness:tracks -w @arcpay/agent` | Partial |
| QuickNode | RPC + webhook | `packages/server/src/x402/quicknode-webhook.ts`, `/proofs` | backend `/live/quicknode`, `/proofs` | Devnet live |
| Torque | Custom events | `packages/sdk/src/growth/torque.ts`, `packages/frontend/src/app/api/torque/route.ts` | `npm run proof:torque -w @arcpay/agent` | Live |
| GoldRush | Risk scoring | `packages/sdk/src/risk/goldrush.ts`, `/risk` | `npm run proof:goldrush -w @arcpay/agent` | Live |
| Birdeye | Market data | partner smoke path, pricing/risk surfaces | `npm run smoke:partners -w @arcpay/agent` | Live read-only |
| MagicBlock / x402 | Private Payments builder | `packages/frontend/src/app/api/magicblock/route.ts`, `/privacy` | `npm run proof:magicblock -w @arcpay/agent` | Devnet live |
| Cloak | Privacy rail | `packages/sdk/src/privacy/cloak-devnet.ts`, `/privacy` | `npm run proof:cloak -w @arcpay/agent` | Devnet live |
| Umbra | Privacy rail | `packages/sdk/src/privacy/umbra.ts`, `packages/frontend/src/app/api/umbra/route.ts` | `/api/umbra`, `/privacy` | Partial / needs funded tx |
| Ika | dWallet policy approval | `packages/agent/src/ika-*`, `/privacy` | `npm run proof:ika:create-dwallet -w @arcpay/agent`, `npm run proof:ika:approve -w @arcpay/agent` | Devnet / pre-alpha live |
| DFlow | Swap quote + signable tx | `packages/frontend/src/app/api/dflow/route.ts`, `/swaps` | `npm run proof:dflow -w @arcpay/agent` | Live quote/signable; funded submit pending |
| Kamino | Yield tx builder | `packages/frontend/src/app/api/kamino/route.ts`, `/yield` | `npm run smoke:kamino -w @arcpay/agent` | Live unsigned builder; funded submit pending |
| LP Agent | Meteora positions / Zap-In | `packages/frontend/src/app/api/lpagent/route.ts`, `/yield` | `npm run smoke:partners -w @arcpay/agent` | Live read/build; funded submit pending |
| Zerion | CLI execution rail | `packages/cli/src/commands.ts`, [docs/zerion-fork.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/zerion-fork.md) | `arcpay zerion status`, `arcpay zerion policy` | Partial / needs real routed tx |
| QVAC | Local treasury brain | `packages/sdk/src/intelligence/qvac-brain.ts`, `packages/server/src/x402/qvac-live.ts` | `bash scripts/qvac-runtime-proof.sh` | Native Linux live proof |
| PUSD | Stablecoin rail | `packages/frontend/src/app/api/pusd/route.ts`, `/privacy` | `npm run proof:pusd -w @arcpay/agent` | Live mint/API proof |
| AUDD | Payment token / settlement narrative | payments/policies/privacy surfaces | app flow plus sponsor docs | Partial |

## Best Files Per Topic

### Product and local run

- [README.md](C:/Users/RICHEY_SON/Desktop/ArcPay/README.md)
- [docs/judges-guide.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/judges-guide.md)

### Track-by-track submission truth

- [docs/track-submission-checklist.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/track-submission-checklist.md)

### Live outputs, signatures, and provider evidence

- [docs/smoke-test.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/smoke-test.md)

### Env and API setup

- [docs/api-keys-and-env.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/api-keys-and-env.md)
- [.env.example](C:/Users/RICHEY_SON/Desktop/ArcPay/.env.example)

### Special-case rails

- [docs/zerion-fork.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/zerion-fork.md)
- [docs/ika-dwallet-steps.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/ika-dwallet-steps.md)
- [docs/qvac-native-linux-vm.md](C:/Users/RICHEY_SON/Desktop/ArcPay/docs/qvac-native-linux-vm.md)

## Recommended Judge Commands

From repo root:

```bash
npm install
npm run build
npm run readiness:tracks -w @arcpay/agent
npm run proof:goldrush -w @arcpay/agent
npm run proof:torque -w @arcpay/agent
npm run proof:cloak -w @arcpay/agent
npm run proof:ika:create-dwallet -w @arcpay/agent
npm run proof:ika:approve -w @arcpay/agent
npm run proof:dflow -w @arcpay/agent
npm run proof:pusd -w @arcpay/agent
```

For QVAC:

```bash
bash scripts/qvac-runtime-proof.sh
```
