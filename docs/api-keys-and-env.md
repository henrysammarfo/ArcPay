# ArcPay API Keys And Env Readiness

This guide is the source of truth for getting ArcPay to a judge-testable state
before the proof wallet is funded. Do not paste real keys into Git, docs, or
chat. Store them in `.env` only.

## Readiness Command

Run this after filling `.env`:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
npm run readiness:tracks -w @arcpay/agent
```

The command does not print secrets. It reports:

- `ready`: enough env exists for API/readiness proof.
- `needs_funds`: code/env is ready, but final proof needs a funded wallet.
- `missing_env`: required env values are absent.
- `waiting_external`: blocked on partner access or support response.

An empty wallet is acceptable during readiness. For funded tracks, the expected
failure is an explicit provider/RPC error such as `insufficient_funds`, minimum
trade/deposit amount, missing token account, or no route. Silent success without
a transaction signature does not count as settlement.

For sponsor-specific eligibility, submission assets, and final proof blockers,
use `docs/track-submission-checklist.md`.

## Frontend Live Integration Routes

The customer app now calls real server routes instead of static proof cards:

| Route | Provider surface | Frontend use |
| --- | --- | --- |
| `/api/dflow` | DFlow order quote/signable transaction | `/swaps` quote and wallet-submit flow |
| `/api/risk` | GoldRush Solana balances/risk | `/risk` and contractor scoring |
| `/api/lpagent` | LP Agent positions and Zap-In tx proxy | `/yield` LP Agent position read |
| `/api/torque` | Torque `custom_events` | `/payments` pay-link creation |
| `/api/kamino` | Kamino deposit/withdraw transaction builder | `/yield` review action |
| `/api/magicblock` | MagicBlock Private Payments API | `/privacy` provider action and `/proofs` |
| `/api/cloak` | Cloak devnet program/proof-signature status | `/privacy` provider action and `/proofs` |
| `/api/umbra` | Umbra indexer reachability | `/privacy` provider action and `/proofs` |
| `/api/ika` | Ika program/dWallet/approval proof | `/privacy` provider action and `/proofs` |
| `/api/pusd` | PUSD SPL mint + Palm circulation API | `/privacy` provider action and `/proofs` |
| `/api/qvac` | Azure-hosted ArcPay backend `/live/qvac` proxy | `/proofs` live QVAC status |
| `/api/quicknode` | Azure-hosted ArcPay backend `/live/quicknode` proxy | `/proofs` live QuickNode webhook status |

These routes do not fake transaction settlement. If a provider needs funds or a
wallet signature, the UI returns the provider/config/funding error and does not
mark funds as moved.

## Azure And Vercel Split

ArcPay is now shaped for a split deployment:

- `packages/frontend` on Vercel
- `packages/server` on Azure

For clean devnet/mainnet separation, prefer separate Azure backend URLs:

```bash
ARCPAY_DEVNET_SERVER_URL=https://<your-devnet-backend>
ARCPAY_MAINNET_SERVER_URL=https://<your-mainnet-backend>
NEXT_PUBLIC_ARCPAY_DEVNET_SERVER_URL=https://<your-devnet-backend>
NEXT_PUBLIC_ARCPAY_MAINNET_SERVER_URL=https://<your-mainnet-backend>
```

The older single-backend vars still work as fallback:

```bash
ARCPAY_SERVER_URL=https://<shared-backend>
NEXT_PUBLIC_ARCPAY_SERVER_URL=https://<shared-backend>
```

Use the split URLs when you want Vercel to target a devnet Azure service for
devnet pages and a separate mainnet Azure service for mainnet pages.

## Key And Access Checklist

| Track | Get Access From | Env Vars | Empty-Wallet Expected Result |
| --- | --- | --- | --- |
| QuickNode | QuickNode dashboard, Solana endpoint + webhook Security Token | `QUICKNODE_RPC_URL`, `QUICKNODE_WEBHOOK_SECRET`, optional `QUICKNODE_WEBHOOK_ID` / `QUICKNODE_WEBHOOK_URL` | RPC works; webhook waits for live transaction. |
| x402 / MagicBlock | ArcPay Solana verifier plus MagicBlock Private Payments API | `ARCPAY_PAYMENT_MODE`, `AGENT_WALLET_ADDRESS`, token mint envs, `MAGICBLOCK_PRIVATE_PAYMENTS_API_URL`, `MAGICBLOCK_PAYMENT_OWNER_ADDRESS`, `MAGICBLOCK_PAYMENT_MINT_ADDRESS` | 402 without payment; MagicBlock builder can return unsigned tx or minimum/funding error. |
| Torque | Torque dashboard Developer page | `TORQUE_API_KEY`, `TORQUE_EVENT_API_URL`, `TORQUE_USER_PUBKEY`, `TORQUE_AGENT_ID` | Custom events can succeed without wallet funds. |
| Birdeye | Birdeye BDS dashboard API keys | `BIRDEYE_API_KEY`, `BIRDEYE_PRICE_MINT_ADDRESS` | Live read-only price should succeed. |
| GoldRush | GoldRush/Covalent dashboard API key | `GOLDRUSH_API_KEY`, `GOLDRUSH_SCORE_WALLET` | Live read-only balances should succeed. |
| DFlow | Dev endpoint needs no key; production key is optional for final production routing | `DFLOW_API_BASE_URL`, optional `DFLOW_API_KEY`, `ARCPAY_SIGNER_KEYPAIR_PATH` | Quote/signable order succeeds; submission returns insufficient funds until wallet is funded. |
| Zerion | Zerion developer dashboard | `ZERION_API_KEY`; install `zerion-cli@1.1.0` | Quote path should reach Zerion and return insufficient funds/no route until funded. |
| Kamino | No API key for current transaction builder path | `KAMINO_MARKET_ADDRESS`, `KAMINO_USDC_RESERVE_ADDRESS`, `KAMINO_DEPOSIT_AMOUNT`, wallet/RPC envs | Builder can return unsigned tx; final submit needs funds. |
| LP Agent | `portal.lpagent.io`, then premium endpoint approval from LP Agent team | `LP_AGENT_API_KEY`, `LP_AGENT_ZAP_IN_*` | Key configured; Zap-In builder returns an unsigned transaction. Final LP position proof needs signed/submitted funding approval. |
| QVAC | Local SDK install, no cloud key expected | `QVAC_SDK_PATH`, `ARCPAY_REQUIRE_LIVE_QVAC=true`, `QVAC_LINUX_HOST_CONFIRMED=true` | Must run on native Linux x64; WSL is not supported/tested by QVAC. |
| Umbra | Umbra SDK/docs and funded wallet | `UMBRA_NETWORK`, `UMBRA_INDEXER_API_ENDPOINT` | No simple API key found in official docs; final shield flow needs supported pool/network and funds. |
| Cloak | Cloak devnet docs, faucet-funded wallet | `CLOAK_NETWORK`, `CLOAK_RELAY_URL`, `CLOAK_PROGRAM_ID`, `CLOAK_MOCK_USDC_MINT` | Empty wallet should fail with `needs_funds`; funded devnet signer should submit a real Cloak transaction. |
| Encrypt / Ika | Ika Solana pre-alpha docs | `IKA_SOLANA_RPC_URL`, optional `IKA_GRPC_ENDPOINT` / `IKA_PROGRAM_ID` | Ika is the active target; devnet/pre-alpha only, no production MPC claim. |
| AUDD | Verified AUDD mint/liquidity source | `AUDD_MINT_ADDRESS` | Receive/rate proof needs live mint/liquidity. |
| PUSD | Palm USD developer docs and public API | `PUSD_MINT_ADDRESS`, `PUSD_RPC_URL`, `PUSD_API_BASE_URL` | Read-only proof verifies mint/API; receive/pay proof needs PUSD balance. |
| Supabase | Supabase project dashboard | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`, later server-only secret/service role if needed | Auth UI routes render now; real sessions need these keys. |
| Eitherway | Eitherway app/deploy flow | Deployment URL, partner integration docs | Final track expects public mainnet dApp. |

