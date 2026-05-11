import {
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "node:buffer";
import { ArcPaySdkError } from "../errors.js";
import {
  assertNonEmptyString,
  assertPercentageScore,
  assertPositiveNumber,
} from "../validation.js";
import type {
  ArcPayProgramClient,
  ExecutePaymentOnChainParams,
  InitializeTreasuryOnChainParams,
  OnChainAgentTreasury,
  OnChainTransactionResult,
  ShieldDepositOnChainParams,
} from "../types.js";

const TREASURY_SEED = new TextEncoder().encode("treasury");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const AGENT_TREASURY_DISCRIMINATOR = bytes([129, 97, 0, 63, 102, 222, 200, 166]);

export const ARCPAY_TOKEN_PROGRAM_ID = TOKEN_PROGRAM_ID;

const DISCRIMINATORS = {
  executePayment: bytes([86, 4, 7, 7, 120, 139, 232, 139]),
  initializeTreasury: bytes([124, 186, 211, 195, 85, 165, 129, 166]),
  shieldDeposit: bytes([197, 58, 196, 180, 224, 142, 178, 40]),
} as const;

/**
 * Solana implementation of the ArcPay Anchor program client.
 *
 * This avoids duplicating on-chain policy logic. It only builds and submits
 * instructions accepted by the deployed `arcpay` program.
 */
export class SolanaArcPayProgramClient implements ArcPayProgramClient {
  private readonly connection: Connection;
  private readonly programId: PublicKey;

  public constructor(params: { readonly connection: Connection; readonly programId: string | PublicKey }) {
    this.connection = params.connection;
    this.programId =
      typeof params.programId === "string" ? new PublicKey(params.programId) : params.programId;
  }

  public deriveTreasuryAddress(params: {
    readonly owner: PublicKey;
    readonly agentId: string;
  }): PublicKey {
    const agentId = assertNonEmptyString(params.agentId, "agentId");
    const [address] = PublicKey.findProgramAddressSync(
      [TREASURY_SEED, params.owner.toBuffer(), new TextEncoder().encode(agentId)],
      this.programId,
    );

    return address;
  }

  public async initializeTreasury(
    params: InitializeTreasuryOnChainParams,
  ): Promise<OnChainTransactionResult> {
    const agentId = assertNonEmptyString(params.agentId, "agentId");
    const dailyLimit = toU64(params.dailyLimit, "dailyLimit");
    const maxSingleTx = toU64(params.maxSingleTx, "maxSingleTx");
    const minGoldRushScore = assertPercentageScore(
      params.minGoldRushScore,
      "minGoldRushScore",
    );
    const treasury = this.deriveTreasuryAddress({
      owner: params.owner.publicKey,
      agentId,
    });

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: params.owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(concatBytes(
        DISCRIMINATORS.initializeTreasury,
        encodeString(agentId),
        encodeU64(dailyLimit),
        encodeU64(maxSingleTx),
        bytes([minGoldRushScore]),
      )),
    });

    return {
      signature: await this.sendSignedInstruction(instruction, params.owner),
      treasuryAddress: treasury.toBase58(),
    };
  }

  public async shieldDeposit(
    params: ShieldDepositOnChainParams,
  ): Promise<OnChainTransactionResult> {
    const amount = toU64(params.amount, "amount");
    const shieldRef = assertNonEmptyString(params.shieldRef, "shieldRef");

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: params.treasury, isSigner: false, isWritable: false },
        { pubkey: params.owner.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(concatBytes(
        DISCRIMINATORS.shieldDeposit,
        encodeU64(amount),
        params.mint.toBytes(),
        encodeString(shieldRef),
      )),
    });

    return {
      signature: await this.sendSignedInstruction(instruction, params.owner),
      treasuryAddress: params.treasury.toBase58(),
    };
  }

  public async executePayment(
    params: ExecutePaymentOnChainParams,
  ): Promise<OnChainTransactionResult> {
    const amount = toU64(params.amount, "amount");
    const goldRushScore = assertPercentageScore(params.goldRushScore, "goldRushScore");
    const paymentRef = assertNonEmptyString(params.paymentRef, "paymentRef");

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: params.treasury, isSigner: false, isWritable: true },
        { pubkey: params.owner.publicKey, isSigner: true, isWritable: false },
        { pubkey: params.treasuryTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.recipientTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(concatBytes(
        DISCRIMINATORS.executePayment,
        encodeU64(amount),
        bytes([goldRushScore]),
        encodeString(paymentRef),
      )),
    });

    return {
      signature: await this.sendSignedInstruction(instruction, params.owner),
      treasuryAddress: params.treasury.toBase58(),
    };
  }

  public async fetchTreasury(address: PublicKey): Promise<OnChainAgentTreasury | null> {
    const account = await this.connection.getAccountInfo(address, "confirmed");

    if (!account) {
      return null;
    }

    return decodeAgentTreasury(account.data);
  }

  private async sendSignedInstruction(
    instruction: TransactionInstruction,
    signer: InitializeTreasuryOnChainParams["owner"],
  ): Promise<string> {
    try {
      return await sendAndConfirmTransaction(
        this.connection,
        new Transaction().add(instruction),
        [signer],
        { commitment: "confirmed" },
      );
    } catch (cause) {
      throw new ArcPaySdkError(
        "EXTERNAL_SERVICE_ERROR",
        "ArcPay program transaction failed.",
        cause,
      );
    }
  }
}

