import { Link } from "@tanstack/react-router";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Search, Wallet, ChevronDown, Building2, UserRound, Settings, LogOut, ShieldCheck } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNetwork } from "@/store/network";
import { CommandPalette } from "./CommandPalette";
import { getOptionalSupabaseClient } from "../../../app/supabase-client";
import { useWalletConnectAction } from "@/hooks/use-wallet-connect-action";
import { ensureCurrentUserAccount } from "@/lib/account";

export function AppTopBar() {
  const router = useRouter();
  const mode = useNetwork((s) => s.mode);
  const setMode = useNetwork((s) => s.setMode);
  const [openCmd, setOpenCmd] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [workspaceName, setWorkspaceName] = useState("Multi-agent agency");
  const wallet = useWallet();
  const walletAction = useWalletConnectAction();
  const walletAddress = wallet.publicKey?.toBase58() ?? null;

  useEffect(() => {
    const supabase = getOptionalSupabaseClient();
    let mounted = true;

    async function loadAccount() {
      if (!supabase) return;
      const account = await ensureCurrentUserAccount(supabase);
      if (!mounted) return;
      if (!account) {
        setEmail(null);
        setDisplayName("");
        setWorkspaceName("Multi-agent agency");
        return;
      }
      setEmail(account.email);
      setDisplayName(account.displayName);
      setWorkspaceName(account.workspaceName);
    }

    void loadAccount();

    const { data: listener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      if (!session?.user) {
        setDisplayName("");
        setWorkspaceName("Multi-agent agency");
      }
      else void loadAccount();
    }) ?? { data: { subscription: { unsubscribe: () => undefined } } };

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!walletAddress) return;

    const supabase = getOptionalSupabaseClient();
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;

    async function linkWallet() {
      const { data } = await client.auth.getUser();
      const user = data.user;
      if (!user || cancelled) return;

      await client
        .from("user_profiles")
        .upsert(
          {
            user_id: user.id,
            notification_email: user.email ?? "",
            linked_wallet_address: walletAddress,
            wallet_label: "Operations wallet",
          },
          { onConflict: "user_id" },
        );
    }

    void linkWallet();

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  async function signOut() {
    const supabase = getOptionalSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    setEmail(null);
    setDisplayName("");
    setWorkspaceName("Multi-agent agency");
    router.push("/");
  }

  async function disconnectWallet() {
    if (wallet.connected) await wallet.disconnect();
    if (!email) router.push("/");
  }

  return (
    <>
      <header className="h-14 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20 flex items-center px-3 gap-3">
        <SidebarTrigger className="ml-1" />

        {/* Workspace switcher */}
        <button
          type="button"
          className="hidden sm:flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span>{workspaceName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        <div className="flex-1" />

        {/* Network switch */}
        <div className="hidden md:inline-flex items-center bg-muted rounded-full p-1">
          {(["devnet", "mainnet"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`text-xs font-semibold px-3 py-1 rounded-full capitalize transition-all ${
                mode === m
                  ? m === "mainnet"
                    ? "bg-success text-success-foreground"
                    : "bg-warning text-warning-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Wallet pill */}
        <button
          type="button"
          onClick={() => void walletAction.connectWallet()}
          disabled={walletAction.connecting}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-sm font-medium transition-colors"
        >
          <Wallet className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono text-xs">{walletAction.label}</span>
        </button>

        {/* Search */}
        <button
          type="button"
          onClick={() => setOpenCmd(true)}
          className="hidden lg:inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted hover:bg-muted/70 px-3 py-1.5 rounded-lg"
        >
          <Search className="w-4 h-4" />
          <span>Jump to…</span>
          <kbd className="ml-2 text-[10px] font-mono bg-background border border-border px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>

        <button type="button" className="relative w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-semibold text-black" type="button">
              {initial(displayName || email)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
            <DropdownMenuLabel>
              <div className="text-sm">{displayName || "ArcPay operator"}</div>
              <div className="text-xs font-normal text-muted-foreground truncate">{email ?? "Sign in to sync workspace settings"}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile"><UserRound className="w-4 h-4" /> Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings"><Settings className="w-4 h-4" /> Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/policies"><ShieldCheck className="w-4 h-4" /> Policies</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {wallet.connected && (
              <DropdownMenuItem onSelect={() => void disconnectWallet()}>
                <Wallet className="w-4 h-4" /> Disconnect wallet
              </DropdownMenuItem>
            )}
            {email ? (
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut className="w-4 h-4" /> Sign out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link to="/sign-in"><LogOut className="w-4 h-4" /> Sign in</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <CommandPalette open={openCmd} onOpenChange={setOpenCmd} />
    </>
  );
}

function initial(value: string | null) {
  return (value?.trim()[0] ?? "A").toUpperCase();
}
