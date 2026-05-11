# ArcPay Track Submission Checklist

This file is the submission control sheet. `ArcPay_Build_Bible.txt` defines the
product vision; this checklist defines what each sponsor needs before ArcPay can
honestly submit for that track.

Do not mark a track complete unless the evidence is a real provider response,
real transaction, public deployment, or accepted sponsor-side event. Tests and
typed adapters prove engineering readiness only.

## Product Thread For All Tracks

ArcPay is one product: a private, yield-aware treasury OS for AI agents on
Solana. The judge-facing story should stay consistent:

- A customer pays an agent through x402.
- QuickNode observes live wallet activity.
- QVAC decides whether to hold, convert, yield, or pay.
- Birdeye and GoldRush provide market/risk intelligence.
- DFlow/Zerion/Kamino/LP Agent handle execution or yield boundaries.
- Umbra/Cloak provide privacy paths.
- Torque records the growth loop.
- The dashboard shows only live proof or honest blockers.

## Current Completion Legend

- `Complete`: accepted proof exists for the sponsor's required class of action.
- `Partial`: real API/onchain proof exists, but one required action is still missing.
- `Ready / Needs funds`: code and env are ready; funded wallet action remains.
- `Waiting external`: blocked by sponsor key, runtime support, mint, or docs.
- `Implementation target`: chosen track path is clear; code/proof work remains.
- `Do not submit yet`: no eligible proof path is ready.

## Active External Waitlist

No active track is currently sponsor/team-response blocked by missing docs or
missing sponsor replies.

QVAC is no longer waiting on a team answer. The QVAC team confirmed the
canonical install is `npm i @qvac/sdk` on Linux x64, while WSL is currently
untested. ArcPay needs a native Linux x64 proof for QVAC, not more WSL retries.
PUSD is no longer waiting on a mint answer because Palm developer docs publish
the official Solana SPL mint and public circulation API.

DFlow, Ika, Cloak, QuickNode, Birdeye, GoldRush, Torque, Zerion, Kamino, Umbra,
PUSD, LP Agent, QVAC, and the frontend are not marked as external-response
blocked. Their next steps are implementation, funded proof, native-host proof,
UX polish, or final submission assets.

## Track Matrix