export function decodeAgentTreasury(data: Uint8Array): OnChainAgentTreasury {
  const reader = new BinaryReader(data);
  const discriminator = reader.readBytes(8);

  if (!bytesEqual(discriminator, AGENT_TREASURY_DISCRIMINATOR)) {
    throw new ArcPaySdkError("VALIDATION_ERROR", "Account is not an ArcPay treasury.");
  }

  return {
    owner: new PublicKey(reader.readBytes(32)).toBase58(),
    agentId: reader.readString(),
    dailyLimit: reader.readU64(),
    maxSingleTx: reader.readU64(),
    minGoldRushScore: reader.readU8(),
    dailySpent: reader.readU64(),
    lastReset: reader.readI64(),
    isActive: reader.readBool(),
    bump: reader.readU8(),
  };
}

export function createInitializeTreasuryInstructionData(params: {
  readonly agentId: string;
  readonly dailyLimit: number | bigint;
  readonly maxSingleTx: number | bigint;
  readonly minGoldRushScore: number;
}): Uint8Array {
  return concatBytes(
    DISCRIMINATORS.initializeTreasury,
    encodeString(assertNonEmptyString(params.agentId, "agentId")),
    encodeU64(toU64(params.dailyLimit, "dailyLimit")),
    encodeU64(toU64(params.maxSingleTx, "maxSingleTx")),
    bytes([assertPercentageScore(params.minGoldRushScore, "minGoldRushScore")]),
  );
}

export function createExecutePaymentInstructionData(params: {
  readonly amount: number | bigint;
  readonly goldRushScore: number;
  readonly paymentRef: string;
}): Uint8Array {
  return concatBytes(
    DISCRIMINATORS.executePayment,
    encodeU64(toU64(params.amount, "amount")),
    bytes([assertPercentageScore(params.goldRushScore, "goldRushScore")]),
    encodeString(assertNonEmptyString(params.paymentRef, "paymentRef")),
  );
}

function toU64(value: number | bigint, fieldName: string): bigint {
  if (typeof value === "number") {
    assertPositiveNumber(value, fieldName);

    if (!Number.isInteger(value)) {
      throw new ArcPaySdkError("VALIDATION_ERROR", `${fieldName} must be an integer.`);
    }

    return BigInt(value);
  }

  if (value <= 0n || value > 18_446_744_073_709_551_615n) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${fieldName} must fit in u64.`);
  }

  return value;
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

function concatBytes(...chunks: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function bytes(values: readonly number[]): Uint8Array {
  return new Uint8Array(values);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

class BinaryReader {
  private offset = 0;
  private readonly view: DataView;

  public constructor(private readonly data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  public readBytes(length: number): Uint8Array {
    const start = this.offset;
    this.offset += length;
    return this.data.slice(start, this.offset);
  }

  public readString(): string {
    const length = this.readU32();
    return new TextDecoder().decode(this.readBytes(length));
  }

  public readU8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  public readU32(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  public readU64(): bigint {
    const value = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return value;
  }

  public readI64(): bigint {
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return value;
  }

  public readBool(): boolean {
    return this.readU8() !== 0;
  }
}
