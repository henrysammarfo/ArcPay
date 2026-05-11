# ArcPay Live Proof Checklist

This checklist replaces loose smoke-test claims with live proof requirements for
hackathon submission. Unit tests and deterministic demos are still useful
engineering checks, but they do not prove a partner track is complete.

Run command verification from WSL because Windows Node child-process spawning
currently fails with `spawn EPERM` for Vitest and Next.js.

## Completion Standard

A feature is complete only when at least one live proof artifact exists:

- Real provider API response from a production or documented sandbox endpoint.
- Real onchain transaction signature.
- Solana/EVM explorer link for the transaction or deployed account.
- Real wallet connection against the running dashboard.
- Real dashboard data sourced from SDK/server/live provider state.

The following do not count as final proof:

- Mock clients, injected fake SDK functions, placeholder IDs, or deterministic demo data.
- Development payment headers such as `x-arcpay-dev-payment: paid`.
- Unsigned transaction builders unless the track only requires quote/build proof.
- Static dashboard values.
- Devnet-only flows for tracks that require real mainnet value movement.

## Engineering Checks

These commands verify that the repository is healthy. They do not by themselves
make any partner track 100% complete.

Run from WSL:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
npm install
npm run build -w @arcpay/frontend
npm test -w @arcpay/cli
npm test -w @arcpay/sdk
npm test -w @arcpay/server
npm test -w @arcpay/agent
npm run smoke:kamino -w @arcpay/agent
npm run smoke:partners -w @arcpay/agent
npm run readiness:tracks -w @arcpay/agent
npm run smoke:torque -w @arcpay/agent
npm run proof:torque -w @arcpay/agent
npm run proof:cloak -w @arcpay/agent
npm run proof:ika -w @arcpay/agent
npm run proof:ika:grpc -w @arcpay/agent
npm run proof:ika:create-dwallet -w @arcpay/agent
npm run proof:ika:approve -w @arcpay/agent
npm run proof:qvac -w @arcpay/agent
npm run demo -w @arcpay/agent
```

Latest WSL verification:

- `@arcpay/frontend` production build passed with Next.js `14.2.35`.
- `@arcpay/frontend` tests passed: `5` tests.
- `@arcpay/cli` tests passed: `7` tests.
- `@arcpay/sdk` tests passed: `45` tests.
- `@arcpay/server` tests passed: `20` tests.
- `@arcpay/agent` tests passed: `59` tests.
- QuickNode configured RPC health check passed with `getHealth: ok`.
- Birdeye live read-only price access passed with the configured API key:
  SOL price `92.51651732649881`, update time `1778288071`.
- GoldRush live Solana balances access passed with the configured API key:
  `1` balance item returned.
- DFlow live dev order quote passed against `https://dev-quote-api.dflow.net`:
  `1000000` wrapped SOL units quoted to `92583` USDC units at slot `418486075`.
- DFlow signable order proof passed with a throwaway unfunded wallet:
  `1000000` wrapped SOL units quoted to `92378` USDC units at slot `418488652`,
  signed transaction size `951` bytes, not submitted.
- DFlow `.env` empty-wallet readiness passed with ignored throwaway wallet:
  `1000000` wrapped SOL units quoted to `91969` USDC units at slot `418499322`,
  signed transaction size `897` bytes, not submitted.
- DFlow live read-only smoke with the current `.env` passed:
  `1000000` wrapped SOL units quoted to `92532` USDC units at slot `418508363`.
- Latest DFlow signable order proof passed on 2026-05-10:
  `1000000` wrapped SOL units quoted to `96761` USDC units at slot `418881209`,
  signed transaction size `946` bytes, not submitted. The funded-submit script
  now reports `insufficient_funds` or `route_rejected` instead of hiding
  provider/RPC preflight failures.
- Cloak devnet proof reached the official Cloak devnet program with
  `@cloak.dev/sdk-devnet`: transaction
  `ce1H6WWLZdCRZaxJPxdBE1iQL2GX2euFrnQWp54vtqfcKNLhDpb3foaaVmRCr1Axj7Reugq7nVTWJmMaAbACc4Y`
  confirmed at slot `461123826` with `err: null` and Cloak program success logs.
- Ika pre-alpha boundary proof reached the official Ika Solana devnet program:
  program `87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY` exists and is executable.
- Ika gRPC proof reached `https://pre-alpha-dev-1.ika.ika-network.net:443`
  and queried presigns for signer `DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm`;
  the service returned `0` presigns. This proves service reachability, not final signing.
- Ika create-dWallet proof submitted the official pre-alpha DKG flow and found
  dWallet `FgQLihMuxamuizS1ozufthE7UncuCYEcnJkrZV4hD1T5`.
- Ika `ApproveMessage` proof submitted a real devnet transaction under ArcPay's
  `$8` spend policy: signature
  `PViR5gcGyvPrHDRimqF5CMrDy7KCuBStXePMdkVB2XaLa1sqzbVoZg6W7tVvRbHtNUGdcrXXqiP6FNiNX7fNvrR`,
  MessageApproval `7U7qWsf21JPMXoSrT2ktHBMrW9NjpxcDBuaxtsy3ZoVz`.
- PUSD proof passed against Palm's official API and Solana mainnet mint:
  mint `CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s`, decimals `6`,
  freeze authority `none`, Solana circulating `2895000`, snapshot
  `9f7d0f40-1381-4d56-beb6-13286709df38`.
- Kamino live unsigned transaction-builder access passed; latest fixed `.env`
  loader run validated an unsigned `0.01` USDC deposit transaction.
- Zerion API live read access passed: `chains` returned `64` live chains and `search USDC` returned live token data including Solana; direct Solana quote routing reached `/swap/quotes/`, the local fork patches Zerion's required Solana `to` parameter, and the patched quote returned live `insufficient_funds` for the configured wallet.
- `GET /live/treasury` returned live Solana devnet RPC data for the configured agent wallet.
- QuickNode live webhook proof passed from a real Solana devnet transfer.
- Torque live custom-event proof passed: `arcpay_wallet_connected` and
  `arcpay_paid_agent_request` were both accepted by Torque's ingester. Latest
  accepted ingestion IDs: `82a89c4c-6a6e-43fe-960f-63214e2dcd86` and
  `b8aacdc3-3678-4bd6-9742-56e0a6f73fb0`.
- QVAC adapter and proof runner build/test, but QVAC team confirmed WSL is
  currently untested. The next honest live proof is native Linux x64 with the
  canonical `npm i @qvac/sdk` install, `QVAC_SDK_PATH`, and
  `QVAC_LINUX_HOST_CONFIRMED=true`.
- Track-level eligibility and final submission blockers are tracked in
  `docs/track-submission-checklist.md`.

## Live Proof Matrix

