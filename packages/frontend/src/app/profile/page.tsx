"use client";

import type { InputHTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { UserRound, Wallet } from "lucide-react";
import { ProductAppShell } from "../product-render";
import { PageHeader } from "../../product-ui/components/app/PageHeader";
import { useWalletConnectAction } from "../../product-ui/hooks/use-wallet-connect-action";
import { getOptionalSupabaseClient } from "../supabase-client";

type ProfileForm = {
  displayName: string;
  role: string;
  notificationEmail: string;
  walletLabel: string;
  linkedWalletAddress: string;
  loginEmail: string;
  loginPassword: string;
};

const EMPTY_PROFILE: ProfileForm = {
  displayName: "",
  role: "",
  notificationEmail: "",
  walletLabel: "Operations wallet",
  linkedWalletAddress: "",
  loginEmail: "",
  loginPassword: "",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState("Sign in to sync this profile across devices.");
  const [authStatus, setAuthStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [authSaving, setAuthSaving] = useState(false);
  const wallet = useWallet();
  const walletAction = useWalletConnectAction();
  const walletAddress = wallet.publicKey?.toBase58() ?? "";

  useEffect(() => {
    const supabase = getOptionalSupabaseClient();
    let mounted = true;

    async function load() {
      if (!supabase) {
        setStatus("Supabase env is not configured in this frontend runtime.");
        return;
      }
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!mounted) return;

      setUserId(user?.id ?? null);
      setEmail(user?.email ?? null);

      if (!user) {
        setProfile(EMPTY_PROFILE);
        return;
      }

      const { data: row, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setStatus(`Profile load failed: ${error.message}`);
        return;
      }

      setProfile({
        displayName: row?.display_name ?? "",
        role: row?.role ?? "Founder / finance lead",
        notificationEmail: row?.notification_email || (isWalletAuthEmail(user.email) ? "" : user.email || ""),
        walletLabel: row?.wallet_label || "Operations wallet",
        linkedWalletAddress: row?.linked_wallet_address ?? walletAddress,
        loginEmail: isWalletAuthEmail(user.email) ? "" : user.email ?? "",
        loginPassword: "",
      });
      setStatus("Profile loaded.");
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [walletAddress]);

  function update(key: keyof ProfileForm, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile() {
    if (!userId) {
      setStatus("Sign in first, then save your profile.");
      return;
    }

    setSaving(true);
    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setSaving(false);
      setStatus("Supabase env is not configured in this frontend runtime.");
      return;
    }
    const linkedWalletAddress = walletAddress || profile.linkedWalletAddress || null;
    const { error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: userId,
          display_name: profile.displayName,
          role: profile.role,
          notification_email: profile.notificationEmail || email || "",
          wallet_label: profile.walletLabel,
          linked_wallet_address: linkedWalletAddress,
        },
        { onConflict: "user_id" },
      );

    setSaving(false);

    if (error) {
      setStatus(`Profile save failed: ${error.message}`);
      return;
    }

    setProfile((current) => ({
      ...current,
      linkedWalletAddress: linkedWalletAddress ?? "",
    }));
    setStatus("Profile saved. Wallet link and operator details are synced.");
  }

  async function saveLoginIdentity() {
    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setAuthStatus("Supabase env is not configured in this frontend runtime.");
      return;
    }

    if (!profile.loginEmail.trim()) {
      setAuthStatus("Enter a login email to link email sign-in.");
      return;
    }

    if (profile.loginPassword.trim().length < 8) {
      setAuthStatus("Set a login password with at least 8 characters.");
      return;
    }

    setAuthSaving(true);
    const { error } = await supabase.auth.updateUser({
      email: profile.loginEmail.trim(),
      password: profile.loginPassword,
    });
    setAuthSaving(false);

    if (error) {
      setAuthStatus(error.message);
      return;
    }

    setEmail(profile.loginEmail.trim());
    setProfile((current) => ({ ...current, loginPassword: "" }));
    setAuthStatus("Login email updated. Check your inbox if Supabase requires email confirmation.");
  }

  return (
    <ProductAppShell>
      <PageHeader
        icon={UserRound}
        eyebrow="Workspace"
        title="Profile"
        description="Manage the operator identity attached to approvals, audit keys, and wallet activity."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="text-sm font-medium">Operator profile</div>
          <div className="text-xs text-muted-foreground mt-0.5 mb-5">
            These details are visible to workspace members during approval flows.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Display name" value={profile.displayName} onChange={(e) => update("displayName", e.target.value)} placeholder="Ada Treasury Operator" />
            <Field label="Role" value={profile.role} onChange={(e) => update("role", e.target.value)} placeholder="Founder / finance lead" />
            <Field label="Notification email" type="email" value={profile.notificationEmail} onChange={(e) => update("notificationEmail", e.target.value)} placeholder="ops@company.com" />
            <Field label="Public wallet label" value={profile.walletLabel} onChange={(e) => update("walletLabel", e.target.value)} placeholder="Operations wallet" />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              disabled={saving}
              onClick={() => void saveProfile()}
              type="button"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
            <span className="text-xs text-muted-foreground">{status}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Linked wallet</div>
              <div className="text-xs text-muted-foreground mt-0.5">Used for signing actions and syncing network state.</div>
            </div>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="mt-5 rounded-xl bg-muted p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Current wallet</div>
            <div className="mt-2 font-mono text-sm break-all">
              {walletAddress || profile.linkedWalletAddress || "No wallet linked yet"}
            </div>
          </div>

          <button
            className="mt-4 w-full rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:brightness-110 disabled:opacity-60"
            onClick={() => void walletAction.connectWallet()}
            disabled={walletAction.connecting}
            type="button"
          >
            {walletAddress ? "Change wallet" : walletAction.label === "Connect" ? "Connect wallet" : walletAction.label}
          </button>

          {walletAction.errorMessage && (
            <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {walletAction.errorMessage}
            </div>
          )}

          <div className="mt-5 space-y-3 text-sm">
            <Row label="Email session" value={email ? "Signed in" : "Not signed in"} />
            <Row label="Policy changes" value="Required" />
            <Row label="Viewing keys" value="Required" />
            <Row label="Session status" value={walletAddress ? "Wallet linked" : "Wallet gated"} />
          </div>
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-medium">Login methods</div>
          <div className="text-xs text-muted-foreground mt-0.5 mb-5">
            Wallet sign-in creates an ArcPay account automatically. Add an email and password here if you also want email login on the same account.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Login email"
              type="email"
              value={profile.loginEmail}
              onChange={(e) => update("loginEmail", e.target.value)}
              placeholder="founder@company.com"
            />
            <Field
              label="Login password"
              type="password"
              value={profile.loginPassword}
              onChange={(e) => update("loginPassword", e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-medium hover:brightness-110 disabled:opacity-50"
              disabled={authSaving}
              onClick={() => void saveLoginIdentity()}
              type="button"
            >
              {authSaving ? "Linking..." : "Link email login"}
            </button>
            <span className="text-xs text-muted-foreground">
              {authStatus || (isWalletAuthEmail(email) ? "Wallet-only account detected." : "Email login already linked or ready to update.")}
            </span>
          </div>
        </div>
      </div>
    </ProductAppShell>
  );
}

function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { readonly label: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        {...props}
        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function isWalletAuthEmail(value: string | null | undefined) {
  return Boolean(value && value.endsWith("@arcpay.local"));
}