| Track | Sponsor requirement | ArcPay fit | Current proof | Status | Final artifact needed |
| --- | --- | --- | --- | --- | --- |
| Main Frontier / Solana | Working Solana product, public repo, demo, real utility. | Agent treasury program, x402 payments, wallet dashboard, partner integrations. | Devnet program init/shield/payment/policy signatures recorded in `docs/smoke-test.md`. | Partial. | Public repo, deployed app, 2-3 min demo, final README with proof links. |
| 100xDevs | Solana project, real-world use, strong UX, technical execution, Colosseum + Superteam submission. | Open Solana AI treasury product for agencies and agent developers. | Program/devnet proofs and live dashboard proof exist. | Partial. | Public repo, polished responsive app, demo showing real proofs, submit to Colosseum and Superteam Earn. |
| MagicBlock / x402 / Private Payments | Working demo with successful MagicBlock integration; effective ER/PER/Private Payments/API use; 3 min video. | x402 paid agent endpoint plus MagicBlock Private Payments API deposit builder. | Production-mode Solana verifier accepted a real devnet SPL payment signature; `proof:magicblock` reached MagicBlock Private Payments health + SPL deposit builder, returned a 1098-byte `transactionBase64`, signed the signer-owned deposit tx, and reached expected SPL `insufficient funds` with an empty token wallet. | Complete for API-builder + empty-wallet proof; funded deposit preferred. | Demo `proof:magicblock` output; fund devnet token balance and record deposit tx if sponsor expects settlement. |
| Torque | Use Torque MCP/API to pass `custom_events`, trigger incentives, or distributors; demo video on X tagging `@torqueprotocol`; friction log. | Growth loop records wallet connect and paid agent request events. | `arcpay_wallet_connected` and `arcpay_paid_agent_request` accepted by Torque. | Complete for live event requirement; submission assets pending. | Friction log, screenshots of Event Log, X demo post tagging `@torqueprotocol`, public repo link. |
| GoldRush / Covalent | Use one or more GoldRush API endpoints; demo video on X tagging `@goldrushdev`. | Counterparty trust/risk score before agent payout. | `proof:goldrush` calls GoldRush Solana balances and drives an ArcPay approve/block risk decision. | Complete for API-use requirement; submission assets pending. | Demo video on X tagging `@goldrushdev`; if GoldRush enables Solana tx history for this key, show richer activity scoring too. |
| Zerion CLI | Fork Zerion CLI; implement scoped policy; execute real onchain tx routed through Zerion API; public code; demo. | ArcPay policy layer gates swaps/payments through a Zerion CLI fork. | API key works; CLI patch plan and insufficient-funds quote path documented. | Ready / Needs funds. | Public Zerion fork, at least one real Zerion-routed tx, scoped policy command, demo showing no simulation. |
| Cloak | Use Cloak SDK centrally; working demo/live/local; README explains SDK use; demo under 5 min; submit to Colosseum. | Private payroll/treasury transfer path. | Official Cloak devnet SDK submitted tx `ce1H6...ACc4Y` to program `Zc1k...27h`. | Complete for devnet private-deposit proof; stronger mainnet/payroll proof preferred. | README section for Cloak, proof link, demo walking private payment flow; optional mainnet SOL/private payroll if funds allow. |
| Umbra | Use Umbra SDK for financial privacy; README explains problem, SDK use, setup; demo under 5 min. | Shield incoming agent funds and encrypted balances/viewing access. | Adapter and docs exist; no live Umbra transaction yet. | Ready / Needs funds. | Real Umbra SDK shield/deposit/transfer tx on devnet/mainnet, or explicit sponsor-accepted testnet proof. |
| Encrypt / Ika | Use Encrypt and/or Ika infrastructure; public repo; README; demo under 5 min; devnet/pre-alpha acceptable if docs say so. | Ika dWallet policy guardrail for AI-agent treasury signing. Encrypt is lower priority because pre-alpha docs state no real encryption yet. | Ika dWallet `FgQL...D1T5` created through pre-alpha DKG; ArcPay policy-gated `ApproveMessage` tx `PViR...vrR` submitted on devnet. | Complete for Ika pre-alpha proof. | Demo the dWallet creation/approval commands, record explorer/account proof, label pre-alpha/no production MPC. |
| LP Agent / Meteora | Use one or more LP Agent endpoints and Zap In or Zap Out API inside app; clear demo. | Meteora LP yield route for idle agent treasury. | Frontend `/yield` reads LP Agent positions through `/api/lpagent`; server supports Zap-In transaction builds. Live `smoke:partners` proof generated 1 unsigned Zap-In transaction for pool `8EZqMc266xTtnS3uxstp8DdNU95fWKQ7mYyAZULSc6We`. | Ready / Needs funds. | Sign/submit Zap-In or Zap-Out transaction after funded approval, then prove resulting LP position. |
| QVAC / Tether | Meaningfully integrate QVAC SDK core functionality; local/offline/on-device; public repo + demo; Superteam Earn submission. | Local treasury brain decides yield/convert/pay without cloud AI. | Code integrated; QVAC team says Linux x64 is tested, WSL is untested. VMware native-Ubuntu route documented in `docs/qvac-native-linux-vm.md`. | Native Linux proof needed. | Run `proof:qvac` on native Linux x64 where `npm i @qvac/sdk` succeeds and returns a live local model decision. |
| PUSD / Palm USD | Build PUSD utility on Solana; GitHub; Colosseum submission; Loom/demo; pitch deck max 12 slides; working prototype preferred. | Accept PUSD as non-freezable payment/stable treasury asset. | Frontend `/api/pusd` verifies official Solana mint/API path: mint `CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s`, 6 decimals, Palm circulation API. | Ready / Needs funds. | Run `proof:pusd`; then complete a real PUSD receive/pay transaction or sponsor-accepted mainnet payment proof, plus pitch deck. |
| Raenest Nigeria | Must be Colosseum Frontier participant, Nigeria country marker, Superteam Earn side-track submission, project reviews/demo day requirements. | ArcPay has an African agency use case, but the founder eligibility does not match this side track. | Not active. | Do not submit. | Keep the Africa/agency narrative for main demo only; do not spend engineering time on Raenest unless eligibility changes. |
| Eitherway Grand / Public dApp | Live dApp URL created from Eitherway; production-ready; Solana mainnet final; demo 2-3 min; integration docs. | Public agency dashboard with Solflare, QuickNode, Birdeye, DFlow, Kamino tracks. | Local Next app exists; live deployment not done. | Partial. | Deploy through Eitherway if required, mainnet-ready proof, responsive UX, integration docs. |
| Eitherway / Solflare | Wallet experience must be central, not just connect button; bonus for deep linking/simulation. | Dashboard owner wallet, aggregate treasury, policy actions. | Phantom/Solflare-compatible wallet connection proof exists. | Partial. | Make wallet the control layer: signing/review flow, transaction state, deep-link/in-app browser notes. |
| Eitherway / QuickNode | Fast real-time app powered by QuickNode data/webhooks. | RPC + webhook update live treasury/payment events. | QuickNode devnet webhook proof complete. | Complete for devnet proof; mainnet final needed for Eitherway. | Public app showing real-time QuickNode-backed event/balance update. |
| Eitherway / Birdeye | Data intelligence as core product engine, actionable market insight. | Agent uses prices to decide convert/yield/pay. | SOL price read proof complete. | Partial. | Dashboard/agent must show Birdeye-driven decision, not just raw price. |
| Eitherway / DFlow | Execution quality, routing, slippage/speed improvement, DFlow core to product. | Conversion path uses DFlow quote/signable transaction. | Frontend `/swaps` calls `/api/dflow` for live quote/signable transaction. | Ready / Needs funds. | Submitted DFlow-routed tx or sponsor-accepted dev proof; show route/slippage result. |
| Eitherway / Kamino | Advanced DeFi strategy/position management using Kamino as core engine. | Idle treasury deposits to Kamino. | Frontend `/yield` calls `/api/kamino` for unsigned deposit/withdraw transaction builds. | Ready / Needs funds. | Signed/submitted deposit or visible position proof. |
| AUDD Grant | AUDD payment/settlement/rate use, likely grant-style proof rather than full track. | AUDD accepted for agency clients and x402 endpoint config. | Env/types/server route support. | Partial. | Verified AUDD mint/liquidity proof and one receive/pay/rate flow. |
| Agentic Engineering | Agent makes a real decision that leads to real onchain action. | Ada/QVAC policy agent orchestrates treasury actions. | Demo runner avoids fake claims; several rails are real individually. | Partial. | End-to-end run: decision -> policy check -> real tx/provider action. |