| Track | Required Live Proof | Current Proof | Status |
| --- | --- | --- | --- |
| Solana Program | Devnet or mainnet transaction signatures for `initialize_treasury`, `shield_deposit`, and `execute_payment`; explorer links; policy failure proof. | Real devnet `initialize_treasury` signature `CzkakgwFZztw8tbgBUxmGPuVwgir7YFjhMch4xMMWVwBrpGqq4yC2daSNZ4x75MPgs479gHKozKf94aNbKdAzqy`; real devnet `shield_deposit` signature `6vztJ67fDbJUneN83gUHDNX5cbm3QN7rJ4aEAjh8TM3K33VoUPWVSV54uYAN6TMvXFPSCPNdwLbJorEXB1AiUMz`; real devnet `execute_payment` signature `2nwbbTpQx837YQZfaTn3rpbzJU5bUdVSgaPDZ7PQj7vqxgxS77i4T8LYYB3iRbvJLCWDnNUGADsvxvdDP2X3HkwU`; real devnet policy failure signature `2yoXiLQQ8CGoXSWjFU48TLSKEr1ZPSmaPJnp9xg3KPPkXUJENFvHuK8DrFZNY7RyLV7shKsZEHQhJruZFh4997jB`; treasury `51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH` decoded matching policy. | Complete for devnet program proof. |
| x402 / MagicBlock | Real paid request using a verified Solana payment transaction; MagicBlock Private Payments API surface; 402 without payment; 200 after verifier accepts payment. | Real devnet SPL transfer `2DmD554raX8Z3f5rP2Dmbby9M2UtkUUhpswy7Lcmbqrt5GQ3RodN1aTue9z8gnUvcC28EBmt2SdhdGT6f5rTvwqB` was accepted by the production-mode Solana verifier; `/agent/research` returned `liveProof: true` and `proofType: solana-verified`. `proof:magicblock` reached `https://payments.magicblock.app`, passed health, returned a 1098-byte `transactionBase64` from `/v1/spl/deposit`, signed the signer-owned deposit tx, and reached the expected SPL `insufficient funds` simulation error on an empty token wallet. | Complete for MagicBlock API-builder + signed empty-wallet proof; funded MagicBlock deposit settlement still needs devnet token balance. |
| QuickNode | Real QuickNode Solana RPC endpoint and webhook event firing from a live transaction. | Real devnet transfer `4P1G6AR7CVC3cjrHi8TqYJdZ7QYtmSf7JArtBJ5Z6EjMX2h1V3k1fPD5MpHyG9pXNRcyXGZSCtyoty29TUDP72LC` triggered a QuickNode POST accepted by ArcPay; `/live/quicknode` returned `liveProof: true`. | Complete for devnet live webhook proof. |
| Umbra | Real shield/deposit transaction using funded signer, configured RPC/WSS/indexer, and explorer proof where available. | Production adapter typed/tested with injected SDK functions. | Not complete. |
| Cloak | Real private send/batch transaction; owner audit/viewing proof if supported; explorer or provider proof. | Official Cloak devnet SDK submitted a real devnet transaction to program `Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h`: signature `ce1H6WWLZdCRZaxJPxdBE1iQL2GX2euFrnQWp54vtqfcKNLhDpb3foaaVmRCr1Axj7Reugq7nVTWJmMaAbACc4Y`, slot `461123826`, `err: null`, signer `DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm`. | Complete for Cloak devnet SOL deposit proof; mainnet private payroll/batch/viewing-key proof still pending. |
| Encrypt / Ika | Real use of Ika dWallet or Encrypt infrastructure; pre-alpha/devnet labelled honestly; ArcPay policy gates the signature or confidential action. | Ika pre-alpha boundary proof passed; gRPC proof reached the official service; `proof:ika:create-dwallet` created dWallet `FgQLihMuxamuizS1ozufthE7UncuCYEcnJkrZV4hD1T5`; `proof:ika:approve` submitted ArcPay policy-gated `ApproveMessage` tx `PViR5gcGyvPrHDRimqF5CMrDy7KCuBStXePMdkVB2XaLa1sqzbVoZg6W7tVvRbHtNUGdcrXXqiP6FNiNX7fNvrR`, MessageApproval `7U7qWsf21JPMXoSrT2ktHBMrW9NjpxcDBuaxtsy3ZoVz`. | Complete for Ika pre-alpha dWallet + policy approval proof; must label no production MPC/cross-chain custody. |
| Kamino | Real signed deposit and withdraw transaction on mainnet; explorer links; resulting position proof. | Live unsigned USDC deposit transaction builder response passed. | Not complete until signed/submitted. |
| Meteora / LP Agent | Real LP Agent API response and Zap In or Zap Out used inside ArcPay; final proof should include a signed transaction or resulting position proof if funds enter liquidity. | SDK uses the official `/open-api/v1` + `x-api-key` REST boundary. `smoke:partners` can validate pool info, owner positions, or unsigned Zap-In transaction generation. | Read-only proof is partial only. Track completion requires live Zap-In or Zap-Out proof. |
| Birdeye | Real API response for selected token price/rate used in decision or dashboard. | Live price smoke passed with configured key: SOL price `92.51651732649881`, update time `1778288071`. | Read-only API proof complete; dashboard integration still pending. |
| DFlow | Real API order/quote plus signed and submitted swap/intent transaction routed through DFlow; tx signature. | Live dev order quote passed; latest signable order proof quoted `1000000` wrapped SOL units to `94025` USDC units at slot `418795033`, signed transaction size `521` bytes, not submitted. REST order/quote/intent boundary typed/tested. | Signable transaction proof complete; not complete until submitted swap or intent proof. |
| QVAC | Real local QVAC runtime decision output or documented live model/API response used by the demo. | SDK has a live `@qvac/sdk` local adapter and `proof:qvac` runner that validates strict JSON decisions. QVAC team confirmed Linux x64 binaries are tested and WSL is untested. | Not complete until `proof:qvac` returns a live decision on native Linux x64. |
| GoldRush | Real API response for Solana counterparty balances and, if available, transaction/history risk data; decision result recorded. | Live Solana balances access passed with configured key: `1` balance item returned. | Partially complete; transaction-history scoring unverified. |
| Torque | Real Torque MCP/API activity: `custom_events`, incentive trigger, or distributor proof; project/campaign ID; friction log; demo post on X tagging `@torqueprotocol`. | Real Torque custom events accepted by `POST https://ingest.torque.so/events`: latest `arcpay_wallet_connected` ingestion `82a89c4c-6a6e-43fe-960f-63214e2dcd86`; latest `arcpay_paid_agent_request` ingestion `b8aacdc3-3678-4bd6-9742-56e0a6f73fb0`; paid event uses verified Solana x402 transaction `2DmD554raX8Z3f5rP2Dmbby9M2UtkUUhpswy7Lcmbqrt5GQ3RodN1aTue9z8gnUvcC28EBmt2SdhdGT6f5rTvwqB`. | Live custom-event proof complete; submission still needs friction log and demo/X post. |
| PUSD | Real PUSD mint/address validation and receive/pay flow proof. | `proof:pusd` passed: Palm API reports Solana circulation `2895000` as of `2026-04-24T14:30:00Z`; Solana mainnet mint `CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s` has 6 decimals and no freeze authority. | Mint/API proof complete; not complete until real PUSD receive/pay flow or sponsor-accepted proof. |
| Solflare / Phantom | Manual wallet connect on `localhost:3000/dashboard`; screenshot or demo clip; wallet address visible. | Phantom wallet connected in the browser; dashboard rendered live Solana RPC treasury data from `/live/treasury` with `7.666334682 SOL`, `6` parsed token accounts, and `RPC verified`. | Complete for live dashboard and wallet-connection proof; production x402 settlement remains separate. |
| Zerion CLI | Forked Zerion CLI repo; scoped policy implementation; real swap/bridge/rebalance routed through Zerion API; tx signature. | Official repo identified; `arcpay zerion status` checks external CLI/key readiness; `arcpay zerion policy` validates scoped chain/spend/expiry/blocklist policy inputs without executing funds; fork patch plan is documented in `docs/zerion-fork.md`; live Zerion API read proof passed for `chains` and `search USDC`; direct Solana quote command reached `/swap/quotes/`, required `to` handling is patched in the local fork, targeted tests pass, and Zerion now returns live `insufficient_funds` for the configured wallet. | Not complete until forked CLI executes a real Zerion-routed transaction. |
| AUDD Grant | Real AUDD receive/payment or verified AUDD mint/rate flow with explorer/API proof. | AUDD mint/env exists; x402 route supports AUDD configuration. | Not complete. |
| Agentic Engineering | Demo showing agent decision leading to a real onchain action under policy. | Agent demo now defaults to live-proof mode and skips development adapter claims unless explicitly enabled for local testing. | Not complete. |
| Raenest Nigeria | Real integration, pilot/onboarding artifact, or documented partner workflow. | Ada persona and Nigeria agency narrative exist. | Not complete. |
| 100xDevs | Public repo, reproducible setup, clear demo, and real transaction evidence. | Codebase exists locally. | Not complete until public repo/demo proof. |