## Exact Key Steps

### QuickNode

1. Create or open a Solana endpoint in QuickNode.
2. Copy the HTTPS RPC URL into `QUICKNODE_RPC_URL`.
3. Create a webhook watching the ArcPay wallet.
4. Copy the webhook Security Token into `QUICKNODE_WEBHOOK_SECRET`.
5. Keep the webhook URL and ID in `.env` for operator reference:

```bash
QUICKNODE_WEBHOOK_ID=
QUICKNODE_WEBHOOK_URL=
```

### MagicBlock / x402 / Private Payments

ArcPay uses two payment surfaces for this track:

- ArcPay's production-mode x402 Solana verifier for paid agent HTTP requests.
- MagicBlock's documented Private Payments API for the sponsor-specific private
  payment surface.

Set:

```bash
ARCPAY_PAYMENT_MODE=production
AGENT_WALLET_ADDRESS=<ArcPay receiving wallet>
USDC_MINT_ADDRESS=<devnet or mainnet USDC/SPL mint for the payment proof>

MAGICBLOCK_PRIVATE_PAYMENTS_API_URL=https://payments.magicblock.app
MAGICBLOCK_CLUSTER=devnet
MAGICBLOCK_PAYMENT_OWNER_ADDRESS=<ArcPay wallet>
MAGICBLOCK_PAYMENT_MINT_ADDRESS=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
MAGICBLOCK_PAYMENT_AMOUNT=1000000
```

