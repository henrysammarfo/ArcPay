import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useWalletConnectAction } from "@/hooks/use-wallet-connect-action";

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

export function WalletConnectButton() {
  const walletAction = useWalletConnectAction();

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void walletAction.connectWallet()}
        disabled={walletAction.connecting}
        className="w-full h-12 bg-foreground text-background rounded-xl flex items-center justify-center gap-2 font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        <span className="w-2 h-2 rounded-full bg-primary" />
        {walletAction.connected && walletAction.publicKeyBase58
          ? walletAction.label
          : walletAction.label === "Connect"
            ? "Connect Solana wallet"
            : walletAction.label}
      </button>
      {walletAction.errorMessage && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {walletAction.errorMessage}
        </div>
      )}
    </div>
  );
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
