# Zerion Fork Integration Notes

This document records the ArcPay-specific Zerion CLI fork work. It does not
replace `packages/cli`; Zerion remains the external wallet and execution layer
required by the hackathon, while ArcPay's CLI remains the treasury/readiness
layer.

## Architecture Boundary

- Official upstream: `https://github.com/zeriontech/zerion-ai`
- Local inspection clone: `.tmp/zerion-ai`
- Zerion package: `zerion-cli@1.1.0`
- ArcPay package touched: none in the Zerion source tree until the public fork is created.

ArcPay must not vendor Zerion into `packages/cli`. The correct flow is:

1. Fork `zeriontech/zerion-ai` into a public GitHub repository.
2. Apply the ArcPay policy patch to that fork.
3. Use the forked Zerion CLI as the execution layer for a real routed swap.
4. Record the transaction signature and explorer link in `docs/smoke-test.md`.

## Patch Purpose

The hackathon requires a scoped autonomous policy and a real transaction routed
through Zerion. Upstream already supports agent policies, but the inspected
Solana swap path did not enforce executable policies before signing. The ArcPay
patch adds a spend-limit executable policy and ensures Solana swaps pass through
policy enforcement before transaction signing.

## Zerion Team Guidance

The Zerion Telegram thread on May 6, 2026 clarified the current constraints:

- Free Zerion API keys are available through `https://developers.zerion.io` and
  `https://dashboard.zerion.io`.
- Free API access should include swap endpoints; unexpected first-request `429`
  errors should be escalated to Zerion with the dashboard email.
- `zerion-cli@1.1.0` is the current published version as of May 9, 2026.
- Version `1.1.0` adds route selection flags `--fast` and `--cheapest`; if neither is supplied, the CLI lists quotes so the agent can choose.
- Windows CLI installation has a known native package issue; use WSL for now.
- Fork changes are allowed, but they should not break or replace Zerion's swap
  and bridge commands.
- Adding testnet entries to the forked CLI registry was allowed by the team, but
  no message in the thread confirmed that a testnet swap is accepted as final
  judging proof.

Practical decision: keep final proof on a real Zerion-routed transaction. Add
testnet/devnet registry support only as an engineering fallback, and do not mark
it complete unless judges or Zerion explicitly accept it.

## Files To Patch In The Public Fork

```text
cli/commands/agent/create-policy.js
cli/router.js
cli/utils/trading/guards.js
cli/utils/trading/swap.js
cli/policies/max-spend-usd.mjs
cli/tests/unit/cli/policies/max-spend-usd.test.mjs
```

Do not copy the local `.tmp/zerion-ai/package-lock.json` change unless the fork
intentionally regenerates dependencies on the target platform.

Optional testnet registry work, if needed, lives in:

```text
cli/utils/chain/registry.js
```

Current upstream Solana mapping is mainnet:

```text
solana -> solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
```

Do not swap this default to devnet for the final proof path. If testnet support
is added, expose it as a separate chain alias so mainnet swap/bridge behavior is
not changed.

## Implemented Policy Behavior

`--max-spend-usd` adds an executable policy named `max-spend-usd`.

The policy allows a transaction only when:

- `max_spend_usd` is configured and positive.
- The transaction includes a USD-equivalent spend estimate.
- The estimated spend is less than or equal to the configured limit.

The policy blocks by default when spend cannot be priced. This is intentional:
an agent should not be able to bypass spend limits by swapping an ambiguous
asset.

Current local estimator treats these input symbols as USD-like:

```text
USDC, USDT, DAI, USDG, PUSD, AUDD
```

For a final demo, use a tiny stablecoin input such as USDC so the limit can be
enforced without relying on another live pricing source.

## Verified Local Commands

Run from WSL:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay/.tmp/zerion-ai
npm install
node --test cli/tests/unit/cli/policies/max-spend-usd.test.mjs
node --check cli/commands/agent/create-policy.js
node --check cli/router.js
node --check cli/utils/trading/guards.js
node --check cli/utils/trading/swap.js
node --check cli/policies/max-spend-usd.mjs
```

Live Zerion API read proof from WSL:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay/.tmp/zerion-ai
node cli/zerion.js --version
node cli/zerion.js chains --json
node cli/zerion.js search USDC --json
node cli/zerion.js swap tokens solana --json
```

Observed result:

- `node cli/zerion.js --version` previously returned `1.0.1`; update local/global installs to `1.1.0` before final proof.
- `chains` returned `64` live chains and marked `solana` as trading-enabled.
- `search USDC` returned live Zerion API token data, including Solana USDC
  implementations.
- `swap tokens solana` reached the API but returned a Zerion `500 Internal
  Server Error`. This is a provider-route issue, not ArcPay proof completion.