Run:

```bash
npm run proof:magicblock -w @arcpay/agent
```

This must reach the MagicBlock Private Payments API health endpoint and SPL
deposit builder. It is not the same proof as the generic x402 Solana verifier.
Final completion still needs the funded payment/deposit transaction or a
sponsor-accepted builder proof.

For x402 funded payment proof, ArcPay now defaults to transferring an existing
token balance from `ARCPAY_SIGNER_KEYPAIR_PATH`. It no longer mints test tokens
unless explicitly enabled for devnet:

```bash
ARCPAY_X402_DEVNET_MINT_TEST=true
SOLANA_NETWORK=devnet
```

Do not use `ARCPAY_X402_DEVNET_MINT_TEST=true` for mainnet. Mainnet x402 proof
must use existing wallet balance so the result reflects a real paid request.

### Torque

1. Open the ArcPay project in Torque.
2. Go to Developer.
3. Create an Event API key and store it as `TORQUE_API_KEY`.
4. Ensure `arcpay_wallet_connected` and `arcpay_paid_agent_request` exist as custom events.
5. Keep `TORQUE_EVENT_API_URL=https://ingest.torque.so/events`.

### Birdeye

1. Open the Birdeye/BDS developer dashboard.
2. Create an API key.
3. Store it as `BIRDEYE_API_KEY`.
4. Keep `BIRDEYE_PRICE_MINT_ADDRESS=So11111111111111111111111111111111111111112` for SOL price proof unless testing another mint.

### GoldRush

1. Open GoldRush/Covalent and create an API key.
2. Store it as `GOLDRUSH_API_KEY`.
3. Set `GOLDRUSH_SCORE_WALLET` to the wallet being scored.
4. Set `GOLDRUSH_MIN_SCORE=70` unless testing a different ArcPay policy.
5. Run `npm run proof:goldrush -w @arcpay/agent`.

### DFlow

1. Use `DFLOW_API_BASE_URL=https://dev-quote-api.dflow.net` for no-key dev proof.
2. For production routing, switch to `https://quote-api.dflow.net` and set `DFLOW_API_KEY` if DFlow provides one.
3. Keep `ARCPAY_DFLOW_SUBMIT=false` until the wallet is funded.
4. Treat DFlow as a funded-proof blocker, not an external blocker, because dev quote/signable transaction proof already works.

### Zerion

1. Create a Zerion developer API key.
2. Store it as `ZERION_API_KEY`.
3. Install the current CLI:

```bash
npm install -g zerion-cli@1.1.0
zerion --version
```

4. Use `--fast` or `--cheapest` when you want deterministic route selection. If neither is supplied, Zerion CLI lists quotes and the agent can choose.

### LP Agent

1. Register at `https://portal.lpagent.io/`.
2. Request premium endpoint access from the LP Agent team.
3. Store the key as `LP_AGENT_API_KEY`.
4. After the key is present, fill Zap-In values:

```bash
LP_AGENT_ZAP_IN_POOL_ID=
LP_AGENT_ZAP_IN_WALLET_ADDRESS=
LP_AGENT_ZAP_IN_INPUT_SOL=0.01
LP_AGENT_ZAP_IN_PERCENT_X=0.5
LP_AGENT_ZAP_IN_SLIPPAGE_BPS=50
```

Current ArcPay proof values use LP Agent pool
`8EZqMc266xTtnS3uxstp8DdNU95fWKQ7mYyAZULSc6We`, a `0.01` SOL unsigned Zap-In,
and the configured agent wallet. This is safe because it only builds the
transaction; it does not sign or submit.

### QVAC