## Funds And Credentials Needed

Do not paste private keys into chat, source files, or docs. Use wallet signing,
environment variables, or provider dashboards.

| Need | Used For | Required To Finish |
| --- | --- | --- |
| Small funded mainnet wallet | Zerion, Kamino, Cloak/Umbra, DFlow, x402 real settlement | Any real value-moving transaction |
| `ZERION_API_KEY` | Zerion CLI swaps/routes/agent token; install `zerion-cli@1.1.0` for current route-selection flags | Zerion hackathon track |
| QuickNode Solana endpoint | RPC reliability and webhook proof | QuickNode track and production RPC |
| QuickNode webhook config | Payment-received event proof | QuickNode track |
| `DFLOW_API_KEY` | Production DFlow quote/swap proof; no-key dev order proof can use `DFLOW_API_BASE_URL=https://dev-quote-api.dflow.net` | DFlow track |
| Torque project access, API key or MCP config, and incentive/campaign/event IDs | Live `custom_events`, incentive trigger, or distributor proof | Torque track |
| `LP_AGENT_API_KEY` | Meteora LP Agent proof | LP Agent track |
| `LP_AGENT_POOL_ID` or `LP_AGENT_OWNER_ADDRESS` | LP Agent live read proof | Partial engineering verification only |
| `LP_AGENT_ZAP_IN_POOL_ID`, `LP_AGENT_ZAP_IN_WALLET_ADDRESS`, and `LP_AGENT_ZAP_IN_INPUT_SOL` | LP Agent Zap-In transaction generation proof | LP Agent track |
| QVAC runtime/API access | Live AI decision proof | QVAC track |
| AUDD mint/liquidity path | AUDD payment/rate proof | AUDD grant |
| PUSD mint/liquidity path | PUSD receive/pay proof | PUSD track |

## Real Partner Smoke Commands

### QVAC Local Runtime Proof

Run this from native Linux x64, not WSL. QVAC team confirmed linux-x64 binaries
are tested and WSL is currently untested. If `@qvac/sdk` is installed outside
the ArcPay workspace, point `QVAC_SDK_PATH` at that package directory.

The full install/verify/proof flow is scripted:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
bash scripts/qvac-runtime-proof.sh
```

Manual proof command after a successful runtime install:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export ARCPAY_REQUIRE_LIVE_QVAC=true
export QVAC_SDK_PATH="$HOME/arcpay-qvac-runtime/node_modules/@qvac/sdk"
export QVAC_LINUX_HOST_CONFIRMED=true
export QVAC_MODEL_CONFIG_JSON='{"ctx_size":"2048","device":"cpu"}'
export QVAC_PROOF_TIMEOUT_MS=120000
npm run proof:qvac -w @arcpay/agent
```

If package installation exits non-zero, capture the final npm error without
Bash history expansion:

```bash
cd ~/arcpay-qvac-runtime
set +H
LATEST_LOG="$(ls -t ~/.npm/_logs/*debug-0.log | head -1)"
tail -200 "$LATEST_LOG"
grep -iE "error|err|eio|enoent|eacces|killed|fatal|exit|code" "$LATEST_LOG" | tail -120
cat node_modules/@qvac/sdk/package.json | head -80
find node_modules/@qvac/sdk -maxdepth 2 -type f | head -40
```

### Birdeye And GoldRush Read-Only Proof

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export BIRDEYE_API_KEY="your_birdeye_key"
export BIRDEYE_PRICE_MINT_ADDRESS="So11111111111111111111111111111111111111112"
export GOLDRUSH_API_KEY="your_goldrush_key"
export GOLDRUSH_SCORE_WALLET="wallet_to_score"
export ARCPAY_REQUIRE_LIVE_PARTNERS=true
npm run smoke:partners -w @arcpay/agent
```

This proves read-only provider access only. It does not prove settlement.

For the GoldRush track proof, run the policy proof:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export GOLDRUSH_API_KEY="your_goldrush_key"
export GOLDRUSH_SCORE_WALLET="wallet_to_score"
export GOLDRUSH_MIN_SCORE="70"
npm run proof:goldrush -w @arcpay/agent
```

Latest live result:

```text
PASSED GoldRush risk proof:
  Wallet: 2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz
  Score: 20
  Transactions sampled: 0
  GoldRush recommendation: REJECT
  ArcPay minimum score: 70
  ArcPay policy decision: BLOCK
```

GoldRush returned HTTP 501 for Solana transaction history during live testing,
so ArcPay treats only that unsupported endpoint as unavailable and still
requires the live GoldRush Solana balances endpoint for the risk proof.

### DFlow Dev Order Proof

