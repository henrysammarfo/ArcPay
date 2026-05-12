"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeading } from "@/components/primitives/SectionHeading";
import { useNetwork, type NetworkMode } from "@/store/network";

export const Route = createFileRoute("/proofs")({
  head: () => ({
    meta: [
      { title: "Proofs - ArcPay developer evidence" },
      { name: "description", content: "Per-integration status: what's complete, what needs funds or keys." },
    ],
  }),
  component: ProofsPage,
});

type Status = "live" | "devnet" | "error" | "needs wallet";
type ProofRow = {
  provider: string;
  surface: string;
  status: Status;
  note: string;
  networks: readonly (NetworkMode | "both")[];
  endpoint?: string;
  autoCheck?: boolean;
};

const ROWS: ProofRow[] = [
  { provider: "QuickNode", surface: "RPC + webhook", status: "devnet", note: "Backend exposes live webhook proof status for the selected network.", networks: ["devnet", "mainnet"], endpoint: "/api/quicknode", autoCheck: true },
  { provider: "MagicBlock", surface: "Private Payments", status: "needs wallet", note: "Live route requires a connected wallet owner. Use Privacy -> Prepare shield to build the Private Payments transaction.", networks: ["devnet"], endpoint: "/api/magicblock" },
  { provider: "Torque", surface: "Custom events", status: "devnet", note: "Payment creation submits custom_events through Torque when server env is configured.", networks: ["devnet", "mainnet"], endpoint: "/api/torque" },
  { provider: "GoldRush", surface: "Counterparty risk", status: "live", note: "Risk page calls the server-side GoldRush endpoint.", networks: ["devnet", "mainnet"] },
  { provider: "DFlow", surface: "Swap routes", status: "live", note: "Swaps page gets live DFlow quotes and wallet-signable transactions.", networks: ["mainnet"] },
  { provider: "Kamino", surface: "Yield tx builder", status: "live", note: "Yield page calls Kamino deposit/withdraw transaction builder.", networks: ["mainnet"], endpoint: "/api/kamino" },
  { provider: "LP Agent", surface: "Meteora positions", status: "live", note: "Yield page reads live LP Agent positions and server supports Zap-In transaction builds.", networks: ["mainnet"] },
  { provider: "Cloak", surface: "Devnet shield proof", status: "devnet", note: "Privacy page checks Cloak program and recorded devnet proof signature.", networks: ["devnet"], endpoint: "/api/cloak", autoCheck: true },
  { provider: "Umbra", surface: "Indexer/private rail", status: "needs wallet", note: "Signer/provider gated. The Privacy flow records the real route response when a shield action is prepared.", networks: ["devnet"], endpoint: "/api/umbra" },
  { provider: "Ika", surface: "dWallet policy approval", status: "devnet", note: "Privacy page checks Ika program/dWallet approval proof.", networks: ["devnet"], endpoint: "/api/ika", autoCheck: true },
  { provider: "PUSD", surface: "Stablecoin rail", status: "live", note: "PUSD route verifies official mint metadata and Palm circulation API.", networks: ["mainnet"], endpoint: "/api/pusd", autoCheck: true },
  { provider: "Zerion", surface: "CLI execution", status: "needs wallet", note: "Requires funded mainnet CLI transaction; API key is configured, but no browser signer route is claimed.", networks: ["mainnet"] },
  { provider: "QVAC", surface: "Local treasury brain", status: "devnet", note: "Native Linux x64 backend runs a local QVAC model decision on demand.", networks: ["devnet"], endpoint: "/api/qvac", autoCheck: true },
  { provider: "AUDD", surface: "AUD settlement", status: "live", note: "Supported payment token and routed through mainnet payment and policy pages.", networks: ["mainnet"] },
];

const STATUS_STYLE: Record<Status, string> = {
  "live": "bg-success/15 text-success",
  "devnet": "bg-warning/25 text-warning-foreground",
  "error": "bg-destructive/15 text-destructive",
  "needs wallet": "bg-muted text-muted-foreground",
};

function ProofsPage() {
  const network = useNetwork((state) => state.mode);
  const [liveRows, setLiveRows] = useState(ROWS);
  const visibleRows = liveRows.filter((row) => row.networks.includes(network));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const checked = await Promise.all(ROWS.map(async (row) => {
        if (!row.endpoint || !row.autoCheck) return row;
        try {
          const response = await fetch(`${row.endpoint}?network=${network}`, {
            method: "GET",
            cache: "no-store",
          });
          const payload = (await response.json()) as {
            error?: string;
            status?: string;
            transactionBytes?: number;
            liveProof?: boolean;
            decision?: { action?: string; confidence?: number; reason?: string };
            message?: string;
            latestEvent?: { eventId?: string; receivedAt?: string };
            receivedCount?: number;
          };
          if (row.endpoint === "/api/quicknode") {
            if (payload.liveProof) {
              return {
                ...row,
                status: "live" as const,
                note: `Live webhook proof received for ${network}. Event count: ${payload.receivedCount ?? 0}.${payload.latestEvent?.eventId ? ` Latest event: ${payload.latestEvent.eventId}.` : ""}`,
              };
            }

            return {
              ...row,
              status: network === "devnet" ? ("devnet" as const) : ("error" as const),
              note: payload.message ?? `Waiting for a real ${network} QuickNode webhook event to hit the Azure backend.`,
            };
          }
          if (row.endpoint === "/api/qvac") {
            if (payload.liveProof && payload.decision?.action) {
              return {
                ...row,
                status: "live" as const,
                note: `Live local QVAC decision: ${payload.decision.action} (${Math.round(Number(payload.decision.confidence ?? 0) * 100)}% confidence). ${payload.decision.reason ?? ""}`,
              };
            }

            return {
              ...row,
              status: "devnet" as const,
              note: payload.message ?? "QVAC backend check is configured; local model proof will appear live when the backend is reachable from this runtime.",
            };
          }
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
  }, [network]);

  return (
    <MarketingShell navTone="light">
      <div className="px-6 pt-16 pb-24">
        <div className="max-w-[88rem] mx-auto">
          <SectionHeading
            eyebrow="Developer evidence"
            title={<>Proofs, separated from the <span className="text-primary">user dashboard</span>.</>}
            description={`This page is for judges and developers. Daily customers don't see it. Current proof scope: ${network}. Status is honest - devnet is devnet, pre-alpha is pre-alpha.`}
          />
          <div className="mt-10 rounded-3xl border border-border bg-card overflow-hidden">
            <div className="hidden md:grid grid-cols-[1.2fr_1.4fr_140px_2fr] gap-4 px-6 py-4 text-xs uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
              <div>Provider</div>
              <div>Surface</div>
              <div>Status</div>
              <div>Note</div>
            </div>
            <div className="divide-y divide-border">
              {visibleRows.map((r) => (
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
