"use client";

import { createFileRoute } from "@tanstack/react-router";
import { Ban, Loader2, Search, Shield, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/primitives/StatCard";
import { readCachedJson, writeCachedJson } from "@/lib/browser-cache";
import { loadSavedPolicySettings } from "@/lib/policy";
import { useNetwork } from "@/store/network";

type RiskLookup = {
  wallet: string;
  score: number;
  txCount: number;
  balanceCount: number;
  recommendation: "APPROVE" | "REVIEW" | "REJECT";
  reasons: string[];
};

export const Route = createFileRoute("/app/risk")({
  head: () => ({ meta: [{ title: "Risk - ArcPay" }] }),
  component: RiskPage,
});

function RiskPage() {
  const network = useNetwork((state) => state.mode);
  const cacheKey = `arcpay-risk-${network}`;
  const cached = readCachedJson(cacheKey, { query: "", lookup: null as RiskLookup | null, history: [] as RiskLookup[] });
  const minScore = loadSavedPolicySettings()?.minScore ?? 70;
  const [query, setQuery] = useState(cached.query);
  const [lookup, setLookup] = useState<RiskLookup | null>(cached.lookup);
  const [history, setHistory] = useState<RiskLookup[]>(cached.history);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const next = readCachedJson(cacheKey, { query: "", lookup: null as RiskLookup | null, history: [] as RiskLookup[] });
    setQuery(next.query);
    setLookup(next.lookup);
    setHistory(next.history);
    setStatus("idle");
    setError("");
  }, [cacheKey]);

  useEffect(() => {
    writeCachedJson(cacheKey, { query, lookup, history });
  }, [cacheKey, history, lookup, query]);

  async function runLookup() {
    const wallet = query.trim();
    if (!wallet || status === "loading") return;

    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const payload = (await response.json()) as RiskLookup | { error?: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload && payload.error ? payload.error : "Risk lookup failed.");
      }

      if (!isRiskLookup(payload)) {
        throw new Error("Risk lookup returned an invalid response.");
      }

      const result = payload;
      setLookup(result);
      setHistory((prev) => [result, ...prev.filter((item) => item.wallet !== result.wallet)].slice(0, 8));
      setStatus("idle");
    } catch (cause) {
      setLookup(null);
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Risk lookup failed.");
    }
  }

  const approved = history.filter((item) => item.recommendation === "APPROVE").length;
  const review = history.filter((item) => item.recommendation === "REVIEW").length;
  const rejected = history.filter((item) => item.recommendation === "REJECT").length;

  return (
    <div>
      <PageHeader
        icon={ShieldAlert}
        eyebrow="Treasury intelligence"
        title="Risk"
        description="Score a counterparty wallet through the server-side GoldRush adapter before allowing treasury payments."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Approved" value={approved} hint="Live lookups this session" />
        <StatCard icon={Shield} label="Review queue" value={review} hint="Requires operator review" />
        <StatCard icon={Ban} label="Rejected" value={rejected} hint="Blocked by policy" />
        <StatCard icon={Sparkles} label="Min GoldRush" value={minScore} hint="Current policy floor" />
      </div>

      <div className="mb-4 rounded-2xl bg-surface-dark p-6 text-surface-dark-foreground">
        <div className="text-xs uppercase tracking-wider text-white/50">Counterparty lookup</div>
        <h2 className="mt-1 text-2xl font-medium tracking-tight" style={{ letterSpacing: "-0.02em" }}>
          Score any Solana wallet
        </h2>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void runLookup();
              }}
              placeholder="Paste a Solana address"
              className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-10 pr-4 font-mono text-sm outline-none placeholder:text-white/30 focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => void runLookup()}
            disabled={status === "loading" || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
            Score wallet
          </button>
        </div>

        {status === "error" && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {lookup && (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white/5 p-4 md:col-span-1">
              <div className="text-xs text-white/50">GoldRush score</div>
              <div className={`mt-1 text-5xl font-medium tracking-tight ${scoreTone(lookup.score)}`}>{lookup.score}</div>
              <div className="mt-2 text-xs text-white/50">Recent tx count: {lookup.txCount}</div>
              <div className="mt-1 truncate font-mono text-xs text-white/40">{lookup.wallet}</div>
              <div className="mt-2 text-xs text-white/50">Balance rows: {lookup.balanceCount}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-4 md:col-span-2">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-white/50">Verdict</div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${verdictBadge(lookup.recommendation)}`}>
                  {lookup.recommendation}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {lookup.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="mt-2 h-1 w-1 rounded-full bg-primary" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4 text-sm font-medium">Lookup history</div>
        <div className="hidden grid-cols-12 gap-3 border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
          <div className="col-span-5">Wallet</div>
          <div className="col-span-2">Score</div>
          <div className="col-span-2">Tx count</div>
          <div className="col-span-3 text-right">Verdict</div>
        </div>
        <div className="divide-y divide-border">
          {history.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No scored wallets yet. Paste a wallet address above to run a live GoldRush lookup.
            </div>
          ) : (
            history.map((item) => (
              <div key={item.wallet} className="grid gap-2 px-5 py-3.5 text-sm hover:bg-muted/40 md:grid-cols-12 md:items-center">
                <div className="font-mono text-xs text-muted-foreground md:col-span-5">{item.wallet}</div>
                <div className={`font-mono md:col-span-2 ${item.score >= 70 ? "text-success" : item.score >= 40 ? "text-warning-foreground" : "text-destructive"}`}>
                  {item.score}
                </div>
                <div className="text-muted-foreground md:col-span-2">{item.txCount}</div>
                <div className="md:col-span-3 md:text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${verdictBadge(item.recommendation)}`}>
                    {item.recommendation}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function scoreTone(score: number) {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

function verdictBadge(verdict: RiskLookup["recommendation"]) {
  if (verdict === "APPROVE") return "bg-success/20 text-success";
  if (verdict === "REVIEW") return "bg-warning/30 text-warning";
  return "bg-destructive/30 text-destructive";
}

function isRiskLookup(value: RiskLookup | { error?: string }): value is RiskLookup {
  return (
    typeof (value as RiskLookup).wallet === "string" &&
    typeof (value as RiskLookup).score === "number" &&
    typeof (value as RiskLookup).txCount === "number" &&
    typeof (value as RiskLookup).balanceCount === "number" &&
    Array.isArray((value as RiskLookup).reasons) &&
    ["APPROVE", "REVIEW", "REJECT"].includes((value as RiskLookup).recommendation)
  );
}