The DFlow docs expose a no-key dev endpoint and production endpoints that use
`x-api-key`. This command proves ArcPay can request a live DFlow order quote
without claiming swap settlement.

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export DFLOW_API_BASE_URL="https://dev-quote-api.dflow.net"
export DFLOW_INPUT_MINT_ADDRESS="So11111111111111111111111111111111111111112"
export DFLOW_OUTPUT_MINT_ADDRESS="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
export DFLOW_QUOTE_AMOUNT="1000000"
export ARCPAY_REQUIRE_LIVE_DFLOW=true
npm run smoke:partners -w @arcpay/agent
```

For production, set `DFLOW_API_BASE_URL=https://quote-api.dflow.net` and
`DFLOW_API_KEY` if DFlow issues one. Final DFlow track proof still requires an
authorized wallet to sign and submit the returned transaction or intent flow.

### DFlow Signable Order / Submission Proof

This fetches a DFlow order with `userPublicKey`, signs the returned transaction
locally, and does not submit unless `ARCPAY_DFLOW_SUBMIT=true`.

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export QUICKNODE_RPC_URL="https://api.mainnet-beta.solana.com"
export SOLANA_NETWORK="mainnet-beta"
export ARCPAY_SIGNER_KEYPAIR_PATH="$HOME/.config/solana/id.json"
export DFLOW_API_BASE_URL="https://dev-quote-api.dflow.net"
export DFLOW_INPUT_MINT_ADDRESS="So11111111111111111111111111111111111111112"
export DFLOW_OUTPUT_MINT_ADDRESS="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
export DFLOW_QUOTE_AMOUNT="1000000"
export DFLOW_SLIPPAGE_BPS=50
export ARCPAY_DFLOW_SUBMIT=false
npm run proof:dflow -w @arcpay/agent
```

If the wallet is funded and you intend to submit the DFlow transaction, set:

```bash
export ARCPAY_DFLOW_SUBMIT=true
npm run proof:dflow -w @arcpay/agent
```

Completion proof requires the output to include `status: "submitted"`,
`transactionSignature`, and an explorer link. `status: "ready"` proves that
ArcPay fetched and signed a DFlow transaction, but not that the swap settled.

### LP Agent / Meteora Zap-In Proof

Latest local live result:

```text
PASSED LP Agent: Validated LP Agent Zap-In transaction generation for 8EZqMc266xTtnS3uxstp8DdNU95fWKQ7mYyAZULSc6We with 1 unsigned transactions.
```

The key was also verified against the current documented positions endpoint:
`GET /open-api/v1/lp-positions/opening?owner=...` returned HTTP 200 with
`status: success` and `count: 0`.

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export LP_AGENT_API_KEY="lp_real_key_here"
export LP_AGENT_API_BASE_URL="https://api.lpagent.io/open-api/v1"
export LP_AGENT_ZAP_IN_POOL_ID="pool_id_from_lpagent_or_meteora"
export LP_AGENT_ZAP_IN_WALLET_ADDRESS="wallet_public_key"
export LP_AGENT_ZAP_IN_INPUT_SOL="0.01"
export LP_AGENT_ZAP_IN_PERCENT_X="0.5"
export LP_AGENT_ZAP_IN_SLIPPAGE_BPS=50
export ARCPAY_REQUIRE_LIVE_LP_AGENT=true
npm run smoke:partners -w @arcpay/agent
```

This proves LP Agent can generate an unsigned Zap-In transaction. Final proof
requires wallet signing/submission or a resulting LP position proof, depending
on the track's accepted proof standard.

### Torque Custom Event Proof

Create both custom events in the Torque dashboard first:
`arcpay_wallet_connected` and `arcpay_paid_agent_request`.

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export TORQUE_API_KEY="tq_real_event_key_here"
export TORQUE_EVENT_API_URL="https://ingest.torque.so/events"
export TORQUE_USER_PUBKEY="wallet_that_connected_to_arcpay"
export TORQUE_AGENT_ID="ada-research-agent-01"
export TORQUE_PAYMENT_TX_SIGNATURE="verified_solana_payment_signature"
export TORQUE_PAYMENT_AMOUNT_USD="0.01"
export ARCPAY_REQUIRE_LIVE_TORQUE=true
npm run proof:torque -w @arcpay/agent
```

Use `smoke:torque` only when you need to submit one custom event manually.
`proof:torque` submits the ArcPay dashboard wallet event and the x402 paid
agent request event in one run.

The Torque key must be an Event API key from the Torque Developer page. The
custom event definition must exist in the ArcPay Torque project before this
command can count as live proof.

Accepted ArcPay Torque proof:

- `arcpay_wallet_connected`: accepted at `2026-05-08T04:21:28.899Z`.
- `arcpay_paid_agent_request`: accepted at `2026-05-08T04:21:29.353Z`.
- Paid request proof transaction:
  `2DmD554raX8Z3f5rP2Dmbby9M2UtkUUhpswy7Lcmbqrt5GQ3RodN1aTue9z8gnUvcC28EBmt2SdhdGT6f5rTvwqB`.

Torque submission checklist:

- Record the Torque dashboard Event Log showing both accepted events.
- Include a short friction log in the final README or submission notes.
- Record a demo segment showing ArcPay submitting or displaying the Torque
  custom events.
- Post the demo on X tagging `@torqueprotocol`.

Torque friction log draft:

- What worked: the Developer page made it straightforward to create Event API
  keys and define the two ArcPay custom events.
- What broke: the earlier endpoint assumption returned `404`; the official MCP
  package showed the correct ingestion route as `POST https://ingest.torque.so/events`
  with `x-api-key`.
- What was confusing: the Event API key is separate from general API access,
  and live proof only becomes visible after the event definition exists in the
  project dashboard.
- Improvement request: surface the exact ingestion URL, required header, and
  example payload directly beside each custom event definition in the Torque
  dashboard.

### LP Agent / Meteora Read-Only Proof

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export LP_AGENT_API_KEY="lp_real_key_here"
export LP_AGENT_API_BASE_URL="https://api.lpagent.io/open-api/v1"
export LP_AGENT_POOL_ID="pool_id_from_lpagent_or_meteora"
# or prove owner positions instead:
# export LP_AGENT_OWNER_ADDRESS="owner_wallet_address"
export ARCPAY_REQUIRE_LIVE_LP_AGENT=true
npm run smoke:partners -w @arcpay/agent
```

This proves live LP Agent API access only. It does not satisfy the LP Agent
track by itself because the official requirement asks for Zap In or Zap Out.
ArcPay uses the current documented positions endpoint, `GET /lp-positions/opening`.

### Kamino Transaction Builder Proof

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export SOLANA_NETWORK="mainnet-beta"
export AGENT_WALLET_ADDRESS="your_mainnet_wallet_public_key"
export USDC_MINT_ADDRESS="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
export KAMINO_MARKET_ADDRESS="7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF"
export KAMINO_USDC_RESERVE_ADDRESS="D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59"
export KAMINO_DEPOSIT_AMOUNT="0.01"
export ARCPAY_REQUIRE_LIVE_KAMINO=true
npm run smoke:kamino -w @arcpay/agent
```

This proves transaction building only. Final Kamino proof requires signing and
submitting the transaction with a funded wallet.

### Zerion Companion CLI Readiness

