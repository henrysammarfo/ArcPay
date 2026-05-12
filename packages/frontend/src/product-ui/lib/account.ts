import { getOptionalSupabaseClient } from "../../app/supabase-client";

type SupabaseClient = NonNullable<ReturnType<typeof getOptionalSupabaseClient>>;

export type AccountIdentity = {
  email: string | null;
  displayName: string;
  workspaceName: string;
};

export async function ensureCurrentUserAccount(supabase: SupabaseClient): Promise<AccountIdentity | null> {
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return null;

  const user = auth.user;
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const firstName = readMetadataString(metadata.first_name);
  const lastName = readMetadataString(metadata.last_name);
  const metadataName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const fallbackName = metadataName || readMetadataString(metadata.name) || user.email?.split("@")[0] || "ArcPay operator";
  const workspaceName = readMetadataString(metadata.workspace) || "Multi-agent agency";
  const walletAddress = readMetadataString(metadata.wallet_address);
  const notificationEmail = isWalletAuthEmail(user.email) ? "" : user.email ?? "";

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, notification_email, linked_wallet_address")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("user_profiles").upsert(
      {
        user_id: user.id,
        display_name: fallbackName,
        notification_email: notificationEmail,
        linked_wallet_address: walletAddress || null,
      },
      { onConflict: "user_id" },
    );
  } else if (!profile.linked_wallet_address && walletAddress) {
    await supabase.from("user_profiles").upsert(
      {
        user_id: user.id,
        display_name: profile.display_name || fallbackName,
        notification_email: profile.notification_email || notificationEmail,
        linked_wallet_address: walletAddress,
      },
      { onConflict: "user_id" },
    );
  }

  const { data: workspace } = await supabase
    .from("user_workspace_settings")
    .select("workspace_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!workspace) {
    await supabase.from("user_workspace_settings").upsert(
      {
        user_id: user.id,
        workspace_name: workspaceName,
      },
      { onConflict: "user_id" },
    );
  }

  return {
    email: user.email ?? null,
    displayName: profile?.display_name || fallbackName,
    workspaceName: workspace?.workspace_name || workspaceName,
  };
}

function readMetadataString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isWalletAuthEmail(value: string | null | undefined) {
  return Boolean(value && value.endsWith("@arcpay.local"));
}
