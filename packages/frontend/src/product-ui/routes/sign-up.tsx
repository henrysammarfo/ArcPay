import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Divider, Field, PasswordField, WalletConnectButton } from "@/components/auth/FormFields";
import { getSupabaseAuthMessage } from "../../app/auth-errors";
import { getOptionalSupabaseClient } from "../../app/supabase-client";
import { ensureCurrentUserAccount } from "@/lib/account";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Sign up - ArcPay" },
      { name: "description", content: "Create your ArcPay workspace." },
    ],
  }),
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");
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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          workspace,
        },
      },
    });

    if (error) {
      setStatus("error");
      setMessage(getSupabaseAuthMessage(error));
      return;
    }

    if (data.session) {
      await ensureCurrentUserAccount(supabase);
      navigate({ to: "/app/dashboard" });
      return;
    }

    setStatus("saved");
    setMessage("Workspace created. Check your email to confirm the account.");
  };

  return (
    <AuthShell
      heading="Spin up your workspace"
      subheading="Three steps to a treasury that thinks for your agents."
      steps={[
        { n: 1, t: "Connect a Solana wallet" },
        { n: 2, t: "Create your workspace" },
        { n: 3, t: "Set your first policy" },
      ]}
      activeStep={2}
    >
      <div>
        <h1 className="text-3xl font-medium tracking-tight" style={{ letterSpacing: "-0.03em" }}>
          Create your workspace
        </h1>
        <p className="text-muted-foreground text-sm mt-1.5">Wallet first, email backup.</p>
      </div>

      <WalletConnectButton />
      <Divider />

      <form className="space-y-4" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" placeholder="Ada" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
          <Field label="Last name" placeholder="Lovelace" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
        </div>
        <Field label="Workspace name" placeholder="Multi-agent agency" value={workspace} onChange={(event) => setWorkspace(event.target.value)} required />
        <Field label="Work email" type="email" placeholder="ada@studio.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <PasswordField hint="At least 8 characters." value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
        {message && <p className={`text-sm ${status === "error" ? "text-destructive" : "text-success"}`}>{message}</p>}
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-xl hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60"
        >
          {status === "loading" ? "Creating..." : "Create workspace"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already on ArcPay?{" "}
        <Link to="/sign-in" className="text-foreground font-medium hover:text-primary">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