Fork-specific patch notes and final proof commands are tracked in
`docs/zerion-fork.md`. Zerion team guidance from May 6, 2026 says CLI fork
changes are allowed if swap/bridge commands are not broken, `zerion-cli@1.0.1`
is the expected Solana-swap version, and WSL should be used while Windows native
package installation is being fixed.

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
npm install -g zerion-cli
export ZERION_API_KEY="zk_..."
zerion --version
npm run build -w @arcpay/cli
npm test -w @arcpay/cli
npx arcpay zerion status
npx arcpay zerion policy \
  --chain solana \
  --wallet your_mainnet_wallet \
  --max-spend-usd 4 \
  --expires-at 2026-05-11T23:59:59.000Z \
  --route swap \
  --allowed-asset USDC \
  --allowed-asset SOL \
  --blocked-action bridge
```

This proves local readiness only. Final Zerion proof requires a forked Zerion CLI
command that enforces policy and executes a real Zerion-routed transaction.

### QuickNode Webhook Proof

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay/packages/server
export QUICKNODE_WEBHOOK_SECRET="change_this_shared_secret"
npm run dev
```

Expose the local server with a tunnel, then configure QuickNode to POST Solana
events to:

```text
https://your-public-url/webhooks/quicknode
```

Copy the QuickNode dashboard **Security Token** and restart the server with:

```bash
export QUICKNODE_WEBHOOK_SECRET="quicknode_security_token_here"
```

ArcPay validates QuickNode signed webhook headers with this token. The
`x-arcpay-webhook-secret` header is only for local curl tests.

Check status:

```bash
curl -s http://localhost:4030/live/quicknode
```

This is complete only when `/live/quicknode` returns `liveProof: true` from a
real QuickNode POST.

### x402 Solana Payment Proof

This starts the x402 server in production mode, sends a real devnet SPL token
payment, and calls the protected endpoint with the resulting transaction
signature in the `x-payment` header. The current proof uses the ArcPay devnet
test SPL mint, not mainnet USDC.

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
bash .tmp/run-x402-payment-proof-devnet.sh
```

Manual equivalent:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export QUICKNODE_RPC_URL="https://api.devnet.solana.com"
export SOLANA_NETWORK="devnet"
export ARCPAY_PAYMENT_MODE="production"
export ARCPAY_PROGRAM_ID="GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz"
export AGENT_WALLET_ADDRESS="2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz"
export USDC_MINT_ADDRESS="HRyoekCs5hErv5wYpawrj5MdK3s4Y7DBFZLotTAt41Nj"
export AUDD_MINT_ADDRESS="HRyoekCs5hErv5wYpawrj5MdK3s4Y7DBFZLotTAt41Nj"
export X402_SERVER_PORT="4031"
export ARCPAY_REPLAY_STORE_PATH="/tmp/arcpay-x402-proof-replays.json"
export ARCPAY_SIGNER_KEYPAIR_PATH="$HOME/.config/solana/id.json"
export ARCPAY_X402_SERVER_URL="http://localhost:4031"
export ARCPAY_X402_ENDPOINT_PATH="/agent/research"
export ARCPAY_X402_PAYMENT_AMOUNT="0.01"
npm run dev -w @arcpay/server
```

In a second WSL terminal:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export QUICKNODE_RPC_URL="https://api.devnet.solana.com"
export AGENT_WALLET_ADDRESS="2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz"
export USDC_MINT_ADDRESS="HRyoekCs5hErv5wYpawrj5MdK3s4Y7DBFZLotTAt41Nj"
export ARCPAY_SIGNER_KEYPAIR_PATH="$HOME/.config/solana/id.json"
export ARCPAY_X402_SERVER_URL="http://localhost:4031"
npm run proof:x402:payment -w @arcpay/agent
```

Completion proof requires the command output to include:

- `paymentSignature`
- `explorerTransactionUrl`
- `endpointResponse.liveProof: true`
- `endpointResponse.paymentProof.mode: production`
- `endpointResponse.paymentProof.proofType: solana-verified`

### Solana Program `initialize_treasury` Proof

This submits a real devnet transaction to the deployed ArcPay Anchor program
using the Solana CLI keypair. It does not print or store the private key.

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export QUICKNODE_RPC_URL="https://api.devnet.solana.com"
export SOLANA_NETWORK="devnet"
export ARCPAY_PROGRAM_ID="GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz"
export ARCPAY_SIGNER_KEYPAIR_PATH="$HOME/.config/solana/id.json"
export ARCPAY_PROOF_AGENT_ID="ada-research-agent-live-$(date +%s)"
export ARCPAY_PROOF_DAILY_LIMIT="5000"
export ARCPAY_PROOF_MAX_SINGLE_TX="1000"
export ARCPAY_PROOF_MIN_GOLDRUSH_SCORE="70"
npm run proof:program:init -w @arcpay/agent
```

Completion proof requires the command output to include:

- `initializeSignature`
- `treasuryAddress`
- `explorerTransactionUrl`
- `explorerTreasuryUrl`
- on-chain decoded policy matching the configured limits

### Solana Program `shield_deposit` Proof

This submits a real devnet `shield_deposit` transaction for an initialized
ArcPay treasury. It records a privacy reference on-chain; it does not move SPL
tokens.

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export QUICKNODE_RPC_URL="https://api.devnet.solana.com"
export SOLANA_NETWORK="devnet"
export ARCPAY_PROGRAM_ID="GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz"
export ARCPAY_SIGNER_KEYPAIR_PATH="$HOME/.config/solana/id.json"
export ARCPAY_TREASURY_ADDRESS="51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH"
export ARCPAY_PROOF_MINT_ADDRESS="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
export ARCPAY_PROOF_SHIELD_AMOUNT="1000"
export ARCPAY_PROOF_SHIELD_REF="umbra-live-proof-$(date +%s)"
npm run proof:program:shield -w @arcpay/agent
```

Completion proof requires the command output to include:

- `shieldSignature`
- `treasuryAddress`
- `explorerTransactionUrl`
- `shield.amount`
- `shield.mint`
- `shield.shieldRef`

### Solana Program `execute_payment` Proof

This submits a real devnet `execute_payment` transaction for an initialized
ArcPay treasury. The proof requires funded devnet SPL token accounts controlled
by the treasury owner.

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export QUICKNODE_RPC_URL="https://api.devnet.solana.com"
export SOLANA_NETWORK="devnet"
export ARCPAY_PROGRAM_ID="GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz"
export ARCPAY_SIGNER_KEYPAIR_PATH="$HOME/.config/solana/id.json"
export ARCPAY_TREASURY_ADDRESS="51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH"
export ARCPAY_TREASURY_TOKEN_ACCOUNT="HHz3XNE36rU5PTMX2XPUDMnZraNvPst5aSxzrT2k8kcu"
export ARCPAY_RECIPIENT_TOKEN_ACCOUNT="FnfdqfAuCeVgzR2zJb15mdG6GTRw16N8SwbCsuQCNW94"
export ARCPAY_PROOF_PAYMENT_AMOUNT="250"
export ARCPAY_PROOF_PAYMENT_GOLDRUSH_SCORE="91"
export ARCPAY_PROOF_PAYMENT_REF="execute-payment-live-proof-20260505-1405"
npm run proof:program:payment -w @arcpay/agent
```

