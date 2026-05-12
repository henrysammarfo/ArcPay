import { createFileRoute, Link } from "@tanstack/react-router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  Lock,
  Route as RouteIcon,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { NetworkBadge } from "@/components/primitives/NetworkBadge";
import { StatCard } from "@/components/primitives/StatCard";
import { ensureCurrentUserAccount } from "@/lib/account";
import { useNetwork } from "@/store/network";
import { getOptionalSupabaseClient } from "../../app/supabase-client";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Overview - ArcPay" }] }),
  component: Dashboard,
});

type DashboardActivity = {
  id: string;
  kind: "in" | "out" | "swap" | "yield";
  who: string;
  amt: string;
  time: string;
  net: string;
  amount: number;
  direction: "in" | "out";
  createdAt: string;
};

type ApprovalRow = {
  who: string;
  amt: string;
  risk: "Approve" | "Review";
};

type AlertRow = {
  who: string;
  txt: string;
  level: "warn" | "info";
};

type FlowPoint = {
  t: string;
  in: number;
  out: number;
};

function Dashboard() {
  const mode = useNetwork((state) => state.mode);
  const { connection } = useConnection();
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);
  const [displayName, setDisplayName] = useState("ArcPay operator");
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokenAccountCount, setTokenAccountCount] = useState<number | null>(null);
  const [tokenTotal, setTokenTotal] = useState<number | null>(null);
  const [activity, setActivity] = useState<DashboardActivity[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const empty = !wallet.connected || !wallet.publicKey;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      if (!wallet.publicKey) {
        setSolBalance(null);
        setTokenAccountCount(null);
        setTokenTotal(null);
        return;
      }

      const [lamports, parsed] = await Promise.all([
        connection.getBalance(wallet.publicKey, "confirmed"),
        connection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM_ID }, "confirmed"),
      ]);

      if (cancelled) return;

      const balances = parsed.value
        .map((account) => account.account.data.parsed.info.tokenAmount.uiAmount)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

      setSolBalance(lamports / 1_000_000_000);
      setTokenAccountCount(parsed.value.length);
      setTokenTotal(balances.reduce((total, value) => total + value, 0));
    }

    void loadWallet().catch(() => {
      if (!cancelled) {
        setSolBalance(null);
        setTokenAccountCount(null);
        setTokenTotal(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [connection, wallet.publicKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceData() {
      setLoading(true);
      const supabase = getOptionalSupabaseClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const account = await ensureCurrentUserAccount(supabase);
      if (!account) {
        if (!cancelled) setLoading(false);
        return;
      }

      if (!cancelled) {
        setDisplayName(account.displayName || account.email?.split("@")[0] || "ArcPay operator");
      }

      const [payments, invoices, privacy, contractors] = await Promise.all([
        supabase.from("arcpay_payment_requests").select("id, amount, token, memo, route_to, status, created_at").eq("network", mode).order("created_at", { ascending: false }).limit(20),
        supabase.from("arcpay_invoices").select("id, client, amount, token, status, created_at").eq("network", mode).order("created_at", { ascending: false }).limit(20),
        supabase.from("arcpay_privacy_events").select("id, action, provider, amount, token, status, created_at").eq("network", mode).order("created_at", { ascending: false }).limit(20),
        supabase.from("arcpay_contractors").select("id, name, wallet, risk_score, risk_status, created_at").eq("network", mode).order("created_at", { ascending: false }).limit(20),
      ]);

      if (cancelled) return;

      const rows: DashboardActivity[] = [
        ...(payments.data ?? []).map((row) => ({
          id: `payment-${row.id}`,
          kind: "in" as const,
          who: row.memo || row.route_to || "Payment request",
          amt: `+ ${formatAmount(Number(row.amount), row.token)}`,
          time: relativeTime(row.created_at),
          net: mode,
          amount: Number(row.amount),
          direction: "in" as const,
          createdAt: row.created_at,
        })),
        ...(invoices.data ?? []).map((row) => ({
          id: `invoice-${row.id}`,
          kind: "in" as const,
          who: `Invoice - ${row.client}`,
          amt: `+ ${formatAmount(Number(row.amount), row.token)}`,
          time: relativeTime(row.created_at),
          net: mode,
          amount: Number(row.amount),
          direction: "in" as const,
          createdAt: row.created_at,
        })),
        ...(privacy.data ?? []).map((row) => ({
          id: `privacy-${row.id}`,
          kind: row.action === "shield" ? ("out" as const) : ("swap" as const),
          who: `${row.provider} - ${row.action}`,
          amt: row.amount ? formatAmount(Number(row.amount), row.token) : "viewing key",
          time: relativeTime(row.created_at),
          net: mode,
          amount: row.amount ? Number(row.amount) : 0,
          direction: row.action === "shield" ? ("out" as const) : ("in" as const),
          createdAt: row.created_at,
        })),
      ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

      setActivity(rows.slice(0, 8));
      setApprovals([
        ...(payments.data ?? [])
          .filter((row) => row.status === "pending")
          .slice(0, 4)
          .map((row) => ({
            who: row.memo || "Pending payment request",
            amt: formatAmount(Number(row.amount), row.token),
            risk: "Review" as const,
          })),
        ...(privacy.data ?? [])
          .filter((row) => row.status === "ready_to_sign" || row.status === "pending")
          .slice(0, 4)
          .map((row) => ({
            who: `${row.provider} ${row.action}`,
            amt: row.amount ? formatAmount(Number(row.amount), row.token) : "viewing key",
            risk: "Review" as const,
          })),
      ].slice(0, 5));
      setAlerts((contractors.data ?? [])
        .filter((row) => row.risk_status === "review" || row.risk_status === "reject" || row.risk_score < 60)
        .slice(0, 5)
        .map((row) => ({
          who: row.name || shortAddress(row.wallet),
          txt: `GoldRush score ${row.risk_score}/100 is ${row.risk_status}. Policy should review before payment.`,
          level: row.risk_status === "reject" ? ("warn" as const) : ("info" as const),
        })));
      setLoading(false);
    }

    void loadWorkspaceData().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const flow = buildFlow(activity);
  const pendingAmount = approvals.reduce((total, row) => total + readMoney(row.amt), 0);
  const operatingValue = solBalance === null ? "--" : `${solBalance.toFixed(4)} SOL`;
  const tokenValue = tokenTotal === null ? "--" : `${compactNumber(tokenTotal)} token units`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            Overview <NetworkBadge />
          </div>
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight mt-2" style={{ letterSpacing: "-0.03em" }}>
            Good morning, {firstName(displayName)}.
          </h1>
        </div>
        <Link to="/app/payments" className="inline-flex items-center gap-2 bg-foreground text-background text-sm font-medium px-4 py-2.5 rounded-full hover:opacity-90">
          <Send className="w-4 h-4" /> New payment
        </Link>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex flex-wrap items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="text-sm font-semibold">Next best action</div>
          <div className="text-sm text-muted-foreground">
            {empty
              ? "Connect a wallet to load live balances and see ArcPay's recommendation."
              : tokenAccountCount
                ? `${tokenAccountCount} SPL token account${tokenAccountCount === 1 ? "" : "s"} detected on ${mode}. Review yield or payment routes before signing.`
                : `Wallet connected on ${mode}. No SPL token accounts found yet.`}
          </div>
        </div>
        <Link to={empty ? "/app/wallet" : "/app/yield"} className="text-sm font-medium px-4 py-2 rounded-full bg-primary text-primary-foreground hover:brightness-110">
          {empty ? "Connect wallet" : "Review routes"}
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Wallet} label="Operating" value={empty ? "--" : operatingValue} hint={empty ? "Connect wallet to load live balance." : `Live ${mode} SOL balance`} />
        <StatCard icon={Lock} label="Shielded" value={activity.filter((item) => item.kind === "out").length} hint="Privacy records saved" />
        <StatCard icon={Coins} label="SPL tokens" value={empty ? "--" : tokenAccountCount ?? "--"} hint={empty ? "--" : tokenValue} />
        <StatCard icon={TrendingUp} label="Yield running" value={activity.filter((item) => item.kind === "yield").length} hint="Provider-built yield actions" emphasis />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={Send} label="Pending payments" value={approvals.length} hint={pendingAmount ? `${compactNumber(pendingAmount)} awaiting review` : "No pending approvals"} />
        <StatCard icon={ShieldAlert} label="Risk queue" value={alerts.length} hint={alerts.length ? "Review contractor scores" : "No active alerts"} />
        <StatCard icon={RouteIcon} label="Routes available" value={mode === "devnet" ? "8" : "5"} hint={mode === "devnet" ? "Devnet provider rails" : "Mainnet signer-gated rails"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">24h flow</div>
              <div className="text-lg font-medium mt-1">Inflow vs outflow</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-primary" /> Inflow</span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-accent" /> Outflow</span>
            </div>
          </div>
          <div className="h-64">
            {empty || !mounted || flow.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-sm">
                <Wallet className="w-8 h-8 mb-3 opacity-50" />
                {empty ? "Connect wallet to load 24h flow." : loading ? "Loading live workspace flow." : "No payment, invoice, or privacy records yet."}
              </div>
            ) : (
              <FlowChart data={flow} />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Pending approvals</div>
          <div className="flex-1 flex flex-col gap-2">
            {approvals.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground text-sm">
                <CheckCircle2 className="w-7 h-7 mb-2 opacity-40" />
                Nothing pending.
              </div>
            ) : (
              approvals.map((approval) => (
                <div key={`${approval.who}-${approval.amt}`} className="flex items-center justify-between rounded-xl bg-muted px-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{approval.who}</div>
                    <div className="text-xs text-muted-foreground">{approval.amt}</div>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    approval.risk === "Approve" ? "bg-success/15 text-success" : "bg-warning/30 text-warning-foreground"
                  }`}>
                    {approval.risk}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Latest activity</div>
              <div className="text-lg font-medium mt-1">Treasury feed</div>
            </div>
            <Link to="/app/audit" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </div>
          {empty ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              {loading ? "Loading live activity..." : "Connect wallet and create a payment, invoice, or privacy action to populate activity."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activity.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No live workspace activity yet.</div>}
              {activity.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      row.kind === "in" ? "bg-success/15 text-success" :
                      row.kind === "out" ? "bg-destructive/10 text-destructive" :
                      row.kind === "swap" ? "bg-accent/20 text-foreground" :
                      "bg-primary/10 text-primary"
                    }`}>
                      {row.kind === "in" && <ArrowDownLeft className="w-4 h-4" />}
                      {row.kind === "out" && <ArrowUpRight className="w-4 h-4" />}
                      {row.kind === "swap" && <RouteIcon className="w-4 h-4" />}
                      {row.kind === "yield" && <TrendingUp className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{row.who}</div>
                      <div className="text-xs text-muted-foreground">{row.time} - {row.net}</div>
                    </div>
                  </div>
                  <div className="text-sm font-medium font-mono">{row.amt}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Risk alerts</div>
          <div className="flex flex-col gap-3">
            {alerts.length === 0 && (
              <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                No active risk alerts from saved contractor scores.
              </div>
            )}
            {alerts.map((alert) => (
              <div key={`${alert.who}-${alert.txt}`} className={`rounded-xl p-4 border ${
                alert.level === "warn" ? "bg-warning/10 border-warning/30" : "bg-muted border-border"
              }`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${alert.level === "warn" ? "text-warning-foreground" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{alert.who}</div>
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{alert.txt}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowChart({ data }: { readonly data: readonly FlowPoint[] }) {
  const width = 760;
  const height = 240;
  const padX = 26;
  const padY = 20;
  const max = Math.max(1, ...data.flatMap((row) => [row.in, row.out]));
  const points = (key: "in" | "out") =>
    data.map((row, index) => {
      const x = padX + (index / Math.max(1, data.length - 1)) * (width - padX * 2);
      const y = height - padY - (row[key] / max) * (height - padY * 2);
      return `${x},${y}`;
    }).join(" ");
  const area = (key: "in" | "out") => `${padX},${height - padY} ${points(key)} ${width - padX},${height - padY}`;

  return (
    <svg aria-label="24 hour treasury flow chart" className="h-full w-full" role="img" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="dashIn" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.71 0.18 47)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="oklch(0.71 0.18 47)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="dashOut" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.85 0.13 85)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="oklch(0.85 0.13 85)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line key={ratio} x1={padX} x2={width - padX} y1={height * ratio} y2={height * ratio} stroke="oklch(0.9 0.01 80)" strokeDasharray="5 8" />
      ))}
      <polygon points={area("in")} fill="url(#dashIn)" />
      <polygon points={area("out")} fill="url(#dashOut)" />
      <polyline points={points("in")} fill="none" stroke="oklch(0.71 0.18 47)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      <polyline points={points("out")} fill="none" stroke="oklch(0.85 0.13 85)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
    </svg>
  );
}

function buildFlow(activity: readonly DashboardActivity[]): FlowPoint[] {
  const now = new Date();
  const buckets = Array.from({ length: 8 }, (_, index) => {
    const hour = new Date(now.getTime() - (7 - index) * 3 * 60 * 60 * 1000);
    return { t: hour.getHours().toString().padStart(2, "0"), in: 0, out: 0 };
  });

  for (const item of activity) {
    const ageHours = (now.getTime() - Date.parse(item.createdAt)) / 3_600_000;
    if (ageHours < 0 || ageHours > 24) continue;
    const index = Math.min(7, Math.max(0, 7 - Math.floor(ageHours / 3)));
    buckets[index]![item.direction] += item.amount;
  }

  return buckets.filter((bucket) => bucket.in > 0 || bucket.out > 0);
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "operator";
}

function formatAmount(amount: number, token: string) {
  return `${compactNumber(amount)} ${token}`;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 4 }).format(value);
}

function readMoney(value: string) {
  const match = value.replaceAll(",", "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function shortAddress(value: string) {
  return value.length > 10 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;
}

function relativeTime(value: string) {
  const delta = Date.now() - Date.parse(value);
  if (!Number.isFinite(delta)) return new Date(value).toLocaleString();
  const minutes = Math.max(0, Math.floor(delta / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
