import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../../../supabase-server";
import { buildSyntheticWalletEmail, verifyWalletChallengeSignature } from "../../../wallet-auth";

export const runtime = "nodejs";

type WalletIdentityRow = {
  user_id: string;
  wallet_address: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      challengeToken?: string;
      signature?: string;
      walletAddress?: string;
    };
    const walletAddress = String(body.walletAddress ?? "").trim();
    const signature = String(body.signature ?? "").trim();
    const challengeToken = String(body.challengeToken ?? "").trim();

    if (!walletAddress || !signature || !challengeToken) {
      return NextResponse.json(
        { error: "walletAddress, signature, and challengeToken are required." },
        { status: 400 },
      );
    }

    const verifiedWallet = verifyWalletChallengeSignature({
      walletAddress,
      signature,
      challengeToken,
    });

    const admin = createSupabaseAdminClient();
    const publicClient = createSupabaseServerClient();

    const { data: existingRow, error: mappingError } = await admin
      .from("wallet_identities")
      .select("user_id, wallet_address")
      .eq("wallet_address", verifiedWallet)
      .maybeSingle<WalletIdentityRow>();

    if (mappingError) {
      throw mappingError;
    }

    let userId = existingRow?.user_id ?? null;
    let authEmail: string | null = null;
    let created = false;

    if (!userId) {
      const syntheticEmail = buildSyntheticWalletEmail(verifiedWallet);
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: {
          auth_method: "wallet",
          wallet_address: verifiedWallet,
        },
      });

      if (createError || !createdUser.user) {
        throw createError ?? new Error("Unable to create wallet-backed account.");
      }

      userId = createdUser.user.id;
      authEmail = createdUser.user.email ?? syntheticEmail;
      created = true;

      const { error: insertError } = await admin.from("wallet_identities").insert({
        wallet_address: verifiedWallet,
        user_id: userId,
      });

      if (insertError) {
        throw insertError;
      }
    }

    if (!authEmail) {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
      if (userError || !userData.user?.email) {
        throw userError ?? new Error("Wallet account does not have a login email.");
      }
      authEmail = userData.user.email;
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail,
    });

    if (linkError || !linkData.properties.email_otp) {
      throw linkError ?? new Error("Unable to generate wallet sign-in token.");
    }

    const { data: verifyData, error: verifyError } = await publicClient.auth.verifyOtp({
      email: authEmail,
      token: linkData.properties.email_otp,
      type: "magiclink",
    });

    if (verifyError || !verifyData.session) {
      throw verifyError ?? new Error("Unable to establish wallet-backed session.");
    }

    return NextResponse.json({
      created,
      session: {
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
      },
      user: {
        email: verifyData.user?.email ?? authEmail,
        id: verifyData.user?.id ?? userId,
      },
      walletAddress: verifiedWallet,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wallet sign-in failed." },
      { status: 400 },
    );
  }
}
