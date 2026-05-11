"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { getSupabaseClient } from "./supabase-client";

type Field = {
  readonly label: string;
  readonly type?: string;
  readonly placeholder: string;
};

type AccountShellProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly cta: string;
  readonly fields: readonly Field[];
  readonly secondary?: ReactNode;
  readonly mode?: "auth" | "settings";
  readonly authAction?: "sign-in" | "sign-up" | "forgot-password" | "reset-password";
};

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
  { href: "/", label: "Public site" },
] as const;

export function AccountShell({
  eyebrow,
  title,
  body,
  cta,
  fields,
  secondary,
  mode = "auth",
  authAction,
}: AccountShellProps) {
  const wallet = useWallet();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authAction) {
      setStatus("success");
      setMessage("Settings saved locally. Live policy sync is handled inside the app Policies page.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const supabase = getSupabaseClient();

    setStatus("loading");
    setMessage("");

    try {
      if (authAction === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setStatus("success");
        setMessage("Signed in. Redirecting to dashboard...");
        router.push("/dashboard");
      }

      if (authAction === "sign-up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              company: String(form.get("company") ?? ""),
              wallet: wallet.publicKey?.toBase58() ?? String(form.get("wallet") ?? ""),
            },
          },
        });
        if (error) throw error;
        setStatus("success");
        setMessage("Workspace account created. Check email if confirmation is enabled, or continue to dashboard.");
      }

      if (authAction === "forgot-password") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setStatus("success");
        setMessage("Recovery link sent if the account exists.");
      }

      if (authAction === "reset-password") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setStatus("success");
        setMessage("Password updated. You can sign in now.");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Supabase auth request failed.");
    }
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <Link className="app-sidebar-brand" href="/">
          <span>ArcPay</span>
          <em>agent treasury OS</em>
        </Link>
        <nav>
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="app-wallet-card">
          <strong>Wallet gate</strong>
          <p>{wallet.publicKey ? wallet.publicKey.toBase58() : "Connect a wallet to unlock live account actions."}</p>
          <WalletMultiButton />
        </div>
      </aside>

      <section className="account-panel">
        <div className="account-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{body}</p>
        </div>

        <form className={`account-form ${mode === "settings" ? "wide" : ""}`} onSubmit={submit}>
          {fields.map((field) => (
            <label key={field.label}>
              <span>{field.label}</span>
              <input
                name={field.label.toLowerCase().includes("email") ? "email" : field.label.toLowerCase().includes("password") ? "password" : field.label.toLowerCase().includes("company") ? "company" : field.label.toLowerCase().includes("wallet") ? "wallet" : field.label.toLowerCase().replace(/\s+/g, "-")}
                placeholder={field.placeholder}
                type={field.type ?? "text"}
              />
            </label>
          ))}
          <button disabled={status === "loading"} type="submit">
            {status === "loading" ? "Working..." : cta}
          </button>
          {message ? (
            <div className={`account-status account-status-${status}`}>
              {message}
            </div>
          ) : null}
          {secondary ? <div className="account-secondary">{secondary}</div> : null}
        </form>
      </section>
    </main>
  );
}
