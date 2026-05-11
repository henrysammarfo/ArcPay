# `@arcpay/server`

Phase 3 package for the x402 server and MagicBlock payment acceptance flow.

This package must validate environment variables at startup, expose the protected agent endpoints from the build bible, and call `@arcpay/sdk` for post-payment orchestration.

## Current Endpoints

- `GET /agent/research`: protected, priced at `0.01 USDC`.
- `GET /agent/analysis`: protected, priced at `0.05 AUDD`.
- `POST /agent/task`: protected, priced at `0.10 USDC`.
- `GET /health`: unprotected service health endpoint.
- `GET /live/treasury`: unprotected live aggregate status from Solana RPC for the configured agent wallet.
- `POST /webhooks/quicknode`: QuickNode Solana webhook receiver.
- `GET /live/quicknode`: latest QuickNode webhook proof status.

## x402 Integration Status

`@x402/express` is available and installed. `@x402/solana` is not available on npm under the package name listed in `ArcPay_Build_Bible.txt`, so this package currently exposes a strict middleware boundary:

- Requests without `x-payment` return `402`.
- Local smoke tests can use `x-arcpay-dev-payment: paid`, but responses are marked `liveProof: false`.
- `ARCPAY_PAYMENT_MODE=production` requires an injected payment verifier and rejects startup without one.
- Production Solana settlement should be wired through the `PaymentVerifier` boundary once the correct Solana facilitator package/API is confirmed.

The development bypass header is not accepted in production mode.

`GET /live/treasury` is safe for the dashboard because it returns aggregate
public RPC data only: SOL balance, parsed token-account count/balances, endpoint
pricing, payment mode, network, and generated timestamp. It does not expose
private payroll amounts or private adapter internals.

## QuickNode Webhook Proof

Set a shared webhook secret:

```bash
export QUICKNODE_WEBHOOK_SECRET="change_this_shared_secret"
```

Configure the QuickNode webhook target to:

```text
POST https://your-public-url/webhooks/quicknode
```

Copy the QuickNode **Security Token** from the webhook page and set it as:

```bash
export QUICKNODE_WEBHOOK_SECRET="quicknode_security_token_here"
```

ArcPay verifies QuickNode signed webhook headers (`x-qn-nonce`,
`x-qn-timestamp`, `x-qn-content-hash`, and `x-qn-signature`) with this token.
For local curl tests only, ArcPay also accepts:

```text
x-arcpay-webhook-secret: quicknode_security_token_here
```

Check proof status:

```bash
curl -s http://localhost:4030/live/quicknode
```

Before a real QuickNode event is received, `liveProof` is `false`. After
QuickNode posts a webhook payload, `liveProof` becomes `true` and the latest
event payload is available for the demo evidence log. Do not paste private keys
or secrets into the webhook body.

## Solana Payment Verifier

`src/x402/solana-payment-verifier.ts` provides the current production verifier. It validates:

- `x-payment` contains a Solana transaction signature, JSON proof, or base64url JSON proof.
- Transaction exists and is confirmed by the configured Solana RPC.
- Transaction has no execution error.
- Transaction is newer than the verifier freshness window.
- SPL token balance delta pays the configured endpoint mint to the configured `payTo` wallet.
- Paid amount is at least the endpoint price.
- Transaction signature has not already been claimed for that endpoint.

Production mode from the CLI runtime wires this verifier automatically:

```bash
export ARCPAY_PAYMENT_MODE=production
export ARCPAY_REPLAY_STORE_PATH=".arcpay-payment-replays.json"
npm run dev -w @arcpay/server
```

The file replay store is safe for a single server process and persists across restarts. Multi-instance production should replace it with a database or Redis-backed `PaymentReplayStore`.

Accepted `x-payment` proof shapes:

```json
{"signature":"solana-transaction-signature"}
```

or the same JSON encoded as base64url, or the raw Solana signature.

## Validation

```bash
npm run build -w @arcpay/server
```

Run tests from WSL if Windows blocks Vitest worker spawning:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay/packages/server
npm test
```
