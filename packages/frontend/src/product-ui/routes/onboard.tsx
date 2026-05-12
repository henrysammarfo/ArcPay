"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Divider, WalletConnectButton } from "@/components/auth/FormFields";
import { useAppAccess } from "@/hooks/use-app-access";

export const Route = createFileRoute("/onboard")({
  head: () => ({
    meta: [
      { title: "Onboard - ArcPay" },
      { name: "description", content: "Create or enter your ArcPay workspace with wallet or email." },
    ],
  }),
  component: Onboard,
});

function Onboard() {
  const access = useAppAccess();

  return (
    <AuthShell
      heading="Enter ArcPay."
      subheading="Connect a wallet to create or resume your ArcPay account automatically, or use email if you already signed up."
      steps={[
        { n: 1, t: "Connect wallet or email" },
        { n: 2, t: "Create workspace" },
        { n: 3, t: "Open dashboard" },
      ]}
      activeStep={1}
    >
      <div>
        <h1 className="text-3xl font-medium tracking-tight" style={{ letterSpacing: "-0.03em" }}>
          Start with wallet or email
        </h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          Wallet sign-in creates or resumes one ArcPay account per wallet. Email sign-up stays separate unless you link it later from Profile.
        </p>
      </div>

      <WalletConnectButton redirectTo="/app/dashboard" />

      {access.signedIn && (
        <Link
          to="/app/dashboard"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground hover:brightness-110"
        >
          Continue to dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <Divider label="Or use email" />

      <div className="grid gap-3">
        <Link
          to="/sign-up"
          className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground hover:brightness-110"
        >
          Create workspace with email
        </Link>
        <Link
          to="/sign-in"
          className="flex h-12 items-center justify-center rounded-xl border border-border bg-background font-semibold text-foreground hover:bg-muted"
        >
          Sign in to existing workspace
        </Link>
      </div>
    </AuthShell>
  );
}
