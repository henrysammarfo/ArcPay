import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/auth/FormFields";
import { getOptionalSupabaseClient } from "../../app/supabase-client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Forgot password - ArcPay" }],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
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

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Reset link sent. Check your email.");
  };

  return (
    <AuthShell heading="Reset your password" subheading="We'll email you a link to set a new one.">
      <div>
        <h1 className="text-3xl font-medium tracking-tight" style={{ letterSpacing: "-0.03em" }}>
          Forgot password
        </h1>
        <p className="text-muted-foreground text-sm mt-1.5">Enter the email on your workspace.</p>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Work email" type="email" placeholder="ada@studio.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        {message && <p className={`text-sm ${status === "error" ? "text-destructive" : "text-success"}`}>{message}</p>}
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-60"
        >
          {status === "loading" ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link to="/sign-in" className="text-foreground font-medium hover:text-primary">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
