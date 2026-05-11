# ArcPay Funded Proof Safety Plan

This file controls the $15 final proof budget.

## Budget Rule

- Keep about `$5` equivalent in SOL for network fees, ATA creation, and retries.
- Use about `$10` equivalent as reusable principal for tiny swap/payment proofs.
- Do not put the full balance into any LP/yield position until withdrawal is
  verified.

Swapping between your own wallets preserves most principal, but it is not free.
Expected leakage:

- network fees;
- failed transaction fees;
- associated token account rent;
- route spread;
- slippage;
- provider minimums;
- LP deposit/withdraw costs;
- price movement while testing.

## Safe Submit Order

1. Read-only proof.
2. Quote/build transaction.
3. Empty-wallet or low-balance attempt if useful.
4. Review minimums, route, slippage, recipient, network, and token accounts.
5. Submit a tiny funded transaction only after the above is clean.

## Mainnet Priority

### 1. Zerion

Reason: Zerion explicitly requires a real onchain transaction routed through the
Zerion API/CLI. This gets first use of the `$10` principal.

Safe route:

- use one stablecoin input if possible;
- set scoped policy max spend below or equal to the intended amount;
- use `--fast` or `--cheapest` for deterministic route choice;
- capture policy JSON and final Solana explorer link.

Do not complete this track from `insufficient_funds` alone.

### 2. DFlow

Reason: DFlow already returns a signable order transaction. After Zerion, test
DFlow only if the route minimum allows the remaining balance.

Safe route:

- keep `ARCPAY_DFLOW_SUBMIT=false` for quote/build;
- review `inAmount`, `outAmount`, `slippageBps`, and `signedTransactionBytes`;
- set `ARCPAY_DFLOW_SUBMIT=true` only for the final tiny transaction.

The proof script now returns:

- `ready`: signable order built and signed locally, not submitted;
- `submitted`: final transaction landed;
- `insufficient_funds`: provider/RPC reached the real submit path but wallet
  lacks funds;
- `route_rejected`: submit failed for another route/preflight reason.

### 3. PUSD

Reason: PUSD track wants utility with PUSD. The current proof verifies official
mint/API and no-freeze mint metadata. Final payment proof needs real PUSD
balance or written sponsor acceptance.

Do not buy/route PUSD until:

- source of PUSD liquidity is confirmed;
- minimum amount is known;
- receive/pay target wallet is confirmed;
- token account creation cost is acceptable.

### 4. Kamino

Reason: Kamino can create a real yield story, but with `$15` total it is risky
unless minimums and withdrawal are clear.

Safe route:

- use unsigned builder first;
- deposit only if minimum is small;
- test withdraw path before claiming final completion.

### 5. LP Agent

API key and unsigned Zap-In builder proof are configured. Remaining final proof
is signed/submitted Zap-In or Zap-Out after explicit wallet funding approval.

### 6. Umbra / AUDD

Do not spend mainnet budget here until the exact live route and liquidity are
confirmed. Keep these as integration-ready/funded-proof-pending unless sponsor
requirements force them above Zerion/DFlow.

## Devnet Funding

The devnet wallet has enough SOL for multiple devnet proofs. For devnet USDC,
use the official Circle Solana devnet USDC mint:

```text
4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

Use devnet for:

- Cloak devnet;
- MagicBlock Private Payments devnet builder/submit;
- Solana program proofs;
- x402 devnet mint test when explicitly enabled;
- Ika pre-alpha/devnet.

## Script Safety Changes

- `proof:dflow` does not throw on known funded-submit preflight failures; it
  returns `insufficient_funds` or `route_rejected`.
- `proof:x402:payment` defaults to existing token balance transfer. Devnet mint
  testing requires `ARCPAY_X402_DEVNET_MINT_TEST=true` and `SOLANA_NETWORK=devnet`.
- `proof:magicblock` already requires owner address to match signer before
  deposit submission and returns `insufficient_funds` for empty token wallets.