1. Use a native Linux x64 host. Do not use WSL for final QVAC proof.
2. Install `@qvac/sdk` with the canonical npm path:

```bash
npm i @qvac/sdk
```

3. Set `QVAC_SDK_PATH` to that package directory.
4. Set `ARCPAY_REQUIRE_LIVE_QVAC=true`.
5. Set `QVAC_LINUX_HOST_CONFIRMED=true` only after confirming the host is native Linux x64, not WSL.
6. Run:

```bash
npm run proof:qvac -w @arcpay/agent
```

QVAC team response summary: Linux x64 binaries are tested and used in
production; WSL is currently untested and they have the issue present. So the
next honest route is a native Linux x64 proof, not more WSL retries.

If cloud access is blocked, use VMware Workstation with Ubuntu Server and follow
`docs/qvac-native-linux-vm.md`.

### Umbra, Cloak, Encrypt, And Ika

These are wallet/SDK execution tracks more than simple API-key tracks.

Umbra: official docs do not show a plain dashboard API key requirement in the
materials we have. Treat it as a wallet/SDK integration and prove it with the
supported SDK/network path once the exact pool/network support is confirmed.

Cloak: official devnet docs give a real live devnet shield-pool path. Use
`@cloak.dev/sdk-devnet`, the devnet relay, devnet program, and the Cloak mock
USDC faucet before switching to mainnet SDK/imports.

```bash
UMBRA_NETWORK=devnet
UMBRA_INDEXER_API_ENDPOINT=https://indexer.umbraprivacy.com
CLOAK_NETWORK=devnet
CLOAK_RELAY_URL=https://api.devnet.cloak.ag
CLOAK_PROGRAM_ID=Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h
CLOAK_MOCK_USDC_MINT=61ro7AExqfk4dZYoCyRzTahahCC2TdUUZ4M5epMPunJf
CLOAK_DEPOSIT_LAMPORTS=10000000
CLOAK_PROOF_TIMEOUT_MS=900000
CLOAK_VERBOSE_PROGRESS=true
CLOAK_DEVNET_PROOF_SIGNATURE=ce1H6WWLZdCRZaxJPxdBE1iQL2GX2euFrnQWp54vtqfcKNLhDpb3foaaVmRCr1Axj7Reugq7nVTWJmMaAbACc4Y
```

Run the empty-wallet proof first:

```bash
npm run proof:cloak -w @arcpay/agent
```

Expected before faucet funding: `needs_funds` with an insufficient SOL message.
After funding the signer with devnet SOL, the same command should submit a real
Cloak devnet deposit transaction.

Current accepted Cloak devnet proof:

- Transaction: `ce1H6WWLZdCRZaxJPxdBE1iQL2GX2euFrnQWp54vtqfcKNLhDpb3foaaVmRCr1Axj7Reugq7nVTWJmMaAbACc4Y`
- Explorer: `https://explorer.solana.com/tx/ce1H6WWLZdCRZaxJPxdBE1iQL2GX2euFrnQWp54vtqfcKNLhDpb3foaaVmRCr1Axj7Reugq7nVTWJmMaAbACc4Y?cluster=devnet`
- Program: `Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h`
- Signer: `DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm`

Encrypt/Ika: choose Ika as the active ArcPay target. Ika aligns better with the
track examples because ArcPay needs policy-controlled agentic signing and
bridgeless custody guardrails. Encrypt is lower priority because the current
pre-alpha docs state encryption is not real yet and plaintext is public, which
does not meet ArcPay's no-fake-privacy standard.

Keep the proof clearly labelled as Ika Solana pre-alpha/devnet and do not claim
production MPC custody or cross-chain custody unless the Ika team confirms that
flow.

```bash
ENCRYPT_GRPC_ENDPOINT=https://pre-alpha-dev-1.encrypt.ika-network.net:443
ENCRYPT_SOLANA_RPC_URL=https://api.devnet.solana.com
IKA_SOLANA_RPC_URL=https://api.devnet.solana.com
IKA_GRPC_ENDPOINT=https://pre-alpha-dev-1.ika.ika-network.net:443
IKA_PROGRAM_ID=87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY
IKA_DWALLET_ADDRESS=FgQLihMuxamuizS1ozufthE7UncuCYEcnJkrZV4hD1T5
IKA_APPROVE_SPEND_USD=5
IKA_APPROVE_MAX_SPEND_USD=8
IKA_APPROVE_EXPIRY_SECONDS=900
IKA_APPROVE_SUBMIT=false
IKA_APPROVE_TX_SIGNATURE=PViR5gcGyvPrHDRimqF5CMrDy7KCuBStXePMdkVB2XaLa1sqzbVoZg6W7tVvRbHtNUGdcrXXqiP6FNiNX7fNvrR
IKA_MESSAGE_APPROVAL_ADDRESS=7U7qWsf21JPMXoSrT2ktHBMrW9NjpxcDBuaxtsy3ZoVz
```

