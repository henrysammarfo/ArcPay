# Ika dWallet Steps

ArcPay has already completed two honest Ika pre-alpha proofs:

- `npm run proof:ika -w @arcpay/agent`: verifies the official Solana devnet
  Ika program is reachable and executable.
- `npm run proof:ika:grpc -w @arcpay/agent`: verifies ArcPay can reach the
  official Ika pre-alpha gRPC service.

The remaining Ika track blocker is a real dWallet account. ArcPay cannot fake
this. The Ika team confirmed the creation path is in the docs; the path is the
pre-alpha gRPC DKG flow. ArcPay now has a first-class command for it:

```bash
npm run proof:ika:create-dwallet -w @arcpay/agent
```

Once a real dWallet exists, `proof:ika:approve` can submit the official Ika
`ApproveMessage` instruction under ArcPay spend policy.

## Official Links

- Ika Solana pre-alpha repo: `https://github.com/dwallet-labs/ika-pre-alpha`
- Ika Solana pre-alpha docs: `https://solana-pre-alpha.ika.xyz/`
- TypeScript client docs: `https://github.com/dwallet-labs/ika-pre-alpha/blob/main/docs/src/frameworks/typescript.md`
- E2E voting demo docs: `https://github.com/dwallet-labs/ika-pre-alpha/blob/main/docs/src/examples/voting/04-e2e.md`
- Pre-alpha gRPC: `https://pre-alpha-dev-1.ika.ika-network.net:443`
- Solana devnet RPC: `https://api.devnet.solana.com`
- Ika program: `87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY`

## What To Get

Get one real Ika pre-alpha dWallet public address on Solana devnet.

The value must be a Solana account owned by:

```text
87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY
```

Do not send a random wallet address. `proof:ika:approve` rejects accounts not
owned by the Ika program.

## ArcPay Self-Serve Path

This is the path to run first. It follows the official docs/repo flow:

- find the official `DWalletCoordinator` PDA;
- find the official `NetworkEncryptionKey` account;
- send `DWalletRequest::DKG` to `DWalletService.SubmitTransaction`;
- parse the `VersionedDWalletDataAttestation`;
- derive the dWallet PDA from `["dwallet", chunks(curve || public_key)]`;
- poll devnet until the dWallet account exists.

Run:

```bash
npm run proof:ika:create-dwallet -w @arcpay/agent
```

ArcPay live proof recorded:

```text
dWallet: FgQLihMuxamuizS1ozufthE7UncuCYEcnJkrZV4hD1T5
MessageApproval: 7U7qWsf21JPMXoSrT2ktHBMrW9NjpxcDBuaxtsy3ZoVz
Transaction: PViR5gcGyvPrHDRimqF5CMrDy7KCuBStXePMdkVB2XaLa1sqzbVoZg6W7tVvRbHtNUGdcrXXqiP6FNiNX7fNvrR
Explorer: https://explorer.solana.com/tx/PViR5gcGyvPrHDRimqF5CMrDy7KCuBStXePMdkVB2XaLa1sqzbVoZg6W7tVvRbHtNUGdcrXXqiP6FNiNX7fNvrR?cluster=devnet
```

Expected create-dWallet output includes:

```text
PASSED Ika create-dWallet proof:
  dWallet: <DWALLET_ON_CHAIN_ADDRESS>
  Add to .env: IKA_DWALLET_ADDRESS=<DWALLET_ON_CHAIN_ADDRESS>
```

Then set:

```bash
IKA_DWALLET_ADDRESS=<DWALLET_ON_CHAIN_ADDRESS>
IKA_APPROVE_SPEND_USD=5
IKA_APPROVE_MAX_SPEND_USD=8
IKA_APPROVE_SUBMIT=false
IKA_APPROVE_TX_SIGNATURE=<APPROVE_MESSAGE_TX_SIGNATURE>
IKA_MESSAGE_APPROVAL_ADDRESS=<MESSAGE_APPROVAL_ADDRESS>
```

Run the policy approval dry proof:

```bash
npm run proof:ika:approve -w @arcpay/agent
```

If it verifies the dWallet account and builds the transaction, submit:

```bash
IKA_APPROVE_SUBMIT=true npm run proof:ika:approve -w @arcpay/agent
```

Completion requires a transaction signature and the resulting
`MessageApproval` account proof.

## Official Repo Demo Path

Use this if ArcPay's direct command fails because the pre-alpha wire format
changed.

1. Install prerequisites on Linux or macOS:

```bash
curl -fsSL https://bun.sh/install | bash
rustup update
cargo install mdbook
```

2. Clone the official repo:

```bash
git clone https://github.com/dwallet-labs/ika-pre-alpha.git
cd ika-pre-alpha
```

3. Build/check the workspace:

```bash
cargo check --workspace
```

4. Follow the official E2E voting demo docs:

```text
docs/src/examples/voting/04-e2e.md
```

The demo flow does:

- gRPC DKG -> creates dWallet;
- transfers dWallet authority to a voting/controller program CPI PDA;
- creates proposal;
- casts votes;
- triggers `approve_message`;
- requests presign and sign via gRPC.

5. Copy the resulting dWallet account printed as `dWallet on-chain: ...`.

6. Put it in ArcPay `.env`:

```bash
IKA_DWALLET_ADDRESS=<DWALLET_ON_CHAIN_ADDRESS>
IKA_APPROVE_SPEND_USD=5
IKA_APPROVE_MAX_SPEND_USD=8
IKA_APPROVE_SUBMIT=false
```

7. Run ArcPay's dry proof first:

```bash
npm run proof:ika:approve -w @arcpay/agent
```

8. If it verifies the dWallet account and builds the transaction, submit:

```bash
IKA_APPROVE_SUBMIT=true npm run proof:ika:approve -w @arcpay/agent
```

## Claims Allowed

Allowed:

- "ArcPay integrates Ika pre-alpha."
- "ArcPay policy gates an Ika dWallet message approval."
- "This uses the official pre-alpha program/gRPC endpoints."

Not allowed:

- "Production MPC custody."
- "Mainnet Ika custody."
- "Cross-chain asset custody."
- "Real privacy/encryption guarantees."

The Ika repo explicitly says pre-alpha uses a single mock signer and has no
production MPC security guarantee.
