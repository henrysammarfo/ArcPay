import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_GRPC_ENDPOINT = "https://pre-alpha-dev-1.ika.ika-network.net:443";
const DEFAULT_PROGRAM_ID = "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY";

export async function GET() {
  const rpcUrl = process.env.IKA_SOLANA_RPC_URL ?? process.env.QUICKNODE_RPC_URL ?? DEFAULT_RPC_URL;
  const grpcEndpoint = process.env.IKA_GRPC_ENDPOINT ?? DEFAULT_GRPC_ENDPOINT;
  const programId = new PublicKey(process.env.IKA_PROGRAM_ID ?? DEFAULT_PROGRAM_ID);
  const dWalletAddress = process.env.IKA_DWALLET_ADDRESS;

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const programAccount = await connection.getAccountInfo(programId, "confirmed");
    if (!programAccount?.executable) {
      return NextResponse.json({ error: `Ika program ${programId.toBase58()} is not executable on configured RPC.` }, { status: 502 });
    }

    let dWallet: { address: string; owner: string; exists: boolean } | undefined;
    if (dWalletAddress) {
      const address = new PublicKey(dWalletAddress);
      const account = await connection.getAccountInfo(address, "confirmed");
      dWallet = {
        address: address.toBase58(),
        owner: account?.owner.toBase58() ?? "",
        exists: Boolean(account),
      };
    }

    return NextResponse.json({
      status: dWallet?.exists ? "dwallet_ready" : "program_ready",
      rpcUrl,
      grpcEndpoint,
      programId: programId.toBase58(),
      programExecutable: true,
      dWallet,
      approvalSignature: process.env.IKA_APPROVE_TX_SIGNATURE || null,
      messageApprovalAddress: process.env.IKA_MESSAGE_APPROVAL_ADDRESS || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ika status proof failed." },
      { status: 502 },
    );
  }
}
