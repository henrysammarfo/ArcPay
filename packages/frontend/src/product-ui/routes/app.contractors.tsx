"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { Plus, Search, Send, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getOptionalSupabaseClient } from "../../app/supabase-client";
import { PageHeader } from "@/components/app/PageHeader";
import { ReviewModal } from "@/components/primitives/ReviewModal";
import { StatCard } from "@/components/primitives/StatCard";
import { readCachedJson, writeCachedJson } from "@/lib/browser-cache";
import { checkActionPolicies } from "@/lib/policy";
import { useNetwork } from "@/store/network";

export const Route = createFileRoute("/app/contractors")({
  head: () => ({ meta: [{ title: "Contractors - ArcPay" }] }),
  component: ContractorsPage,
});

type Contractor = {
  id: string;
  name: string;
  wallet: string;
  currency: "USDC" | "AUDD" | "PUSD" | "SOL";
  risk: number;
  riskStatus: "approve" | "review" | "reject" | "unscored" | "error";
  riskReasons: string[];
  paid30: number;
  privateRoute: boolean;
  selected?: boolean;
};

type RiskResponse = {
  score: number;
  recommendation: "APPROVE" | "REVIEW" | "REJECT";
  reasons: string[];
};

function ContractorsPage() {
  const network = useNetwork((state) => state.mode);
  const wallet = useWallet();
  const cacheKey = `arcpay-contractors-${network}`;
  const currencyOptions = network === "devnet" ? (["USDC", "SOL"] as const) : (["USDC", "AUDD", "PUSD", "SOL"] as const);
  const [items, setItems] = useState<Contractor[]>(() => readCachedJson(cacheKey, [] as Contractor[]));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(false);
  const [name, setName] = useState("");
  const [walletInput, setWalletInput] = useState("");
  const [currency, setCurrency] = useState<Contractor["currency"]>("USDC");
  const [message, setMessage] = useState("Sign in to load contractors.");
  const [loading, setLoading] = useState(false);
  const [scoringId, setScoringId] = useState<string | null>(null);

  useEffect(() => {
    setCurrency(currencyOptions[0]);
    void loadContractors();
  }, [cacheKey, network]);

  async function loadContractors() {
    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured for contractor persistence.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setItems([]);
      setMessage("Sign in to load contractors.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("arcpay_contractors")
      .select("*")
      .eq("network", network)
      .order("created_at", { ascending: false });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const nextItems = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      wallet: row.wallet,
      currency: row.currency,
      risk: row.risk_score,
      riskStatus: row.risk_status,
      riskReasons: row.risk_reasons,
      paid30: Number(row.paid_30),
      privateRoute: row.private_route,
      selected: false,
    }));
    setItems(nextItems);
    writeCachedJson(cacheKey, nextItems);
    setMessage("Contractors loaded from Supabase.");
  }

  const filtered = useMemo(
    () => items.filter((contractor) => (contractor.name + contractor.wallet).toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  const selected = items.filter((item) => item.selected);
  const total = selected.length * 850;

  const toggle = (id: string) => setItems((prev) => prev.map((item) => item.id === id ? { ...item, selected: !item.selected } : item));
  const toggleAll = () => {
    const allOn = items.length > 0 && items.every((item) => item.selected);
    setItems((prev) => prev.map((item) => ({ ...item, selected: !allOn })));
  };

  async function add() {
    if (!name.trim() || !walletInput.trim()) return;
    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("Sign in before adding contractors.");
      return;
    }

    const { data, error } = await supabase.from("arcpay_contractors").insert({
      user_id: user.id,
      network,
      name: name.trim(),
      wallet: walletInput.trim(),
      currency,
      risk_status: "unscored",
      risk_reasons: [],
      private_route: false,
    }).select("*").single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setName("");
    setWalletInput("");
    setCurrency(currencyOptions[0]);
    setOpen(false);
    await loadContractors();
    if (data) await scoreContractor(data.id, data.wallet);
  }

  async function scoreContractor(id: string, address: string) {
    const supabase = getOptionalSupabaseClient();
    if (!supabase) return;
    setScoringId(id);

    try {
      const response = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      const payload = (await response.json()) as RiskResponse | { error?: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "GoldRush score failed.");
      if (!isRiskResponse(payload)) throw new Error("GoldRush score returned an invalid response.");

      const riskStatus = payload.recommendation.toLowerCase() as Contractor["riskStatus"];
      const { error } = await supabase.from("arcpay_contractors").update({
        risk_score: payload.score,
        risk_status: riskStatus,
        risk_reasons: payload.reasons,
      }).eq("id", id);
      if (error) throw error;
      setMessage("GoldRush score saved for contractor.");
    } catch (error) {
      await supabase.from("arcpay_contractors").update({
        risk_status: "error",
        risk_reasons: [error instanceof Error ? error.message : "GoldRush score failed."],
      }).eq("id", id);
      setMessage(error instanceof Error ? error.message : "GoldRush score failed.");
    } finally {
      setScoringId(null);
      await loadContractors();
    }
  }

  const confirm = async () => {
    const blockReason = checkActionPolicies({
      action: "Send",
      network,
      token: "USDC",
      amount: total,
      counterpartyWallets: selected.map((item) => item.wallet),
      minObservedScore: selected.length ? Math.min(...selected.map((item) => item.risk || 0)) : null,
      walletConnected: Boolean(wallet.connected && wallet.publicKey),
    });
    if (blockReason) {
      throw new Error(blockReason);
    }
    setItems((prev) => prev.map((item) => ({ ...item, selected: false })));
    setMessage("Batch payroll prepared. Final payout still requires wallet signature through privacy/payment route.");
  };

  return (
    <div>
      <PageHeader
        icon={Users}
        eyebrow="Treasury"
        title="Contractors"
        description={`Persist ${network} recipients, score wallets with GoldRush, and prepare policy-gated payroll batches.`}
        actions={
          <>
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/70">
              <Plus className="h-4 w-4" /> Add contractor
            </button>
            <button disabled={selected.length === 0} onClick={() => setReview(true)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              <Send className="h-4 w-4" /> Pay {selected.length || ""} selected
            </button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active contractors" value={items.length} hint="Stored in Supabase" />
        <StatCard label="Avg GoldRush" value={items.length ? Math.round(items.reduce((a, b) => a + b.risk, 0) / items.length) : "--"} hint="Min policy: 70" />
        <StatCard label="Approved" value={items.filter((item) => item.riskStatus === "approve").length} hint="GoldRush score >= 70" />
        <StatCard label="Paid (30d)" value={`$${items.reduce((a, b) => a + b.paid30, 0).toLocaleString()}`} />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {loading ? "Loading contractors..." : message}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="text-sm font-medium">Directory</div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or wallet" className="w-full rounded-full bg-muted py-1.5 pl-8 pr-3 text-sm outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-12 gap-3 border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-1"><input type="checkbox" checked={items.length > 0 && items.every((item) => item.selected)} onChange={toggleAll} className="accent-primary" /></div>
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Wallet</div>
          <div className="col-span-2">Currency</div>
          <div className="col-span-2">Risk</div>
          <div className="col-span-1 text-right">Score</div>
        </div>
        <div className="divide-y divide-border">
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No contractors yet.</div>}
          {filtered.map((contractor) => (
            <div key={contractor.id} className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 text-sm hover:bg-muted/40">
              <div className="col-span-1"><input type="checkbox" checked={!!contractor.selected} onChange={() => toggle(contractor.id)} className="accent-primary" /></div>
              <div className="col-span-3 truncate font-medium">{contractor.name}</div>
              <div className="col-span-3 truncate font-mono text-xs text-muted-foreground">{contractor.wallet}</div>
              <div className="col-span-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{contractor.currency}</span></div>
              <div className="col-span-2 flex items-center gap-2">
                {contractor.riskStatus === "approve" ? <ShieldCheck className="h-3.5 w-3.5 text-success" /> : <ShieldAlert className="h-3.5 w-3.5 text-warning-foreground" />}
                <span className={`font-mono text-sm ${contractor.riskStatus === "reject" || contractor.riskStatus === "error" ? "text-destructive" : ""}`}>{contractor.riskStatus === "unscored" ? "--" : contractor.risk}</span>
                <span className="text-xs text-muted-foreground">{contractor.riskStatus}</span>
              </div>
              <div className="col-span-1 text-right">
                <button onClick={() => void scoreContractor(contractor.id, contractor.wallet)} disabled={scoringId === contractor.id} className="text-xs text-primary hover:underline disabled:opacity-50">
                  {scoringId === contractor.id ? "..." : "Run"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-medium tracking-tight" style={{ letterSpacing: "-0.02em" }}>Add contractor</h2>
            <div className="space-y-3">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <input value={walletInput} onChange={(event) => setWalletInput(event.target.value)} placeholder="Solana wallet address" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring" />
              <select value={currency} onChange={(event) => setCurrency(event.target.value as Contractor["currency"])} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none">
                {currencyOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm hover:bg-muted">Cancel</button>
              <button onClick={() => void add()} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:brightness-110">Save + score</button>
            </div>
          </div>
        </div>
      )}

      <ReviewModal
        open={review}
        onOpenChange={setReview}
        title="Review batch payroll"
        description={`Preparing ${selected.length} contractor${selected.length === 1 ? "" : "s"}.`}
        rows={[
          { label: "Recipients", value: selected.length },
          { label: "Total", value: `${total.toLocaleString()} USDC`, mono: true },
          { label: "Approved", value: selected.filter((item) => item.riskStatus === "approve").length },
          { label: "Min GoldRush", value: Math.min(...selected.map((item) => item.risk || 0), 100) },
        ]}
        warnings={selected.some((item) => item.riskStatus !== "approve") ? ["At least one contractor is not GoldRush-approved. Policy should block final payout."] : ["Final payout requires wallet signature."]}
        confirmLabel="Prepare batch"
        onConfirm={confirm}
      />
    </div>
  );
}

function isRiskResponse(value: RiskResponse | { error?: string }): value is RiskResponse {
  return (
    typeof (value as RiskResponse).score === "number" &&
    ["APPROVE", "REVIEW", "REJECT"].includes((value as RiskResponse).recommendation) &&
    Array.isArray((value as RiskResponse).reasons)
  );
}
