import { createFileRoute } from "@tanstack/react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Eye, EyeOff, KeyRound, ScrollText, Search } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/primitives/StatCard";
import { readCachedJson, writeCachedJson } from "@/lib/browser-cache";
import { checkActionPolicies } from "@/lib/policy";
import { useNetwork } from "@/store/network";
import { getOptionalSupabaseClient } from "../../app/supabase-client";

export const Route = createFileRoute("/app/audit")({
  head: () => ({ meta: [{ title: "Audit - ArcPay" }] }),
  component: AuditPage,
});

type Entry = {
  id: string;
  kind: string;
  private: string;
  public: string;
  sig: string;
  ts: string;
  url: string | null;
};

function AuditPage() {
  const network = useNetwork((state) => state.mode);
  const wallet = useWallet();
  const cacheKey = `arcpay-audit-${network}`;
  const [reveal, setReveal] = useState(false);
  const [from, setFrom] = useState(() => dateOffset(-14));
  const [to, setTo] = useState(() => dateOffset(0));
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[]>(() => readCachedJson(cacheKey, [] as Entry[]));
  const [message, setMessage] = useState("Sign in to load audit records.");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadAudit();
  }, [network]);

  useEffect(() => {
    writeCachedJson(cacheKey, entries);
  }, [cacheKey, entries]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const text = `${entry.public} ${entry.private} ${entry.sig} ${entry.kind}`.toLowerCase();
      return inDateRange(entry, from, to) && (!search || text.includes(search));
    });
  }, [entries, from, query, to]);

  const viewingKeyCount = entries.filter((entry) => entry.kind === "Viewing key").length;

  async function loadAudit() {
    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured for audit records.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setEntries([]);
      setMessage("Sign in to load audit records.");
      return;
    }

    setLoading(true);
    const [payments, invoices, privacy] = await Promise.all([
      supabase.from("arcpay_payment_requests").select("*").eq("network", network).order("created_at", { ascending: false }).limit(100),
      supabase.from("arcpay_invoices").select("*").eq("network", network).order("created_at", { ascending: false }).limit(100),
      supabase.from("arcpay_privacy_events").select("*").eq("network", network).order("created_at", { ascending: false }).limit(100),
    ]);
    setLoading(false);

    const error = payments.error ?? invoices.error ?? privacy.error;
    if (error) {
      setMessage(error.message);
      return;
    }

    const rows: Entry[] = [
      ...(payments.data ?? []).map((row) => ({
        id: `payment-${row.id}`,
        kind: "Payment request",
        private: row.memo || "No memo",
        public: `${row.amount} ${row.token} to ${row.route_to} (${row.status})`,
        sig: row.public_id,
        ts: row.created_at,
        url: row.payment_url || null,
      })),
      ...(invoices.data ?? []).map((row) => ({
        id: `invoice-${row.id}`,
        kind: "Invoice",
        private: `${row.client} - ${row.email} - ${row.memo || "No memo"}`,
        public: `${row.amount} ${row.token} due ${row.due} (${row.status})`,
        sig: row.public_id,
        ts: row.created_at,
        url: row.payment_url || null,
      })),
      ...(privacy.data ?? []).map((row) => {
        const signature = readSignature(row.provider_response) ?? row.id;
        return {
          id: `privacy-${row.id}`,
          kind: row.action === "viewing_key" ? "Viewing key" : "Privacy action",
          private: row.action === "viewing_key" ? `${row.recipient_name} - ${row.recipient_email} - ${row.scope}` : JSON.stringify(row.provider_response),
          public: `${row.provider} ${row.amount ? `${row.amount} ${row.token}` : row.scope} (${row.status})`,
          sig: signature,
          ts: row.created_at,
          url: explorerUrl(signature, network),
        };
      }),
    ].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));

    setEntries(rows);
    setMessage(rows.length ? "Audit records loaded from Supabase." : "No audit records yet. Create a payment, invoice, privacy action, or viewing key.");
  }

  async function createViewingKey() {
    const blockReason = checkActionPolicies({
      action: "Issue viewing key",
      network,
      walletConnected: Boolean(wallet.connected && wallet.publicKey),
    });
    if (blockReason) {
      setMessage(blockReason);
      return;
    }
    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured for viewing-key records.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("Sign in before requesting a viewing key.");
      return;
    }

    const { error } = await supabase.from("arcpay_privacy_events").insert({
      user_id: user.id,
      network,
      action: "viewing_key",
      provider: "ArcPay selective disclosure",
      recipient_name: "Workspace auditor",
      recipient_email: user.email ?? "",
      scope: `Audit export ${from} to ${to}`,
      status: "configured",
      provider_response: { source: "audit_page", range: { from, to }, search: query },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setReveal(true);
    setMessage("Viewing-key record created. Private report fields are now visible in this session.");
    await loadAudit();
  }

  function exportCsv() {
    const header = ["timestamp", "kind", "signature_or_id", "public_ledger", "private_report"];
    const rows = filtered.map((entry) => [
      formatTimestamp(entry.ts),
      entry.kind,
      entry.sig,
      entry.public,
      reveal ? entry.private : "requires viewing key",
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arcpay-audit-${from || "start"}-${to || "end"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${rows.length} audit rows for the selected range and search filter.`);
  }

  return (
    <div>
      <PageHeader
        icon={ScrollText}
        eyebrow="Treasury intelligence"
        title="Audit"
        description="Date-range exports with stored payment, invoice, privacy, and viewing-key records."
        actions={
          <>
            <button onClick={() => void createViewingKey()} className="inline-flex items-center gap-2 bg-muted text-foreground text-sm font-medium px-4 py-2.5 rounded-full hover:bg-muted/70">
              <KeyRound className="w-4 h-4" /> Request viewing key
            </button>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 bg-foreground text-background text-sm font-medium px-4 py-2.5 rounded-full hover:opacity-90">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </>
        }
      />

      <div className="rounded-2xl border border-border bg-muted/40 text-muted-foreground p-4 mb-6 text-sm">
        {loading ? "Loading audit records..." : message}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Entries (range)" value={filtered.length} hint={`${from} to ${to}`} />
        <StatCard label="Records loaded" value={entries.length} hint="Supabase RLS scoped" />
        <StatCard label="Active viewing keys" value={viewingKeyCount} hint={reveal ? "Private fields visible" : "Request key to reveal"} />
        <StatCard label="Last export" value={message.startsWith("Exported") ? "just now" : "--"} hint="CSV uses current filters" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">From</div>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">To</div>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none" />
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-muted-foreground mb-1">Search</div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Memo, signature, counterparty" className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-background text-sm outline-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="text-sm font-medium">Public ledger to private report</div>
          <button onClick={() => setReveal((value) => !value)} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70">
            {reveal ? <><EyeOff className="w-3.5 h-3.5" /> Hide private</> : <><Eye className="w-3.5 h-3.5" /> Reveal with viewing key</>}
          </button>
        </div>
        <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          <div className="col-span-2">Time</div>
          <div className="col-span-2">Kind</div>
          <div className="col-span-3">Signature / id</div>
          <div className="col-span-2">Public ledger</div>
          <div className="col-span-3">Private report</div>
        </div>
        <div className="divide-y divide-border">
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No audit records match this range or search.</div>}
          {filtered.map((entry) => (
            <div key={entry.id} className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center text-sm">
              <div className="col-span-2 text-xs text-muted-foreground font-mono">{formatTimestamp(entry.ts)}</div>
              <div className="col-span-2"><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{entry.kind}</span></div>
              <div className="col-span-3 font-mono text-xs flex items-center gap-1.5 min-w-0">
                <span className="truncate">{shortSig(entry.sig)}</span>
                {entry.url && (
                  <a href={entry.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="col-span-2 text-xs">{entry.public}</div>
              <div className="col-span-3 text-xs">
                {reveal ? <span className="text-foreground">{entry.private}</span> : <span className="text-muted-foreground italic">requires viewing key</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function inDateRange(entry: Entry, from: string, to: string) {
  const day = entry.ts.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function shortSig(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-6)}` : value;
}

function readSignature(value: Record<string, unknown>) {
  const candidates = [
    value.signature,
    value.txSignature,
    value.transactionSignature,
    value.proofSignature,
    value.approvalSignature,
  ];
  return candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.length > 20) ?? null;
}

function explorerUrl(signature: string, network: string) {
  if (signature.length < 20) return null;
  const cluster = network === "devnet" ? "?cluster=devnet" : "";
  return `https://solscan.io/tx/${signature}${cluster}`;
}
