# `@arcpay/cli`

Phase 9 package for the ArcPay CLI.

Commands must call `@arcpay/sdk` instead of reimplementing treasury, risk, privacy, yield, or swap logic.

## Zerion Status

The valid official Zerion CLI source is `https://github.com/zeriontech/zerion-ai`.

ArcPay keeps `@arcpay/cli` as the treasury-specific command surface and treats the official `zerion-cli` as an external companion tool for wallet analysis, swaps, bridge routes, wallet management, and agent tokens. This prevents ArcPay treasury policy logic from being replaced by an external CLI while still supporting the Superteam requirement.

Required external setup for live Zerion usage:

```bash
npm install -g zerion-cli
export ZERION_API_KEY="zk_..."
zerion --help
arcpay zerion status
```

Create the scoped policy that the forked Zerion CLI must enforce before any
real swap or bridge:

```bash
arcpay zerion policy \
  --chain solana \
  --wallet your_mainnet_wallet \
  --max-spend-usd 4 \
  --expires-at 2026-05-11T23:59:59.000Z \
  --route swap \
  --allowed-asset USDC \
  --allowed-asset SOL \
  --blocked-action bridge
```

This command validates and prints the policy only. It does not claim live proof
or execute a transaction. Final Zerion completion still requires the forked
Zerion CLI to enforce the policy and return a real transaction signature routed
through the Zerion API.

`arcpay balance` reads from the ArcPay server `GET /live/treasury` endpoint. If
the server is offline or not configured, the command reports the missing live
dependency instead of returning fake balances.

`arcpay receive`, `arcpay pay`, and `arcpay yield` are intentionally blocked
from pretending to move funds. They return the exact live proof dependency that
must be completed instead of emitting fake transaction IDs.

You can also use Zerion's guided setup:

```bash
npx -y zerion-cli init -y --browser
```

## Commands

```bash
arcpay treasury init --agent-id my-agent --daily-limit 5000
arcpay receive --currency AUDD --webhook https://example.com/webhook
arcpay pay --to contractor-wallet --amount 200 --currency SOL --private
arcpay yield --action deposit --amount 1000 --provider kamino
arcpay balance --agent my-agent
arcpay score --wallet counterparty-wallet
arcpay zerion status
arcpay zerion policy --chain solana --max-spend-usd 4 --expires-at 2026-05-11T23:59:59.000Z
```