## Track-Specific Acceptance Notes

### Torque

ArcPay already satisfies the hard technical requirement because the Torque
dashboard accepted live custom events. The missing pieces are submission assets:

- Friction Log: what broke, what was confusing, and what Torque can improve.
- Demo/X post: show paid agent request, event log, and tag `@torqueprotocol`.
- README section: point judges to `packages/sdk/src/growth/torque.ts`,
  `packages/agent/src/torque-proof.ts`, and `docs/smoke-test.md`.

### GoldRush

GoldRush wants data to power product value. ArcPay now has a live risk proof:

```bash
npm run proof:goldrush -w @arcpay/agent
```

Latest proof result:

- Wallet: `2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz`
- Score: `20`
- GoldRush recommendation: `REJECT`
- ArcPay minimum score: `70`
- ArcPay policy decision: `BLOCK`

The Solana transaction-history endpoint returned HTTP 501 in live testing, so
the SDK only treats that specific unsupported-endpoint response as unavailable
and still requires the live GoldRush Solana balances endpoint to work. Other
GoldRush errors still fail. Demo language should be: "GoldRush data blocks a
weak counterparty before private payout." Do not claim classified Solana
transaction history unless GoldRush enables that endpoint for the key.

### MagicBlock / x402

Current ArcPay x402 proof is real Solana payment verification, and ArcPay now
has an explicit MagicBlock Private Payments API proof command:

```bash
npm run proof:magicblock -w @arcpay/agent
```

The command calls:

- `GET https://payments.magicblock.app/health`
- `POST https://payments.magicblock.app/v1/spl/deposit`

Latest live result:

- API: `https://payments.magicblock.app`
- Cluster: `devnet`
- Owner: `2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz`
- Mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Amount: `1000000`
- Deposit tx bytes: `1098`
- Response keys: `instructionCount`, `kind`, `lastValidBlockHeight`,
  `recentBlockhash`, `requiredSigners`, `sendTo`, `transactionBase64`,
  `validator`, `version`