Run the current boundary proof:

```bash
npm run proof:ika -w @arcpay/agent
npm run proof:ika:grpc -w @arcpay/agent
npm run proof:ika:create-dwallet -w @arcpay/agent
npm run proof:ika:approve -w @arcpay/agent
```

These prove the official Ika pre-alpha Solana program, signer boundary, gRPC
service, dWallet creation, and ArcPay policy-gated `ApproveMessage` flow.

After creating or receiving a real Ika pre-alpha dWallet address, set
`IKA_DWALLET_ADDRESS` and run:

```bash
npm run proof:ika:approve -w @arcpay/agent
```

Default behavior signs the transaction locally but does not submit it. It checks:

- the dWallet account exists on Solana devnet;
- the dWallet account is owned by the official Ika program;
- ArcPay policy allows the requested spend;
- the official Ika `ApproveMessage` instruction and `MessageApproval` PDA can be built.

Set `IKA_APPROVE_SUBMIT=true` only after verifying the dWallet address and
message. The submitted transaction currently recorded for ArcPay is:
`PViR5gcGyvPrHDRimqF5CMrDy7KCuBStXePMdkVB2XaLa1sqzbVoZg6W7tVvRbHtNUGdcrXXqiP6FNiNX7fNvrR`.

### PUSD

Palm USD developer docs confirm:

- Solana SPL mint: `CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s`
- Decimals: `6`
- Freeze authority: none by live Solana RPC proof
- Mint authority from live RPC: `Gz87Mjd2dAaYtCsUWAkHrn3UQe6Haj1odthoPEDQarKo`
- Public API base: `https://www.palmusd.com/api`
- Read endpoints need no auth.

Set:

```bash
PUSD_MINT_ADDRESS=CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s
PUSD_RPC_URL=https://api.mainnet-beta.solana.com
PUSD_API_BASE_URL=https://www.palmusd.com/api
PUSD_EXPECTED_DECIMALS=6
```

Run:

```bash
npm run proof:pusd -w @arcpay/agent
```

This verifies Palm's public circulation API and the Solana SPL mint metadata.
It does not prove a PUSD payment. Final PUSD track proof still needs ArcPay to
receive or pay real PUSD, or a sponsor-accepted proof route.

### Supabase Auth

Use Supabase only for user accounts, profiles, and workspace settings. Do not
store private keys or raw seed phrases in Supabase.

1. Go to `https://supabase.com/dashboard/projects`.
2. Create a project named `arcpay`.
3. Open Project Settings -> API.
4. Copy the Project URL into:

```bash
NEXT_PUBLIC_SUPABASE_URL=
```

5. Copy the modern publishable key into:

```bash
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

If the dashboard only shows legacy JWT keys, copy the `anon public` key into:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

6. Open Authentication -> URL Configuration.
7. Set Site URL for local development:

```text
http://127.0.0.1:3000
```

8. Add redirect URLs:

```text
http://127.0.0.1:3000/reset-password
http://127.0.0.1:3000/dashboard
```

9. For deployment, add the production frontend URL to Site URL and Redirect URLs.

10. Apply the ArcPay policy table/RLS migration before testing server-side
policy persistence:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

The migration file is `supabase/migrations/202605110001_policy_settings.sql`.
If using the dashboard instead of CLI, paste that SQL into Supabase SQL Editor
and run it once.

11. If ArcPay later needs server-side admin actions, create and store
`SUPABASE_SERVICE_ROLE_KEY` only in server deployment secrets. Never expose it
with a `NEXT_PUBLIC_` prefix.

## Current External Blocks

No current sponsor-response block is active after the LP Agent key was added.

No other track is currently sponsor-response blocked. PUSD now has an official
mint/API proof path, QVAC is a native-Linux environment proof, Ika is an
implementation target, DFlow has a dev proof path, and final mainnet actions are
funding/proof tasks rather than external access blockers.
