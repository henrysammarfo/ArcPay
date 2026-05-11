import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, ExternalLink, Eye, EyeOff, KeyRound, ScrollText, Search } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/primitives/StatCard";

export const Route = createFileRoute("/app/audit")({
  head: () => ({ meta: [{ title: "Audit - ArcPay" }] }),
  component: AuditPage,
});

type Entry = {
  kind: string;
  private: string;
  public: string;
  sig: string;
  ts: string;
};

const SEED: Entry[] = [
  { ts: "2026-05-11 09:32", sig: "5xK...3pQ", kind: "Shielded transfer", public: "Pool deposit - 4,200 USDC", private: "Maya Chen - payroll - INV-1042" },
  { ts: "2026-05-11 08:14", sig: "9Lm...8vR", kind: "Swap (DFlow)", public: "USDC to AUDD - 1,800", private: "Hedge AUD payables for Q2" },
  { ts: "2026-05-10 22:01", sig: "2Rb...7cT", kind: "Yield deposit", public: "Kamino USDC vault - 10,000", private: "Q2 idle sweep - auto-rule" },
  { ts: "2026-05-10 14:48", sig: "Fr2...11m", kind: "Payment received", public: "+ 4,200 USDC", private: "Stripe Atlas - monthly draw" },
  { ts: "2026-05-10 11:02", sig: "Bx3...44e", kind: "Shielded transfer", public: "Pool deposit - 850 PUSD", private: "x402 endpoint /research" },
];

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function inDateRange(entry: Entry, from: string, to: string) {
  const day = entry.ts.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

function AuditPage() {
  const [reveal, setReveal] = useState(false);
  const [from, setFrom] = useState("2026-05-01");
  const [to, setTo] = useState("2026-05-11");
  const [query, setQuery] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    return SEED.filter((entry) => {
      const text = `${entry.public} ${entry.private} ${entry.sig} ${entry.kind}`.toLowerCase();
      return inDateRange(entry, from, to) && (!search || text.includes(search));
    });
  }, [from, query, to]);

  const exportCsv = () => {
    const header = ["timestamp", "kind", "signature", "public_ledger", "private_report"];
    const rows = filtered.map((entry) => [
      entry.ts,
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
    setExportMessage(`Exported ${rows.length} audit rows for the selected range.`);
  };

  return (
    <div>
      <PageHeader
        icon={ScrollText}
        eyebrow="Treasury intelligence"
        title="Audit"
        description="Date-range exports with transaction signatures, viewing-key request flow, and a public-vs-private reveal."
        actions={
          <>
            <button className="inline-flex items-center gap-2 bg-muted text-foreground text-sm font-medium px-4 py-2.5 rounded-full hover:bg-muted/70">
              <KeyRound className="w-4 h-4" /> Request viewing key
            </button>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 bg-foreground text-background text-sm font-medium px-4 py-2.5 rounded-full hover:opacity-90">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </>
        }
      />

      {exportMessage && (
        <div className="rounded-2xl border border-success/40 bg-success/10 text-success p-4 mb-6 text-sm">
          {exportMessage}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Entries (range)" value={filtered.length} hint={`${from} to ${to}`} />
        <StatCard label="Signatures verified" value="100%" hint="On-chain checked" />
        <StatCard label="Active viewing keys" value="2" hint="2 expired this quarter" />
        <StatCard label="Last export" value={exportMessage ? "just now" : "2d ago"} hint="CSV ready" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none" />
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-muted-foreground mb-1">Search</div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Memo, signature, counterparty" className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-background text-sm outline-none" />
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
          <div className="col-span-3">Signature</div>
          <div className="col-span-2">Public ledger</div>
          <div className="col-span-3">Private (viewing key)</div>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((entry) => (
            <div key={`${entry.ts}-${entry.sig}`} className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center text-sm">
              <div className="col-span-2 text-xs text-muted-foreground font-mono">{entry.ts}</div>
              <div className="col-span-2"><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{entry.kind}</span></div>
              <div className="col-span-3 font-mono text-xs flex items-center gap-1.5"><span className="truncate">{entry.sig}</span><ExternalLink className="w-3 h-3 text-muted-foreground" /></div>
              <div className="col-span-2 text-xs">{entry.public}</div>
              <div className="col-span-3 text-xs">
                {reveal ? <span className="text-foreground">{entry.private}</span> : <span className="text-muted-foreground italic">requires viewing key</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4 max-w-2xl">
        ArcPay separates the on-chain truth from the off-chain context. The public ledger row above is what any explorer shows; the private report is only revealed to holders of the relevant viewing key.
      </p>
    </div>
  );
}
