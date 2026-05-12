import { NextResponse } from "next/server";
import { createWalletChallenge } from "../../../wallet-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { walletAddress?: string };
    const walletAddress = String(body.walletAddress ?? "").trim();

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required." }, { status: 400 });
    }

    return NextResponse.json(createWalletChallenge(walletAddress));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create wallet auth challenge." },
      { status: 400 },
    );
  }
}
