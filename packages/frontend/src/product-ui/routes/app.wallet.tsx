"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  CheckCircle2,
  Coins,
  Copy,
  ExternalLink,
  Loader2,
  Network,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { NetworkBadge } from "@/components/primitives/NetworkBadge";
import { StatCard } from "@/components/primitives/StatCard";
import { useWalletConnectAction } from "@/hooks/use-wallet-connect-action";
import { useNetwork } from "@/store/network";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

type TokenAccountRow = {
  account: string;
  mint: string;
  decimals: number;
  uiAmount: string;
  rawAmount: string;
};

type LoadState = "idle" | "loading" | "ready" | "error";

export const Route = createFileRoute("/app/wallet")({
  head: () => ({ meta: [{ title: "Wallet - ArcPay" }] }),
  component: WalletPage,
});

function WalletPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const walletAction = useWalletConnectAction();
  const mode = useNetwork((state) => state.mode);
  const setMode = useNetwork((state) => state.setMode);
  const [status, setStatus] = useState<LoadState>("idle");
  const [message, setMessage] = useState<string>("");
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokenAccounts, setTokenAccounts] = useState<TokenAccountRow[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const address = wallet.publicKey?.toBase58() ?? "";
  const shortAddress = useMemo(() => shortenAddress(address), [address]);
  const endpoint = (connection as { rpcEndpoint?: string }).rpcEndpoint ?? (mode === "mainnet" ? "Mainnet RPC" : "Devnet RPC");

  const loadBalances = useCallback(async () => {
    if (!wallet.publicKey) {
      setStatus("idle");
      setMessage("Connect a Solana wallet to read live balances from the selected network.");
      setSolBalance(null);
      setTokenAccounts([]);
      return;
    }

    setStatus("loading");
    setMessage("Reading wallet balances from Solana...");

    try {
      const [lamports, parsedTokens] = await Promise.all([
        connection.getBalance(wallet.publicKey, "confirmed"),
        connection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM_ID }, "confirmed"),
      ]);

      const rows = parsedTokens.value
        .map(({ pubkey, account }) => {
          const parsed = account.data.parsed as {
            info?: {
              mint?: string;
              tokenAmount?: {
                amount?: string;
                decimals?: number;
                uiAmountString?: string;
              };
            };
          };
          const tokenAmount = parsed.info?.tokenAmount;

          if (!parsed.info?.mint || !tokenAmount?.amount) {
            return null;
          }

          return {
            account: pubkey.toBase58(),
            mint: parsed.info.mint,
            decimals: tokenAmount.decimals ?? 0,
            uiAmount: tokenAmount.uiAmountString ?? tokenAmount.amount,
            rawAmount: tokenAmount.amount,
          };
        })
        .filter((row): row is TokenAccountRow => Boolean(row))
        .sort((a, b) => Number(b.rawAmount !== "0") - Number(a.rawAmount !== "0"));

      setSolBalance(lamports / LAMPORTS_PER_SOL);
      setTokenAccounts(rows);
      setStatus("ready");
      setMessage(`Live balances loaded from ${mode === "mainnet" ? "mainnet-beta" : "devnet"}.`);
    } catch (error) {
      setStatus("error");
      const baseMessage = error instanceof Error ? error.message : "Unable to load wallet balances.";
      if (mode === "mainnet" && /403|forbidden/i.test(baseMessage)) {
        setMessage("Mainnet RPC rejected the request. Set NEXT_PUBLIC_MAINNET_RPC_URL in Vercel to a real Solana mainnet endpoint such as your QuickNode mainnet URL.");
      } else {
        setMessage(baseMessage);
      }
      setSolBalance(null);
      setTokenAccounts([]);
    }
  }, [connection, mode, wallet.publicKey]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  async function copy(value: string, label: string) {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div>
      <PageHeader
        icon={Wallet}
        eyebrow="Wallet Control"
        title="Wallet"
        description="Connect a wallet, verify balances, inspect SPL token accounts, and choose the Solana network used by ArcPay actions."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMode(mode === "mainnet" ? "devnet" : "mainnet")}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Switch to {mode === "mainnet" ? "Devnet" : "Mainnet"}
            </button>
            <button
              type="button"
              onClick={() => void loadBalances()}
              disabled={status === "loading"}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Connected Wallet <NetworkBadge />
              </div>
              <h2 className="mt-3 text-2xl font-medium tracking-tight">
                {wallet.connected && address ? shortAddress : "No wallet connected"}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {wallet.connected
                  ? "ArcPay reads this wallet directly from the selected Solana network. Actions that move funds still require your wallet signature."
                  : "Connect Solflare or Phantom to load live balances and enable wallet-linked profile storage."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void walletAction.connectWallet()}
              disabled={walletAction.connecting}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:bg-foreground/85"
            >
              {wallet.connected ? "Change wallet" : walletAction.label === "Connect" ? "Connect wallet" : walletAction.label}
            </button>
          </div>

          {walletAction.errorMessage && (
            <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {walletAction.errorMessage}
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <DetailRow
              label="Wallet address"
              value={address || "Not connected"}
              action={
                address ? (
                  <button type="button" onClick={() => void copy(address, "address")} className="text-muted-foreground hover:text-foreground">
                    {copied === "address" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                ) : null
              }
            />
            <DetailRow label="Wallet adapter" value={wallet.wallet?.adapter.name ?? "None"} />
            <DetailRow label="Active network" value={mode === "mainnet" ? "Solana mainnet-beta" : "Solana devnet"} />
            <DetailRow label="RPC endpoint" value={endpoint} />
          </div>

          {message && (
            <div
              className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                status === "error"
                  ? "border-destructive/25 bg-destructive/10 text-destructive"
                  : "border-border bg-muted/50 text-muted-foreground"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                {message}
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="SOL balance"
            value={solBalance === null ? "--" : formatNumber(solBalance, 6)}
            hint={wallet.connected ? "Loaded from the active RPC connection." : "Connect wallet to load."}
            icon={Coins}
            emphasis
          />
          <StatCard
            label="SPL token accounts"
            value={wallet.connected ? tokenAccounts.length : "--"}
            hint="Parsed token accounts under the connected wallet."
            icon={Network}
          />
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium">Token accounts</h3>
              <p className="text-sm text-muted-foreground">Real SPL token accounts returned by Solana RPC for the connected wallet.</p>
            </div>
            {address && (
              <a
                href={explorerUrl(address, mode)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                View wallet <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border">
            <div className="hidden grid-cols-[1.3fr_1.3fr_0.7fr_0.8fr] gap-4 bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:grid">
              <span>Mint</span>
              <span>Token account</span>
              <span>Decimals</span>
              <span className="text-right">Balance</span>
            </div>

            {status === "loading" ? (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading token accounts...
              </div>
            ) : tokenAccounts.length > 0 ? (
              <div className="divide-y divide-border">
                {tokenAccounts.map((token) => (
                  <div key={token.account} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.3fr_1.3fr_0.7fr_0.8fr] md:items-center">
                    <AddressCell label="Mint" value={token.mint} mode={mode} />
                    <AddressCell label="Token account" value={token.account} mode={mode} />
                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground md:hidden">Decimals</div>
                      <div className="font-medium">{token.decimals}</div>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground md:hidden">Balance</div>
                      <div className="font-medium">{token.uiAmount}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-sm text-muted-foreground">
                {wallet.connected
                  ? "No SPL token accounts were found for this wallet on the selected network."
                  : "Connect a wallet to load token accounts."}
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-3xl border border-border bg-surface-dark p-6 text-surface-dark-foreground shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
            <ShieldCheck className="h-5 w-5 text-white/80" />
          </div>
          <h3 className="mt-5 text-xl font-medium tracking-tight">Network-safe testing</h3>
          <p className="mt-2 text-sm text-white/55">
            Devnet mode is for Cloak, Ika, and free faucet-backed proofs. Mainnet mode is for final partner proofs that require real SOL or stablecoin
            liquidity.
          </p>
          <div className="mt-5 space-y-3 text-sm">
            <a
              href="https://faucet.solana.com/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 transition hover:bg-white/10"
            >
              Solana devnet faucet <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href="https://devnet.cloak.ag/privacy/faucet"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 transition hover:bg-white/10"
            >
              Cloak mock USDC faucet <ExternalLink className="h-4 w-4" />
            </a>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/55">
              Mainnet actions remain signer-gated. ArcPay never moves funds without wallet approval.
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function DetailRow({ label, value, action }: { label: string; value: string; action?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-muted/35 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-foreground">{value}</span>
        {action}
      </div>
    </div>
  );
}

function AddressCell({ label, value, mode }: { label: string; value: string; mode: "devnet" | "mainnet" }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground md:hidden">{label}</div>
      <a href={explorerUrl(value, mode)} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 hover:text-primary">
        <span className="truncate font-medium">{shortenAddress(value)}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </a>
    </div>
  );
}

function explorerUrl(address: string, mode: "devnet" | "mainnet") {
  const cluster = mode === "devnet" ? "?cluster=devnet" : "";
  return `https://solscan.io/account/${address}${cluster}`;
}

function shortenAddress(value: string) {
  if (!value) return "";
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatNumber(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}
