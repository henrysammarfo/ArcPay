import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/FormFields";
import { getOptionalSupabaseClient } from "../../app/supabase-client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset password - ArcPay" }],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");

    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setStatus("error");
      setMessage("Supabase auth is not configured for this frontend runtime.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    navigate({ to: "/app/dashboard" });
  };

  return (
    <AuthShell heading="Set a new password" subheading="Choose something you'll remember.">
      <div>
        <h1 className="text-3xl font-medium tracking-tight" style={{ letterSpacing: "-0.03em" }}>
          New password
        </h1>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <PasswordField label="New password" hint="At least 8 characters." value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
        <PasswordField label="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
        {message && <p className="text-sm text-destructive">{message}</p>}
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-60"
        >
          {status === "loading" ? "Updating..." : "Update password"}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/sign-in" className="text-foreground font-medium hover:text-primary">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
