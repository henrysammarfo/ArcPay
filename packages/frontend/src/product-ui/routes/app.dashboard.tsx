import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wallet,
  Lock,
  Coins,
  TrendingUp,
  Send,
  ShieldAlert,
  Route as RouteIcon,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/primitives/StatCard";
import { NetworkBadge } from "@/components/primitives/NetworkBadge";
import { useNetwork } from "@/store/network";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Overview — ArcPay" }] }),
  component: Dashboard,
});

const FLOW_PLACEHOLDER = [
  { t: "00", in: 1200, out: 800 },
  { t: "03", in: 1800, out: 1100 },
  { t: "06", in: 2400, out: 1500 },
  { t: "09", in: 3200, out: 2100 },
  { t: "12", in: 4400, out: 2800 },
  { t: "15", in: 4100, out: 3300 },
  { t: "18", in: 5400, out: 3500 },
  { t: "21", in: 4800, out: 3000 },
  { t: "24", in: 6200, out: 3900 },
];

const ACTIVITY_PLACEHOLDER = [
  { id: 1, kind: "in", who: "Client · Stripe Atlas", amt: "+ $4,200 USDC", time: "2m ago", net: "mainnet" },
  { id: 2, kind: "swap", who: "DFlow swap USDC → AUDD", amt: "$1,800", time: "14m ago", net: "mainnet" },
  { id: 3, kind: "out", who: "Contractor · 7Hk…9bX", amt: "− $850 USDC", time: "1h ago", net: "mainnet" },
  { id: 4, kind: "yield", who: "Kamino USDC vault deposit", amt: "$10,000", time: "3h ago", net: "mainnet" },
  { id: 5, kind: "in", who: "x402 endpoint · /agents/research", amt: "+ $42 PUSD", time: "5h ago", net: "devnet" },
];

const APPROVALS_PLACEHOLDER = [
  { who: "Contractor payroll · 12 wallets", amt: "$8,420 USDC", risk: "Approve" as const },
  { who: "Swap to AUDD", amt: "$3,200", risk: "Review" as const },
  { who: "Kamino top-up", amt: "$15,000", risk: "Approve" as const },
];

const ALERTS_PLACEHOLDER = [
  { who: "Wallet 9Tu…2qP", txt: "GoldRush score dropped to 42 — below your minimum (60).", level: "warn" as const },
  { who: "LP Agent", txt: "Premium endpoint connected — unsigned Meteora Zap-In proof is ready.", level: "info" as const },
];

function Dashboard() {
  const mode = useNetwork((s) => s.mode);
  const empty = mode === "mainnet"; // mainnet = no wallet connected = honest empty state
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            Overview <NetworkBadge />
          </div>
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight mt-2" style={{ letterSpacing: "-0.03em" }}>
            Good morning, Ada.
          </h1>
        </div>
        <Link to="/app/payments" className="inline-flex items-center gap-2 bg-foreground text-background text-sm font-medium px-4 py-2.5 rounded-full hover:opacity-90">
          <Send className="w-4 h-4" /> New payment
        </Link>
      </div>

      {/* Next best action */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex flex-wrap items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="text-sm font-semibold">Next best action</div>
          <div className="text-sm text-muted-foreground">
            {empty
              ? "Connect a wallet to load live balances and see ArcPay's recommendation."
              : "$11,304 idle in operating wallet. Sweep to Kamino USDC vault for ~8.2% APY."}
          </div>
        </div>
        <Link to={empty ? "/sign-up" : "/app/yield"} className="text-sm font-medium px-4 py-2 rounded-full bg-primary text-primary-foreground hover:brightness-110">
          {empty ? "Connect wallet" : "Review sweep"}
        </Link>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Wallet} label="Operating" value={empty ? "—" : "$184,420"} hint={empty ? "Connect wallet to load live balance." : "USDC + PUSD + AUDD"} delta={empty ? undefined : { value: "2.3%", direction: "up" }} />
        <StatCard icon={Lock} label="Shielded" value={empty ? "—" : "$62,910"} hint={empty ? "No shielded balance found." : "Cloak + Umbra routes"} delta={empty ? undefined : { value: "0.8%", direction: "up" }} />
        <StatCard icon={Coins} label="Idle" value={empty ? "—" : "$11,304"} hint={empty ? "—" : "Sweep eligible"} delta={empty ? undefined : { value: "12%", direction: "down" }} />
        <StatCard icon={TrendingUp} label="Yield running" value={empty ? "—" : "$48,200"} hint={empty ? "—" : "Kamino positions"} delta={empty ? undefined : { value: "8.2% APY", direction: "up" }} emphasis />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={Send} label="Pending payments" value={empty ? "—" : "3"} hint={empty ? "—" : "$12,470 awaiting approval"} />
        <StatCard icon={ShieldAlert} label="Risk queue" value={empty ? "—" : "2"} hint={empty ? "—" : "1 review · 1 watch"} />
        <StatCard icon={RouteIcon} label="Routes available" value={empty ? "—" : "8"} hint={empty ? "Connect wallet to fetch routes." : "DFlow · Zerion · Kamino"} />
      </div>

      {/* Charts + alerts row */}
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
            {empty || !mounted ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-sm">
                <Wallet className="w-8 h-8 mb-3 opacity-50" />
                {empty ? "Connect wallet to load 24h flow." : "Loading 24h flow."}
              </div>
            ) : (
              <FlowChart />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Pending approvals</div>
          <div className="flex-1 flex flex-col gap-2">
            {empty ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground text-sm">
                <CheckCircle2 className="w-7 h-7 mb-2 opacity-40" />
                Nothing pending.
              </div>
            ) : (
              APPROVALS_PLACEHOLDER.map((a) => (
                <div key={a.who} className="flex items-center justify-between rounded-xl bg-muted px-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.who}</div>
                    <div className="text-xs text-muted-foreground">{a.amt}</div>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    a.risk === "Approve" ? "bg-success/15 text-success" : "bg-warning/30 text-warning-foreground"
                  }`}>
                    {a.risk}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Activity + alerts */}
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
              Connect wallet to stream live activity (powered by QuickNode webhooks).
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ACTIVITY_PLACEHOLDER.map((row) => (
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
                      <div className="text-xs text-muted-foreground">{row.time} · {row.net}</div>
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
            {ALERTS_PLACEHOLDER.map((a, i) => (
              <div key={i} className={`rounded-xl p-4 border ${
                a.level === "warn" ? "bg-warning/10 border-warning/30" : "bg-muted border-border"
              }`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${a.level === "warn" ? "text-warning-foreground" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{a.who}</div>
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{a.txt}</div>
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

function FlowChart() {
  const width = 760;
  const height = 240;
  const padX = 26;
  const padY = 20;
  const max = Math.max(...FLOW_PLACEHOLDER.flatMap((row) => [row.in, row.out]));
  const points = (key: "in" | "out") =>
    FLOW_PLACEHOLDER.map((row, index) => {
      const x = padX + (index / (FLOW_PLACEHOLDER.length - 1)) * (width - padX * 2);
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
