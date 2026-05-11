import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import {
  createExecutePaymentInstructionData,
  createInitializeTreasuryInstructionData,
  decodeAgentTreasury,
  SolanaArcPayProgramClient,
} from "./arcpay-program.js";

const PROGRAM_ID = "GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz";

describe("ArcPay Solana program client", () => {
  it("derives a stable treasury PDA from owner and agent id", () => {
    const owner = new PublicKey("2PFg1fhfNBhqr7wLados3PB46rmwNrjTCcTeNHaFNABz");
    const client = new SolanaArcPayProgramClient({
      connection: new Connection("https://api.devnet.solana.com"),
      programId: PROGRAM_ID,
    });

    const first = client.deriveTreasuryAddress({ owner, agentId: "ada-research-agent-01" });
    const second = client.deriveTreasuryAddress({ owner, agentId: "ada-research-agent-01" });

    expect(first.toBase58()).toBe(second.toBase58());
  });

  it("encodes initialize_treasury with the deployed Anchor discriminator", () => {
    const data = createInitializeTreasuryInstructionData({
      agentId: "ada-research-agent-01",
      dailyLimit: 5_000,
      maxSingleTx: 1_000,
      minGoldRushScore: 70,
    });

    expect([...data.slice(0, 8)]).toEqual([124, 186, 211, 195, 85, 165, 129, 166]);
    expect(data.length).toBe(8 + 4 + "ada-research-agent-01".length + 8 + 8 + 1);
  });

  it("encodes execute_payment with the deployed Anchor discriminator", () => {
    const data = createExecutePaymentInstructionData({
      amount: 1_001,
      goldRushScore: 91,
      paymentRef: "policy-failure-proof",
    });

    expect([...data.slice(0, 8)]).toEqual([86, 4, 7, 7, 120, 139, 232, 139]);
    expect(data.length).toBe(8 + 8 + 1 + 4 + "policy-failure-proof".length);
  });

  it("decodes an AgentTreasury account", () => {
    const owner = Keypair.generate().publicKey;
    const data = createTreasuryAccountData({
      owner,
      agentId: "ada-research-agent-01",
      dailyLimit: 5_000n,
      maxSingleTx: 1_000n,
      minGoldRushScore: 70,
      dailySpent: 200n,
      lastReset: 1_777_663_903n,
      isActive: true,
      bump: 254,
    });

    const decoded = decodeAgentTreasury(data);

    expect(decoded).toMatchObject({
      owner: owner.toBase58(),
      agentId: "ada-research-agent-01",
      minGoldRushScore: 70,
      isActive: true,
      bump: 254,
    });
    expect(decoded.dailyLimit).toBe(5_000n);
    expect(decoded.dailySpent).toBe(200n);
  });
});

function createTreasuryAccountData(params: {
  readonly owner: PublicKey;
  readonly agentId: string;
  readonly dailyLimit: bigint;
  readonly maxSingleTx: bigint;
  readonly minGoldRushScore: number;
  readonly dailySpent: bigint;
  readonly lastReset: bigint;
  readonly isActive: boolean;
  readonly bump: number;
}): Uint8Array {
  return concatBytes(
    new Uint8Array([129, 97, 0, 63, 102, 222, 200, 166]),
    params.owner.toBytes(),
    encodeString(params.agentId),
    encodeU64(params.dailyLimit),
    encodeU64(params.maxSingleTx),
    new Uint8Array([params.minGoldRushScore]),
    encodeU64(params.dailySpent),
    encodeI64(params.lastReset),
    new Uint8Array([params.isActive ? 1 : 0]),
    new Uint8Array([params.bump]),
  );
}

function encodeString(value: string): Uint8Array {
  const encoded = new TextEncoder().encode(value);
  return concatBytes(encodeU32(encoded.length), encoded);
}

function encodeU32(value: number): Uint8Array {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value, true);
  return output;
}

function encodeU64(value: bigint): Uint8Array {
  const output = new Uint8Array(8);
  new DataView(output.buffer).setBigUint64(0, value, true);
  return output;
}

function encodeI64(value: bigint): Uint8Array {
  const output = new Uint8Array(8);
  new DataView(output.buffer).setBigInt64(0, value, true);
  return output;
}

function concatBytes(...chunks: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}