Completion proof requires the command output to include:

- `paymentSignature`
- `treasuryAddress`
- `explorerTransactionUrl`
- `payment.amount`
- `payment.goldRushScore`
- `payment.paymentRef`
- `payment.treasuryTokenAccount`
- `payment.recipientTokenAccount`

### Solana Program Policy Rejection Proof

This submits an intentionally invalid devnet `execute_payment` transaction with
`skipPreflight` so Solana records the deployed program rejecting it. The default
proof attempts `maxSingleTx + 1` and expects `ExceedsSingleTxLimit`.

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export QUICKNODE_RPC_URL="https://api.devnet.solana.com"
export SOLANA_NETWORK="devnet"
export ARCPAY_PROGRAM_ID="GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz"
export ARCPAY_SIGNER_KEYPAIR_PATH="$HOME/.config/solana/id.json"
export ARCPAY_TREASURY_ADDRESS="51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH"
export ARCPAY_TREASURY_TOKEN_ACCOUNT="HHz3XNE36rU5PTMX2XPUDMnZraNvPst5aSxzrT2k8kcu"
export ARCPAY_RECIPIENT_TOKEN_ACCOUNT="FnfdqfAuCeVgzR2zJb15mdG6GTRw16N8SwbCsuQCNW94"
export ARCPAY_PROOF_POLICY_REF="execute-payment-policy-failure-proof-20260505-1521"
npm run proof:program:policy -w @arcpay/agent
```

Completion proof requires the command output to include:

- `policyFailureSignature`
- `explorerTransactionUrl`
- `expectedPolicy.maxSingleTx`
- `expectedPolicy.attemptedAmount`
- `recordedError`
- log output containing `ExceedsSingleTxLimit`

## Dashboard Live Proof

Frontend proof requires all of the following:

- Solflare or Phantom connects on `http://localhost:3000/dashboard`.
- The connected wallet address is visible.
- Aggregate treasury data comes from SDK/server/live source, not static values.
- Private per-agent balances are not exposed.
- The demo recording shows the dashboard after at least one live transaction or API update.

Engineering verification:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
npm run build -w @arcpay/frontend
npm test -w @arcpay/frontend
```

Run:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export NEXT_PUBLIC_QUICKNODE_RPC_URL="https://api.devnet.solana.com"
export NEXT_PUBLIC_ARCPAY_SERVER_URL="http://localhost:4030"
npm run dev -w @arcpay/frontend
```

In a second WSL terminal, run the server with real devnet configuration:

```bash
cd /mnt/c/Users/RICHEY_SON/Desktop/ArcPay
export QUICKNODE_RPC_URL="https://api.devnet.solana.com"
export SOLANA_NETWORK="devnet"
export ARCPAY_PROGRAM_ID="GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz"
export AGENT_WALLET_ADDRESS="2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz"
export AUDD_MINT_ADDRESS="HJiQv34JpPDZHt9g5yCRpFqMTCBhSMuSudYCABiXGBEX"
export USDC_MINT_ADDRESS="HRyoekCs5hErv5wYpawrj5MdK3s4Y7DBFZLotTAt41Nj"
export X402_SERVER_PORT="4030"
npm run dev -w @arcpay/server
```

Open `http://localhost:3000/dashboard`, connect Solflare or Phantom, and record the
visible connected wallet plus live treasury cards. The current proof captures a
Phantom connection and live devnet treasury cards. It does not prove production
x402 payment settlement.

## Recording Rule

The final video must label each action honestly:

- Say "live API response" only when a real provider returned data.
- Say "real transaction" only when a signed transaction was submitted and has a signature.
- Say "devnet transaction" only for Solana devnet explorer links.
- Do not say "private settlement complete" for typed adapters or mock tests.
- Do not say "yield deposited" for unsigned Kamino transaction builders.
- Do not claim Zerion completion until a forked CLI executes a real Zerion-routed transaction.

## Evidence Log Template

Use this format for each completed track:

```text
Track:
Date:
Network:
Wallet:
Provider/API:
Command:
Transaction signature or response ID:
Explorer/provider link:
What this proves:
What it does not prove:
```

## Evidence Log

Track: QuickNode
Date: 2026-05-05
Network: Solana devnet
Wallet: `2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz`
Provider/API: QuickNode Solana Devnet webhook
Command: `solana transfer 2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz 0.000001 --url devnet`
Transaction signature or response ID: `4P1G6AR7CVC3cjrHi8TqYJdZ7QYtmSf7JArtBJ5Z6EjMX2h1V3k1fPD5MpHyG9pXNRcyXGZSCtyoty29TUDP72LC`
Explorer/provider link: `https://explorer.solana.com/tx/4P1G6AR7CVC3cjrHi8TqYJdZ7QYtmSf7JArtBJ5Z6EjMX2h1V3k1fPD5MpHyG9pXNRcyXGZSCtyoty29TUDP72LC?cluster=devnet`
What this proves: A real devnet transaction involving the watched wallet triggered QuickNode, QuickNode delivered a signed webhook, ArcPay returned `202 Accepted`, and `/live/quicknode` reported `liveProof: true`.
What it does not prove: Mainnet payment settlement or x402 paid request settlement.

Track: x402 / MagicBlock
Date: 2026-05-05
Network: Solana devnet
Wallet: `2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz`
Provider/API: ArcPay x402 server production-mode Solana verifier
Command: `bash .tmp/run-x402-payment-proof-devnet.sh`
Transaction signature or response ID: `2DmD554raX8Z3f5rP2Dmbby9M2UtkUUhpswy7Lcmbqrt5GQ3RodN1aTue9z8gnUvcC28EBmt2SdhdGT6f5rTvwqB`
Explorer/provider link: `https://explorer.solana.com/tx/2DmD554raX8Z3f5rP2Dmbby9M2UtkUUhpswy7Lcmbqrt5GQ3RodN1aTue9z8gnUvcC28EBmt2SdhdGT6f5rTvwqB?cluster=devnet`
What this proves: A real devnet SPL token transfer to the configured agent wallet was verified by the production-mode x402 Solana verifier, and `/agent/research` returned `liveProof: true` with `proofType: solana-verified`.
What it does not prove: Mainnet USDC/AUDD settlement, MagicBlock facilitator settlement, or partner API settlement.

Track: MagicBlock Private Payments
Date: 2026-05-10
Network: Solana devnet
Wallet: `DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm`
Provider/API: `https://payments.magicblock.app/health` and `POST /v1/spl/deposit`
Command: `MAGICBLOCK_SUBMIT_DEPOSIT=true npm run proof:magicblock -w @arcpay/agent`
Transaction signature or response ID: Builder returned a 1098-byte signer-owned legacy transaction; submit simulation reached SPL Token `insufficient funds`.
Explorer/provider link: Not available because the empty token wallet correctly failed preflight before broadcast.
What this proves: ArcPay reaches MagicBlock's Private Payments API, builds a real SPL deposit transaction for the local signer, signs it locally, and reaches the expected on-chain insufficient-funds boundary with an unfunded token account.
What it does not prove: A funded MagicBlock deposit settlement, mainnet settlement, ER/PER app deployment, or token balance ownership.