- Direct Solana quote command reached `/swap/quotes/` but upstream `1.0.1`
  returned `400 Bad Request: 'to' is required`; the ArcPay fork patch now sends
  top-level `to` for all Solana quote requests, including same-wallet swaps.
- After the fork patch, the direct Solana quote command returned
  `insufficient_funds` for the configured wallet. This proves Zerion accepted
  the quote request shape and checked live wallet balance; it is not final
  completion because no transaction was signed or submitted.

Targeted fork verification:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay/.tmp/zerion-ai
node --test cli/tests/unit/cli/utils/trading/swap.test.mjs cli/tests/unit/cli/policies/max-spend-usd.test.mjs
node --check cli/utils/trading/swap.js
```

Observed result: `10` targeted tests passed.

Policy creation proof command:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay/.tmp/zerion-ai
mkdir -p /tmp/zerion-policy-proof-home
HOME=/tmp/zerion-policy-proof-home node cli/zerion.js agent create-policy \
  --name arcpay-solana-tight \
  --chains solana \
  --max-spend-usd 4 \
  --expires 24h \
  --json
```

Expected proof shape:

```json
{
  "executable": true,
  "config": {
    "scripts": ["max-spend-usd.mjs"],
    "max_spend_usd": 4
  }
}
```

## Final Hackathon Proof Commands

These commands must be run against the public fork, not the upstream clone.
Exact command names may need minor adjustment after the fork is installed.

```bash
git clone https://github.com/<your-user-or-org>/zerion-ai.git ~/zerion-ai-arcpay
cd ~/zerion-ai-arcpay
npm install
npm link
export ZERION_API_KEY="zk_real_key_here"
zerion --version
```

The version should be `1.1.0` or newer.

Create the policy:

```bash
zerion agent create-policy \
  --name arcpay-solana-tight \
  --chains solana \
  --max-spend-usd 4 \
  --expires 24h \
  --json
```

Create or select the wallet and agent token using the forked Zerion CLI:

```bash
zerion wallet list --json
zerion agent create-token --name arcpay-agent --wallet <wallet-name> --policy <policy-id> --json
zerion agent use-token <token-id>
```

Execute the smallest safe real swap that still routes through Zerion:

```bash
zerion swap 1 USDC SOL --chain solana --wallet <wallet-name> --json
```

If the wallet cannot hold USDC, use the smallest available stablecoin amount
that Zerion supports on Solana. Avoid SOL-input swaps for the first proof unless
a live SOL pricing estimate is added to the policy metadata.

For deterministic route choice on `zerion-cli@1.1.0`, add one of:

```bash
zerion swap 1 USDC SOL --chain solana --wallet <wallet-name> --fast --json
zerion swap 1 USDC SOL --chain solana --wallet <wallet-name> --cheapest --json
```

## Evidence Required For Completion

Zerion is complete only after all items exist:

- Public fork URL.
- Policy creation JSON showing `max-spend-usd`.
- Real Zerion-routed swap transaction signature.
- Solana explorer link for that signature.
- Demo note showing the transaction respected chain lock, expiry, and spend limit.

Until then, Zerion is implemented/tested, not complete.

## If The Zerion API Returns 429

The Zerion team said free API keys should have swap endpoint access. If the very
first swap quote request returns `429`, do not work around it in ArcPay code.
Send Zerion the dashboard email privately so they can inspect the logs.

Keep retry behavior conservative. A real submission proof should show a normal
successful API route, not an accidental bypass of provider limits.

## If `swap tokens solana` Returns 500

`zerion swap tokens solana` calls the swap fungibles route. If it returns a
server-side `500`, test the newer quote route directly through the swap command
before escalating:

```bash
node cli/zerion.js swap solana 0.01 USDC SOL \
  --address <mainnet-solana-wallet> \
  --json
```

This should reach `/swap/quotes/`. The current live result is
`insufficient_funds`, which is useful API evidence because it proves quote
routing reached Zerion and Zerion checked the wallet balance. A real completion
proof still requires a funded wallet, agent token, signed transaction, and
explorer link.

If the quote command returns `400 Bad Request: 'to' is required`, use the ArcPay
fork patch in `cli/utils/trading/swap.js`. It forces a top-level `to` receiver
for Solana quote requests, while preserving EVM same-chain default behavior.

If the quote command also returns `500` or a first-request `429`, send Zerion the
dashboard email privately and include the failing command shape without exposing
the API key.

## Items Needed From Product Owner

- Public fork URL after forking `https://github.com/zeriontech/zerion-ai`.
- `ZERION_API_KEY` from `https://dashboard.zerion.io`.
- A wallet usable by Zerion CLI with a tiny amount of mainnet SOL for gas.
- A tiny stablecoin balance, preferably USDC, for the spend-limited swap.
