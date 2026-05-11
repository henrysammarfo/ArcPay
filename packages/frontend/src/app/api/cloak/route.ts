import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_RELAY_URL = "https://api.devnet.cloak.ag";
const DEFAULT_PROGRAM_ID = "Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h";
const DEFAULT_MOCK_USDC = "61ro7AExqfk4dZYoCyRzTahahCC2TdUUZ4M5epMPunJf";

export async function GET() {
  const rpcUrl = process.env.CLOAK_RPC_URL ?? process.env.QUICKNODE_RPC_URL ?? DEFAULT_RPC_URL;
  const relayUrl = process.env.CLOAK_RELAY_URL ?? DEFAULT_RELAY_URL;
  const programId = new PublicKey(process.env.CLOAK_PROGRAM_ID ?? DEFAULT_PROGRAM_ID);
  const mockUsdcMint = process.env.CLOAK_MOCK_USDC_MINT ?? DEFAULT_MOCK_USDC;
  const proofSignature = process.env.CLOAK_DEVNET_PROOF_SIGNATURE;

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const [programAccount, signatureStatus] = await Promise.all([
      connection.getAccountInfo(programId, "confirmed"),
      proofSignature ? connection.getSignatureStatus(proofSignature, { searchTransactionHistory: true }) : Promise.resolve(null),
    ]);

    if (!programAccount?.executable) {
      return NextResponse.json({ error: `Cloak program ${programId.toBase58()} is not executable on configured RPC.` }, { status: 502 });
    }

    return NextResponse.json({
      status: signatureStatus?.value?.confirmationStatus ? "proof_signature_confirmed" : "program_ready",
      network: process.env.CLOAK_NETWORK ?? "devnet",
      relayUrl,
      programId: programId.toBase58(),
      programExecutable: true,
      mockUsdcMint,
      proofSignature: proofSignature || null,
      proofConfirmationStatus: signatureStatus?.value?.confirmationStatus ?? null,
      proofErr: signatureStatus?.value?.err ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cloak status proof failed." },
      { status: 502 },
    );
  }
}
