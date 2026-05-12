import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../../../supabase-server";
import { normalizeWalletAddress } from "../../../wallet-auth";

type WalletIdentityRow = {
  user_id: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      accessToken?: string;
      walletAddress?: string;
    };
    const accessToken = String(body.accessToken ?? "").trim();
    const walletAddress = String(body.walletAddress ?? "").trim();

    if (!accessToken || !walletAddress) {
      return NextResponse.json(
        { error: "accessToken and walletAddress are required." },
        { status: 400 },
      );
    }

    const normalizedWallet = normalizeWalletAddress(walletAddress);
    const publicClient = createSupabaseServerClient();
    const admin = createSupabaseAdminClient();
    const { data: authData, error: authError } = await publicClient.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Supabase session is invalid." },
        { status: 401 },
      );
    }

    const userId = authData.user.id;
    const { data: existing, error: existingError } = await admin
      .from("wallet_identities")
      .select("user_id")
      .eq("wallet_address", normalizedWallet)
      .maybeSingle<WalletIdentityRow>();

    if (existingError) {
      throw existingError;
    }

    if (existing && existing.user_id !== userId) {
      return NextResponse.json(
        { error: "This wallet is already linked to another ArcPay account." },
        { status: 409 },
      );
    }

    const { error: upsertError } = await admin.from("wallet_identities").upsert(
      {
        wallet_address: normalizedWallet,
        user_id: userId,
      },
      { onConflict: "wallet_address" },
    );

    if (upsertError) {
      throw upsertError;
    }

    const { error: profileError } = await admin.from("user_profiles").upsert(
      {
        user_id: userId,
        notification_email: authData.user.email ?? "",
        linked_wallet_address: normalizedWallet,
        wallet_label: "Operations wallet",
      },
      { onConflict: "user_id" },
    );

    if (profileError) {
      throw profileError;
    }

    return NextResponse.json({ ok: true, walletAddress: normalizedWallet });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to link wallet." },
      { status: 400 },
    );
  }
}
