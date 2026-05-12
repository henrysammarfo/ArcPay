import { useMemo, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ensureCurrentUserAccount } from "@/lib/account";
import { getOptionalSupabaseClient } from "../../../app/supabase-client";

export function Field({
  label,
  hint,
  ...rest
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        {...rest}
        className="mt-1.5 w-full bg-muted border border-transparent rounded-xl h-11 px-4 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function PasswordField({
  label = "Password",
  hint,
  ...rest
}: ComponentProps<"input"> & { label?: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="relative mt-1.5">
        <input
          {...rest}
          type={show ? "text" : "password"}
          placeholder="••••••••"
          className="w-full bg-muted border border-transparent rounded-xl h-11 px-4 pr-11 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Toggle password visibility"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function WalletConnectButton({ redirectTo }: { redirectTo?: string }) {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const label = useMemo(() => {
    if (loading) return "Verifying wallet...";
    if (wallet.connected && wallet.publicKey) {
      const address = wallet.publicKey.toBase58();
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
    return wallet.wallet?.adapter.name ? `Continue with ${wallet.wallet.adapter.name}` : "Connect Solana wallet";
  }, [loading, wallet.connected, wallet.publicKey, wallet.wallet]);

  async function connectAndSignIn() {
    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setErrorMessage("Supabase auth is not configured for this frontend runtime.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      if (!wallet.wallet) {
        setVisible(true);
        return;
      }

      if (!wallet.connected) {
        await wallet.connect();
      }

      const publicKey = wallet.publicKey?.toBase58();
      if (!publicKey) {
        throw new Error("Wallet did not expose a public key after connect.");
      }

      if (!wallet.signMessage) {
        throw new Error("This wallet does not support message signing for wallet auth.");
      }

      const challengeResponse = await fetch("/api/wallet-auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: publicKey }),
      });
      const challengeBody = (await challengeResponse.json()) as {
        challengeToken?: string;
        error?: string;
        message?: string;
      };
      if (!challengeResponse.ok || !challengeBody.challengeToken || !challengeBody.message) {
        throw new Error(challengeBody.error ?? "Unable to request wallet auth challenge.");
      }

      const messageBytes = new TextEncoder().encode(challengeBody.message);
      const signatureBytes = await wallet.signMessage(messageBytes);
      const verifyResponse = await fetch("/api/wallet-auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeToken: challengeBody.challengeToken,
          signature: bytesToBase64(signatureBytes),
          walletAddress: publicKey,
        }),
      });
      const verifyBody = (await verifyResponse.json()) as {
        error?: string;
        session?: {
          access_token: string;
          refresh_token: string;
        };
      };
      if (!verifyResponse.ok || !verifyBody.session) {
        throw new Error(verifyBody.error ?? "Wallet sign-in failed.");
      }

      const { error: sessionError } = await supabase.auth.setSession(verifyBody.session);
      if (sessionError) {
        throw sessionError;
      }

      await ensureCurrentUserAccount(supabase);

      if (redirectTo) {
        router.replace(redirectTo);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Wallet sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void connectAndSignIn()}
        disabled={loading}
        className="w-full h-12 bg-foreground text-background rounded-xl flex items-center justify-center gap-2 font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        <span className="w-2 h-2 rounded-full bg-primary" />
        {label}
      </button>
      {errorMessage && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

function bytesToBase64(value: Uint8Array) {
  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function Divider({ label = "Or with email" }: { label?: string }) {
  return (
    <div className="relative my-2">
      <div className="border-t border-border" />
      <span className="absolute left-1/2 -translate-x-1/2 -top-2 bg-background px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
        {label}
      </span>
    </div>
  );
}