This moves MagicBlock from generic x402-only to the sponsor API surface. If the
sponsor requires submitted settlement, the remaining action is to sign/submit
the returned transaction with funded devnet/mainnet assets and capture the tx
signature.

### Zerion

The mandatory success condition is a real onchain transaction through the forked
Zerion CLI. Empty-wallet `insufficient_funds` is a good readiness proof, but not
final eligibility.

Final demo must show:

- Forked CLI command.
- Scoped policy: chain lock, max spend, expiry, blocked action.
- Zerion-routed swap/bridge/rebalance tx signature.

### Cloak

The devnet proof is strong because it uses the official `@cloak.dev/sdk-devnet`
and a live Cloak program transaction. For maximum score, the product demo should
frame Cloak as payroll/private B2B settlement, not just "we called deposit."

Minimum acceptable README explanation:

- Why privacy is load-bearing for agent payroll/treasury.
- Which SDK functions are used.
- Devnet proof signature.
- Why mainnet/private payroll remains gated by funds.

### Umbra

Umbra needs a real SDK privacy flow. The product angle should be incoming
payment shielding or private balance view for the agent treasury.

Final proof target:

- Shield SPL or Token-2022 balance into Umbra.
- Transfer anonymously or show encrypted balance state.
- Optional: viewing/audit key explanation for enterprise compliance.

### PUSD / Palm USD

Palm developer docs publish the Solana deployment details:

- Mint: `CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s`
- Standard: SPL
- Decimals: `6`
- Freeze authority: none by live Solana RPC proof
- Mint authority from live RPC: `Gz87Mjd2dAaYtCsUWAkHrn3UQe6Haj1odthoPEDQarKo`
- Public API: `https://www.palmusd.com/api/v1/circulation`

ArcPay now has a read-only proof command:

```bash
npm run proof:pusd -w @arcpay/agent
```

This is still not full track completion. Final proof needs one real PUSD
receive/pay flow or written sponsor acceptance that mint/API integration plus
pitch deck is sufficient for the prototype stage.

### Eitherway

Eitherway final submission is stricter than local frontend: it requires a live
dApp URL created from Eitherway and mainnet for final submission. If we use
custom code, the submission still needs to clearly document the partner
integration.

Recommended primary Eitherway partner: `QuickNode` or `Solflare`.

Reason:

- QuickNode already has live webhook/RPC proof.
- Solflare/wallet UX can be central to the dashboard.
- DFlow/Kamino require funded mainnet transactions to be strongest.

### Encrypt / Ika

Chosen ArcPay path: Ika first, not Encrypt first.

Reason:

- The track examples explicitly call out multi-chain agentic wallets with
  decentralized guardrails for AI agents.
- ArcPay's core differentiator is a policy-controlled treasury, so a dWallet
  signing guardrail is load-bearing.
- Encrypt's current pre-alpha docs state encryption is not real yet and
  plaintext is public, which conflicts with the "no partial/no fake privacy"
  standard for ArcPay.

Ika proof target:

- Create or load an Ika dWallet on Solana pre-alpha. Done:
  `FgQLihMuxamuizS1ozufthE7UncuCYEcnJkrZV4hD1T5`.
- Build an ArcPay policy approval step before any dWallet signature request.
  Done through `proof:ika:approve`.
- Record the Solana devnet/pre-alpha transaction/account proof. Done:
  tx `PViR5gcGyvPrHDRimqF5CMrDy7KCuBStXePMdkVB2XaLa1sqzbVoZg6W7tVvRbHtNUGdcrXXqiP6FNiNX7fNvrR`,
  MessageApproval `7U7qWsf21JPMXoSrT2ktHBMrW9NjpxcDBuaxtsy3ZoVz`.
- Label clearly: official Ika pre-alpha, no production MPC security claim.

Do not claim:

- Real MPC custody.
- Mainnet readiness.
- Real cross-chain asset custody unless the Ika team confirms the route.

### Raenest Nigeria

This is not just a generic "Africa" track. It has participation and country
eligibility requirements. Because the builder is Ghanaian, ArcPay should not
submit to Raenest unless the organizers explicitly confirm eligibility.

