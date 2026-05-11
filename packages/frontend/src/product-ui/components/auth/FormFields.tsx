import { useState, type ComponentProps } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Eye, EyeOff } from "lucide-react";

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
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="w-full h-12 bg-foreground text-background rounded-xl flex items-center justify-center gap-2 font-semibold hover:opacity-90 transition-opacity"
    >
      <span className="w-2 h-2 rounded-full bg-primary" />
      {connected && publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : "Connect Solana wallet"}
    </button>
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
