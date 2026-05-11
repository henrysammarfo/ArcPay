"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeading } from "@/components/primitives/SectionHeading";

export const Route = createFileRoute("/proofs")({
  head: () => ({
    meta: [
      { title: "Proofs — ArcPay developer evidence" },
      { name: "description", content: "Per-integration status: what's complete, what needs funds or keys." },
    ],
  }),
  component: ProofsPage,
});

type Status = "live" | "devnet" | "error" | "needs wallet";

const ROWS: { provider: string; surface: string; status: Status; note: string; endpoint?: string }[] = [
  { provider: "QuickNode", surface: "RPC + webhook", status: "devnet", note: "Devnet RPC is configured through wallet/network pages." },
  { provider: "MagicBlock", surface: "Private Payments", status: "devnet", note: "Live API route builds a private SPL deposit transaction.", endpoint: "/api/magicblock" },
  { provider: "Torque", surface: "Custom events", status: "devnet", note: "Payment creation submits custom_events through Torque.", endpoint: "/api/torque" },
  { provider: "GoldRush", surface: "Counterparty risk", status: "live", note: "Risk page calls server-side GoldRush endpoint." },
  { provider: "DFlow", surface: "Swap routes", status: "live", note: "Swaps page gets live DFlow quotes and wallet-signable transactions." },
  { provider: "Kamino", surface: "Yield tx builder", status: "live", note: "Yield page calls Kamino deposit/withdraw transaction builder.", endpoint: "/api/kamino" },
  { provider: "LP Agent", surface: "Meteora positions", status: "live", note: "Yield page reads live LP Agent positions and server supports Zap-In transaction builds." },
  { provider: "Cloak", surface: "Devnet shield proof", status: "devnet", note: "Privacy page checks Cloak program and recorded devnet proof signature.", endpoint: "/api/cloak" },
  { provider: "Umbra", surface: "Indexer/private rail", status: "devnet", note: "Privacy page checks Umbra indexer route before recording actions.", endpoint: "/api/umbra" },
  { provider: "Ika", surface: "dWallet policy approval", status: "devnet", note: "Privacy page checks Ika program/dWallet approval proof.", endpoint: "/api/ika" },
  { provider: "PUSD", surface: "Stablecoin rail", status: "live", note: "PUSD route verifies official mint metadata and Palm circulation API.", endpoint: "/api/pusd" },
  { provider: "Zerion", surface: "CLI execution", status: "needs wallet", note: "Requires funded mainnet CLI transaction; API key is configured, but no browser signer route is claimed." },
  { provider: "QVAC", surface: "Local treasury brain", status: "needs wallet", note: "Requires native Linux x64 host. WSL is not supported by QVAC team." },
  { provider: "AUDD", surface: "AUD settlement", status: "live", note: "Supported payment token and routed through swap/payment policy pages." },
];

const STATUS_STYLE: Record<Status, string> = {
  "live": "bg-success/15 text-success",
  "devnet": "bg-warning/25 text-warning-foreground",
  "error": "bg-destructive/15 text-destructive",
  "needs wallet": "bg-muted text-muted-foreground",
};

function ProofsPage() {
  const [liveRows, setLiveRows] = useState(ROWS);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const checked = await Promise.all(ROWS.map(async (row) => {
        if (!row.endpoint || row.endpoint === "/api/torque" || row.endpoint === "/api/kamino") return row;
        try {
          const response = await fetch(row.endpoint, {
            method: row.endpoint === "/api/magicblock" ? "POST" : "GET",
            headers: row.endpoint === "/api/magicblock" ? { "content-type": "application/json" } : undefined,
            body: row.endpoint === "/api/magicblock" ? JSON.stringify({ amount: 1_000_000 }) : undefined,
            cache: "no-store",
          });
          const payload = (await response.json()) as { error?: string; status?: string; transactionBytes?: number };
          if (!response.ok || payload.error) {
            return { ...row, status: "error" as const, note: payload.error ?? `HTTP ${response.status}` };
          }
          const suffix = payload.transactionBytes ? ` Transaction bytes: ${payload.transactionBytes}.` : payload.status ? ` Status: ${payload.status}.` : "";
          return { ...row, note: `${row.note}${suffix}` };
        } catch (error) {
          return { ...row, status: "error" as const, note: error instanceof Error ? error.message : "Provider check failed." };
        }
      }));
      if (!cancelled) setLiveRows(checked);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <MarketingShell navTone="light">
      <div className="px-6 pt-16 pb-24">
        <div className="max-w-[88rem] mx-auto">
          <SectionHeading
            eyebrow="Developer evidence"
            title={<>Proofs, separated from the <span className="text-primary">user dashboard</span>.</>}
            description="This page is for judges and developers. Daily customers don't see it. Status is honest — devnet is devnet, pre-alpha is pre-alpha."
          />
          <div className="mt-10 rounded-3xl border border-border bg-card overflow-hidden">
            <div className="hidden md:grid grid-cols-[1.2fr_1.4fr_140px_2fr] gap-4 px-6 py-4 text-xs uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
              <div>Provider</div>
              <div>Surface</div>
              <div>Status</div>
              <div>Note</div>
            </div>
            <div className="divide-y divide-border">
              {liveRows.map((r) => (
                <div key={r.provider} className="grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr_140px_2fr] gap-2 md:gap-4 px-6 py-4 items-center">
                  <div className="text-sm font-semibold">{r.provider}</div>
                  <div className="text-sm text-foreground/80">{r.surface}</div>
                  <div>
                    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">{r.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