Requirements if eligibility ever changes:

- Colosseum country marker is Nigeria.
- Project submitted to Colosseum and Superteam Earn side track.
- Required pitch reviews/demo-day attendance satisfied.

ArcPay can still use the Ada/Lagos narrative in the main demo, but that does
not automatically make the Raenest side track eligible.

## Repository Submission Map

Judges should not need to hunt through the repo. Before final submission, root
`README.md` should include this table:

| Judge | Start here |
| --- | --- |
| Solana/main | `docs/smoke-test.md`, `packages/program`, `packages/agent/src/program-*` |
| Torque | `packages/sdk/src/growth/torque.ts`, `packages/agent/src/torque-proof.ts`, Torque friction log |
| GoldRush | `packages/sdk/src/risk/goldrush.ts`, partner smoke output |
| MagicBlock/x402 | `packages/server/src/x402`, x402 proof output |
| Zerion | `docs/zerion-fork.md`, fork URL, policy command |
| Cloak | `packages/sdk/src/privacy/cloak-devnet.ts`, `docs/smoke-test.md` Cloak evidence |
| Umbra | `packages/sdk/src/privacy/umbra.ts`, live Umbra proof once complete |
| LP Agent | `packages/sdk/src/yield/meteora-lp.ts`, Zap-In/Out proof |
| QVAC | `packages/sdk/src/intelligence/qvac-brain.ts`, QVAC runtime proof |
| PUSD/AUDD | token proof section and x402/payment route |
| Frontend/Eitherway | public URL, responsive screenshots, wallet-flow demo |

## Frontend Replacement Note

The current local dashboard is a functional proof/status app, not the final
customer-facing treasury product. The final UI direction is defined in
`do../product-ui-product-brief.md`.

When the product UI zip or GitHub repo is available, import that app and wire it
into ArcPay so daily users see:

- overview, wallet, payments, invoices, contractors, swaps, yield, privacy,
  risk, policies, audit, settings, and profile routes;
- explicit devnet/mainnet network mode;
- transaction review modals before submitting funds;
- clear provider errors for insufficient funds, no route, no pool, minimum
  amount, or missing token account;
- raw sponsor proof evidence only under `/proofs` or an equivalent developer
  evidence route.

Do not submit the final public app until the imported frontend passes responsive
Playwright screenshots and connects to the real backend/proof state.

## Demo Video Checklist

The final demo should use the same language as the evidence:

- Say "devnet transaction" for devnet proof.
- Say "read-only API proof" for Birdeye/GoldRush if no transaction was made.
- Say "LP Agent funded LP position proof pending", "PUSD payment proof pending", and "native Linux proof pending" for QVAC if still blocked.
- Do not say "all tracks complete" unless every required artifact above exists.
- Show the public dashboard on desktop and mobile widths.
- Show docs/smoke-test evidence and at least one explorer link.

## Source Links

- GoldRush Solana docs: `https://goldrush.dev/docs/chains/solana/`
- GoldRush overview: `https://goldrush.dev/docs/overview`
- Torque MCP quickstart: `https://platform.torque.so/docs/mcp/quickstart`
- MagicBlock ER quickstart: `https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart`
- MagicBlock PER quickstart: `https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/how-to-guide/quickstart`
- Zerion CLI repo: `https://github.com/zeriontech/zerion-ai`
- Zerion API dashboard: `https://dashboard.zerion.io`
- Cloak SDK intro: `https://docs.cloak.ag/sdk/introduction`
- Cloak SDK quickstart: `https://docs.cloak.ag/sdk/quickstart`
- Umbra docs: `https://docs.umbraprivacy.com/`
- Umbra SDK docs: `https://sdk.umbraprivacy.com/`
- QVAC SDK quickstart: `https://docs.qvac.tether.io/sdk/getting-started/quickstart/`
- LP Agent docs: `https://docs.lpagent.io/introduction`
- DFlow docs: `https://pond.dflow.net/build/introduction`
- Palm USD website: `https://www.palmusd.com/`
- Palm USD partners/network page: `https://www.palmusd.com/partners`
- Eitherway build app: `https://eitherway.ai/chat`
- Colosseum Frontier portal: `https://arena.colosseum.org`