Track: Solana Program
Date: 2026-05-05
Network: Solana devnet
Wallet: `2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz`
Provider/API: ArcPay Anchor program
Command: `npm run proof:program:init -w @arcpay/agent`
Transaction signature or response ID: `CzkakgwFZztw8tbgBUxmGPuVwgir7YFjhMch4xMMWVwBrpGqq4yC2daSNZ4x75MPgs479gHKozKf94aNbKdAzqy`
Explorer/provider link: `https://explorer.solana.com/tx/CzkakgwFZztw8tbgBUxmGPuVwgir7YFjhMch4xMMWVwBrpGqq4yC2daSNZ4x75MPgs479gHKozKf94aNbKdAzqy?cluster=devnet`
Treasury account: `51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH`
Treasury explorer link: `https://explorer.solana.com/address/51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH?cluster=devnet`
What this proves: The deployed ArcPay program accepted a real `initialize_treasury` transaction and the SDK decoded the on-chain policy as `dailyLimit=5000`, `maxSingleTx=1000`, `minGoldRushScore=70`.
What it does not prove: `shield_deposit`, `execute_payment`, token transfer settlement, or policy rejection paths.

Track: Solana Program
Date: 2026-05-05
Network: Solana devnet
Wallet: `2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz`
Provider/API: ArcPay Anchor program
Command: `npm run proof:program:shield -w @arcpay/agent`
Transaction signature or response ID: `6vztJ67fDbJUneN83gUHDNX5cbm3QN7rJ4aEAjh8TM3K33VoUPWVSV54uYAN6TMvXFPSCPNdwLbJorEXB1AiUMz`
Explorer/provider link: `https://explorer.solana.com/tx/6vztJ67fDbJUneN83gUHDNX5cbm3QN7rJ4aEAjh8TM3K33VoUPWVSV54uYAN6TMvXFPSCPNdwLbJorEXB1AiUMz?cluster=devnet`
Treasury account: `51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH`
Treasury explorer link: `https://explorer.solana.com/address/51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH?cluster=devnet`
What this proves: The deployed ArcPay program accepted a real `shield_deposit` transaction for the initialized treasury and recorded shield reference `umbra-live-proof-20260505-1349` for mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`.
What it does not prove: A real Umbra privacy transfer, `execute_payment`, SPL token settlement, or policy rejection paths.

Track: Solana Program
Date: 2026-05-05
Network: Solana devnet
Wallet: `2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz`
Provider/API: ArcPay Anchor program
Command: `npm run proof:program:payment -w @arcpay/agent`
Transaction signature or response ID: `2nwbbTpQx837YQZfaTn3rpbzJU5bUdVSgaPDZ7PQj7vqxgxS77i4T8LYYB3iRbvJLCWDnNUGADsvxvdDP2X3HkwU`
Explorer/provider link: `https://explorer.solana.com/tx/2nwbbTpQx837YQZfaTn3rpbzJU5bUdVSgaPDZ7PQj7vqxgxS77i4T8LYYB3iRbvJLCWDnNUGADsvxvdDP2X3HkwU?cluster=devnet`
Treasury account: `51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH`
Treasury token account: `HHz3XNE36rU5PTMX2XPUDMnZraNvPst5aSxzrT2k8kcu`
Recipient token account: `FnfdqfAuCeVgzR2zJb15mdG6GTRw16N8SwbCsuQCNW94`
What this proves: The deployed ArcPay program accepted a real `execute_payment` transaction under the configured policy, transferred `250` units from the treasury token account to the recipient token account, and recorded payment reference `execute-payment-live-proof-20260505-1405`.
What it does not prove: Mainnet settlement, x402 paid request settlement, partner settlement APIs, or policy rejection paths.

Track: Solana Program
Date: 2026-05-05
Network: Solana devnet
Wallet: `2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz`
Provider/API: ArcPay Anchor program
Command: `npm run proof:program:policy -w @arcpay/agent`
Transaction signature or response ID: `2yoXiLQQ8CGoXSWjFU48TLSKEr1ZPSmaPJnp9xg3KPPkXUJENFvHuK8DrFZNY7RyLV7shKsZEHQhJruZFh4997jB`
Explorer/provider link: `https://explorer.solana.com/tx/2yoXiLQQ8CGoXSWjFU48TLSKEr1ZPSmaPJnp9xg3KPPkXUJENFvHuK8DrFZNY7RyLV7shKsZEHQhJruZFh4997jB?cluster=devnet`
Treasury account: `51e7DSbi99gHsq2LobnK1geszT1DoipTwp19cMP2gyeH`
What this proves: The deployed ArcPay program rejected an over-limit payment on-chain with `ExceedsSingleTxLimit`, custom error `6006`, after attempting amount `1001` against configured `maxSingleTx=1000`.
What it does not prove: Mainnet settlement or partner settlement APIs.

Track: Solflare / Phantom
Date: 2026-05-06
Network: Solana devnet
Wallet: `BVnEQzb5TG8bjqKamooqV9LRJt4pgHvFPoma7kr7mW4`
Provider/API: Phantom browser wallet plus ArcPay server `/live/treasury`
Command: `npm run dev -w @arcpay/server` and `npm run dev -w @arcpay/frontend`
Transaction signature or response ID: Browser proof screenshot showing connected wallet and `RPC verified` dashboard cards
Explorer/provider link: Not applicable; this proof is wallet connection plus live Solana RPC dashboard data.
What this proves: The dashboard connected to a real Phantom wallet and rendered live Solana RPC treasury data from the ArcPay server instead of static or mock balances. The visible live cards showed `7.666334682 SOL`, `6` parsed token accounts, `paymentMode=development`, and `RPC verified`.
What it does not prove: Production x402 payment settlement, mainnet balances, private settlement, or a wallet-signed transaction from the connected browser wallet.

Track: DFlow
Date: 2026-05-08
Network: DFlow dev quote endpoint
Wallet: Not used; read-only order quote
Provider/API: `GET https://dev-quote-api.dflow.net/order`
Command: `ARCPAY_REQUIRE_LIVE_DFLOW=true DFLOW_API_BASE_URL=https://dev-quote-api.dflow.net npm run smoke:partners -w @arcpay/agent`
Transaction signature or response ID: Quote at Solana slot `418486075`
Explorer/provider link: Not applicable; this is a DFlow API quote response.
What this proves: ArcPay can request and validate a live DFlow order quote through the SDK REST boundary. The accepted route quoted `1000000` wrapped SOL units to `92583` USDC units.
What it does not prove: A wallet-signed DFlow transaction, submitted swap, intent settlement, or mainnet execution proof.

