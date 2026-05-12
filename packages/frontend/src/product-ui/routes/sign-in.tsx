import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Divider, Field, PasswordField, WalletConnectButton } from "@/components/auth/FormFields";
import { getSupabaseAuthMessage } from "../../app/auth-errors";
import { getOptionalSupabaseClient } from "../../app/supabase-client";
import { ensureCurrentUserAccount } from "@/lib/account";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in - ArcPay" },
      { name: "description", content: "Sign in to your ArcPay workspace." },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setStatus("error");
      setMessage("Supabase auth is not configured for this frontend runtime.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("error");
      setMessage(getSupabaseAuthMessage(error));
      return;
    }

    await ensureCurrentUserAccount(supabase);
    navigate({ to: "/app/dashboard" });
  };

  return (
    <AuthShell
      heading="Welcome back."
      subheading="Connect your wallet, or sign in with email and we'll prompt for the wallet on the next step."
    >
      <div>
        <h1 className="text-3xl font-medium tracking-tight" style={{ letterSpacing: "-0.03em" }}>
          Sign in
        </h1>
        <p className="text-muted-foreground text-sm mt-1.5">Pick a method.</p>
      </div>

      <WalletConnectButton />
      <Divider />

      <form className="space-y-4" onSubmit={submit}>
        <Field label="Work email" type="email" placeholder="ada@studio.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <PasswordField value={password} onChange={(event) => setPassword(event.target.value)} required />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        </div>
        {message && <p className="text-sm text-destructive">{message}</p>}
        <button
          type="submit"
          disabled={status === "loading"}
          className="block text-center w-full h-12 leading-[3rem] bg-primary text-primary-foreground font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-60"
        >
          {status === "loading" ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to ArcPay?{" "}
        <Link to="/sign-up" className="text-foreground font-medium hover:text-primary">
          Create a workspace
        </Link>
      </p>
    </AuthShell>
  );
}
