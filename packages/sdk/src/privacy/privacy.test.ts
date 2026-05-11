import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { runCloakDevnetSolDepositProof } from "./cloak-devnet.js";
import { createCloakFunctionalClient, payContractorPrivately } from "./cloak.js";
import {
  createDevelopmentCloakClient,
  createDevelopmentUmbraClient,
} from "./development.js";
import { createUmbraDirectDepositClient, shieldIncomingPayment } from "./umbra.js";

describe("privacy adapters", () => {
  it("shields incoming payments through an Umbra-compatible adapter", async () => {
    const umbra = createDevelopmentUmbraClient({ idFactory: () => "fixed" });

    const result = await shieldIncomingPayment(umbra, {
      payerWallet: "payer-wallet-address",
      amount: 25,
      mint: "USDC-mint",
    });

    expect(result).toEqual({
      txId: "dev_umbra_tx_fixed",
      stealthAddress: "dev_umbra_payer-wa_fixed",
      shielded: true,
    });
  });

  it("executes private contractor payroll through a Cloak-compatible adapter", async () => {
    const cloak = createDevelopmentCloakClient({ idFactory: () => "fixed" });

    const result = await payContractorPrivately(cloak, {
      ownerViewingKey: "viewing-key",
      contractors: [
        {
          wallet: "contractor-wallet",
          amount: 10,
          currency: "SOL",
          note: "test payment",
        },
      ],
    });

    expect(result).toEqual({
      batchId: "dev_cloak_batch_fixed",
      private: true,
      settled: true,
    });
  });

  it("rejects empty contractor payroll batches", async () => {
    const cloak = createDevelopmentCloakClient({ idFactory: () => "fixed" });

    await expect(
      payContractorPrivately(cloak, {
        ownerViewingKey: "viewing-key",
        contractors: [],
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("deposits into Umbra encrypted balance through production SDK functions", async () => {
    const calls: string[] = [];
    const signerAddress = "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz";
    const umbra = createUmbraDirectDepositClient({
      signer: { address: signerAddress },
      signerAddress,
      network: "mainnet",
      rpcUrl: "https://api.mainnet-beta.solana.com",
      amountToBaseUnits: ({ amount }) => BigInt(Math.round(amount * 1_000_000)),
      sdk: {
        async getUmbraClient() {
          calls.push("client");
          return { id: "client" };
        },
        getUserRegistrationFunction() {
          return async () => {
            calls.push("register");
          };
        },
        getPublicBalanceToEncryptedBalanceDirectDepositorFunction() {
          return async (_destinationAddress, _mint, amount) => {
            calls.push(`deposit:${amount.toString()}`);
            return "umbra-signature";
          };
        },
      },
    });

    const result = await shieldIncomingPayment(umbra, {
      payerWallet: signerAddress,
      amount: 1.25,
      mint: "USDC-mint",
    });

    expect(result).toEqual({
      txId: "umbra-signature",
      stealthAddress: signerAddress,
      shielded: true,
    });
    expect(calls).toEqual(["client", "register", "deposit:1250000"]);
  });

  it("rejects Umbra direct deposits from a wallet that is not the signer", async () => {
    const umbra = createUmbraDirectDepositClient({
      signer: {},
      signerAddress: "2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz",
      network: "mainnet",
      rpcUrl: "https://api.mainnet-beta.solana.com",
      amountToBaseUnits: () => 1n,
      sdk: {
        async getUmbraClient() {
          throw new Error("should not create client");
        },
        getUserRegistrationFunction() {
          throw new Error("should not register");
        },
        getPublicBalanceToEncryptedBalanceDirectDepositorFunction() {
          throw new Error("should not deposit");
        },
      },
    });

    await expect(
      shieldIncomingPayment(umbra, {
        payerWallet: "different-wallet",
        amount: 1,
        mint: "USDC-mint",
      }),
    ).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
    });
  });

  it("executes a Cloak functional SOL private send through production SDK functions", async () => {
    const signerPublicKey = new PublicKey("2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz");
    const calls: string[] = [];
    const cloak = createCloakFunctionalClient({
      signerPublicKey,
      transactionOptions: {
        connection: { id: "connection" },
        programId: signerPublicKey,
        walletPublicKey: signerPublicKey,
      },
      amountToBaseUnits: ({ amount }) => BigInt(Math.round(amount * 1_000_000_000)),
      sdk: {
        async createUtxo(amount) {
          calls.push(`create:${amount.toString()}`);
          return { amount };
        },
        async createZeroUtxo() {
          calls.push("zero");
          return { amount: 0n };
        },
        async fullWithdraw() {
          calls.push("withdraw");
          return { signature: "withdraw-signature" };
        },
        async generateUtxoKeypair() {
          calls.push("owner");
          return { publicKey: 1n };
        },
        async transact() {
          calls.push("transact");
          return {
            signature: "deposit-signature",
            outputUtxos: [{ amount: 1n }],
            merkleTree: { id: "tree" },
          };
        },
      },
    });

    const result = await payContractorPrivately(cloak, {
      ownerViewingKey: "viewing-key",
      contractors: [
        {
          wallet: "11111111111111111111111111111111",
          amount: 0.01,
          currency: "SOL",
        },
      ],
    });

    expect(result).toEqual({
      batchId: "deposit-signature:withdraw-signature",
      private: true,
      settled: true,
    });
    expect(calls).toEqual(["owner", "create:10000000", "zero", "transact", "withdraw"]);
  });

  it("rejects non-SOL Cloak functional payroll until SPL UTXO flow is configured", async () => {
    const signerPublicKey = new PublicKey("2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz");
    const cloak = createCloakFunctionalClient({
      signerPublicKey,
      transactionOptions: {
        connection: {},
        programId: signerPublicKey,
      },
      amountToBaseUnits: () => 1n,
      sdk: {
        async createUtxo() {
          return {};
        },
        async createZeroUtxo() {
          return {};
        },
        async fullWithdraw() {
          return { signature: "withdraw" };
        },
        async generateUtxoKeypair() {
          return {};
        },
        async transact() {
          return {
            signature: "deposit",
            outputUtxos: [],
          };
        },
      },
    });

    await expect(
      payContractorPrivately(cloak, {
        ownerViewingKey: "viewing-key",
        contractors: [
          {
            wallet: "11111111111111111111111111111111",
            amount: 1,
            currency: "USDC",
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
    });
  });

  it("runs Cloak devnet SOL deposit through the official functional UTXO surface", async () => {
    const signerPublicKey = new PublicKey("2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz");
    const calls: string[] = [];
    const result = await runCloakDevnetSolDepositProof({
      connection: {
        async getBalance() {
          return 2_000_000;
        },
      } as never,
      signer: { publicKey: signerPublicKey } as never,
      amountLamports: 1_000_000n,
      relayUrl: "https://api.devnet.cloak.ag",
      sdk: {
        CLOAK_PROGRAM_ID: new PublicKey("Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h"),
        NATIVE_SOL_MINT: new PublicKey("So11111111111111111111111111111111111111112"),
        async createUtxo(amount) {
          calls.push(`create:${amount.toString()}`);
          return { amount };
        },
        async createZeroUtxo() {
          calls.push("zero");
          return { amount: 0n };
        },
        async generateUtxoKeypair() {
          calls.push("owner");
          return { privateKey: 1n };
        },
        getNkFromUtxoPrivateKey() {
          calls.push("nk");
          return new Uint8Array(32);
        },
        async transact(params) {
          calls.push(`transact:${params.externalAmount.toString()}`);
          return {
            signature: "cloak-devnet-signature",
            outputUtxos: params.outputUtxos,
            merkleTree: { id: "tree" },
          };
        },
      },
    });

    expect(result).toEqual({
      network: "devnet",
      signer: signerPublicKey.toBase58(),
      amountLamports: "1000000",
      programId: "Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h",
      relayUrl: "https://api.devnet.cloak.ag",
      signature: "cloak-devnet-signature",
      outputCount: 1,
      merkleTreeReturned: true,
    });
    expect(calls).toEqual(["owner", "nk", "create:1000000", "zero", "transact:1000000"]);
  });

  it("fails Cloak devnet proof early when the signer is not funded", async () => {
    await expect(
      runCloakDevnetSolDepositProof({
        connection: {
          async getBalance() {
            return 0;
          },
        } as never,
        signer: { publicKey: new PublicKey("2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz") } as never,
        amountLamports: 1_000_000n,
        sdk: {} as never,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("insufficient SOL"),
    });
  });
});