Track: DFlow
Date: 2026-05-08
Network: DFlow dev quote endpoint / Solana mainnet transaction format
Wallet: Throwaway unfunded signer `83vKwmmNZ2Rr2y9VBgcUqcPS82ZKYNqZTATQwrcU6zF3`
Provider/API: `GET https://dev-quote-api.dflow.net/order`
Command: `ARCPAY_DFLOW_SUBMIT=false npm run proof:dflow -w @arcpay/agent`
Transaction signature or response ID: Quote at Solana slot `418488652`; signed transaction bytes `951`; not submitted
Explorer/provider link: Not applicable; `ARCPAY_DFLOW_SUBMIT=false`
What this proves: ArcPay can request a DFlow order with `userPublicKey`, receive a signable transaction, deserialize it, sign it locally, and keep the signed payload out of logs.
What it does not prove: Submitted DFlow swap settlement, wallet funding, token account availability, or a confirmed Solana transaction signature.

Track: DFlow
Date: 2026-05-09
Network: DFlow dev quote endpoint / `.env` empty-wallet readiness
Wallet: Ignored throwaway unfunded signer `DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm`
Provider/API: `GET https://dev-quote-api.dflow.net/order`
Command: `npm run proof:dflow -w @arcpay/agent`
Transaction signature or response ID: Quote at Solana slot `418499322`; signed transaction bytes `897`; not submitted
Explorer/provider link: Not applicable; `ARCPAY_DFLOW_SUBMIT=false`
What this proves: Root `.env` is loaded automatically, ArcPay can request a DFlow order with the configured empty wallet, receive a signable transaction, sign it locally, and keep the signed payload out of logs.
What it does not prove: Submitted DFlow swap settlement, wallet funding, token account availability, or a confirmed Solana transaction signature.

Track: Cloak
Date: 2026-05-09
Network: Solana devnet
Wallet: `DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm`
Provider/API: `@cloak.dev/sdk-devnet`, relay `https://api.devnet.cloak.ag`, program `Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h`
Command: `npm run proof:cloak -w @arcpay/agent`
Transaction signature or response ID: `ce1H6WWLZdCRZaxJPxdBE1iQL2GX2euFrnQWp54vtqfcKNLhDpb3foaaVmRCr1Axj7Reugq7nVTWJmMaAbACc4Y`
Explorer/provider link: `https://explorer.solana.com/tx/ce1H6WWLZdCRZaxJPxdBE1iQL2GX2euFrnQWp54vtqfcKNLhDpb3foaaVmRCr1Axj7Reugq7nVTWJmMaAbACc4Y?cluster=devnet`
What this proves: The official Cloak devnet SDK submitted a real functional UTXO transaction to the live Cloak devnet program. RPC verification showed slot `461123826`, `err: null`, four instructions, signer `DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm`, fee `50000` lamports, and program logs ending in success after `201368` compute units.
What it does not prove: Mainnet Cloak settlement, real USDC/USDT privacy, batch payroll, private swaps, or a production viewing-key audit flow.

Track: Encrypt / Ika
Date: 2026-05-09
Network: Solana devnet / Ika pre-alpha
Wallet: `DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm`
Provider/API: Ika Solana pre-alpha program and gRPC endpoint `https://pre-alpha-dev-1.ika.ika-network.net:443`
Command: `npm run proof:ika -w @arcpay/agent`
Transaction signature or response ID: Boundary proof only; no transaction submitted.
Explorer/provider link: `https://explorer.solana.com/address/87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY?cluster=devnet`
What this proves: ArcPay can reach the documented Ika Solana pre-alpha program, the program account exists and is executable, and the configured signer has `4988154320` lamports for the next proof.
What it does not prove: dWallet creation, MPC custody, cross-chain custody, production Ika security, or an ArcPay policy-gated dWallet signature transaction.

Track: Encrypt / Ika
Date: 2026-05-09
Network: Ika pre-alpha gRPC
Wallet: `DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm`
Provider/API: `DWalletService.GetPresigns` at `https://pre-alpha-dev-1.ika.ika-network.net:443`
Command: `npm run proof:ika:grpc -w @arcpay/agent`
Transaction signature or response ID: gRPC response returned `0` presigns.
Explorer/provider link: Not applicable; this is an Ika gRPC service response.
What this proves: ArcPay can load the official Ika protobuf service boundary and reach the live pre-alpha gRPC endpoint using the configured signer public key.
What it does not prove: dWallet creation, message approval, signature generation, MPC custody, or production Ika security.

Track: Encrypt / Ika
Date: 2026-05-10
Network: Solana devnet / Ika pre-alpha
Wallet: `DUA1C9mpWGpGTB2545CdtqsmRfhZdDLPza5yFdadGWmm`
Provider/API: `DWalletService.SubmitTransaction` DKG plus Ika `ApproveMessage`
Command: `npm run proof:ika:create-dwallet -w @arcpay/agent` then `IKA_APPROVE_SUBMIT=true npm run proof:ika:approve -w @arcpay/agent`
Transaction signature or response ID: `PViR5gcGyvPrHDRimqF5CMrDy7KCuBStXePMdkVB2XaLa1sqzbVoZg6W7tVvRbHtNUGdcrXXqiP6FNiNX7fNvrR`
Explorer/provider link: `https://explorer.solana.com/tx/PViR5gcGyvPrHDRimqF5CMrDy7KCuBStXePMdkVB2XaLa1sqzbVoZg6W7tVvRbHtNUGdcrXXqiP6FNiNX7fNvrR?cluster=devnet`
dWallet: `FgQLihMuxamuizS1ozufthE7UncuCYEcnJkrZV4hD1T5`
MessageApproval: `7U7qWsf21JPMXoSrT2ktHBMrW9NjpxcDBuaxtsy3ZoVz`
What this proves: ArcPay created a real Ika pre-alpha dWallet and submitted an Ika `ApproveMessage` transaction gated by ArcPay's spend policy.
What it does not prove: production MPC custody, mainnet Ika, real cross-chain custody, or Encrypt FHE privacy.

Track: PUSD / Palm USD
Date: 2026-05-09
Network: Solana mainnet / Palm USD API
Wallet: Not used; read-only proof
Provider/API: Palm USD `GET /api/v1/circulation` plus Solana mainnet parsed SPL mint account
Command: `npm run proof:pusd -w @arcpay/agent`
Transaction signature or response ID: Palm API snapshot `9f7d0f40-1381-4d56-beb6-13286709df38`
Explorer/provider link: `https://explorer.solana.com/address/CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s`
What this proves: ArcPay uses the official Palm USD Solana mint `CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s`, verified 6 decimals and no freeze authority by Solana RPC, and verified Palm API reports `2895000` Solana PUSD circulating as of `2026-04-24T14:30:00Z`.
What it does not prove: ArcPay receiving, holding, or paying real PUSD; that still requires a funded PUSD wallet or sponsor-accepted alternative.
