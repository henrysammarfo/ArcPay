"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { Eye, EyeOff, KeyRound, Lock, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { getOptionalSupabaseClient } from "../../app/supabase-client";
import { PageHeader } from "@/components/app/PageHeader";
import { ReviewModal } from "@/components/primitives/ReviewModal";
import { StatCard } from "@/components/primitives/StatCard";
import { readCachedJson, writeCachedJson } from "@/lib/browser-cache";
import { checkActionPolicies } from "@/lib/policy";
import { useNetwork, type NetworkMode } from "@/store/network";

export const Route = createFileRoute("/app/privacy")({
  head: () => ({ meta: [{ title: "Privacy - ArcPay" }] }),
  component: PrivacyPage,
});

const ROUTES = [
  { id: "cloak", name: "Cloak", net: "devnet", status: "live", token: "USDC", desc: "Checks Cloak devnet program plus recorded shield proof signature." },
  { id: "magicblock", name: "MagicBlock", net: "devnet", status: "live", token: "USDC", desc: "Builds a Private Payments SPL deposit transaction." },
  { id: "umbra", name: "Umbra", net: "devnet", status: "live", token: "USDC", desc: "Checks Umbra indexer reachability before recording a privacy action." },
  { id: "ika", name: "Ika", net: "devnet", status: "live", token: "USDC", desc: "Checks Ika pre-alpha program, dWallet, and approval proof config." },
  { id: "pusd", name: "PUSD", net: "mainnet", status: "live", token: "PUSD", desc: "Verifies official PUSD mint metadata and Palm circulation API." },
] as const satisfies readonly {
  readonly id: string;
  readonly name: string;
  readonly net: NetworkMode;
  readonly status: string;
  readonly token: string;
  readonly desc: string;
}[];

type PrivacyEvent = {
  id: string;
  action: "shield" | "viewing_key";
  provider: string;
  amount: number | null;
  token: string;
  recipientName: string;
  recipientEmail: string;
  scope: string;
  status: "pending" | "ready_to_sign" | "submitted" | "failed" | "configured";
  created: string;
};

function PrivacyPage() {
  const wallet = useWallet();
  const network = useNetwork((state) => state.mode);
  const cacheKey = `arcpay-privacy-${network}`;
  const [events, setEvents] = useState<PrivacyEvent[]>(() => readCachedJson(cacheKey, [] as PrivacyEvent[]));
  const [shieldOpen, setShieldOpen] = useState(false);
  const [shieldAmt, setShieldAmt] = useState("");
  const [shieldRoute, setShieldRoute] = useState("cloak");
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyEmail, setKeyEmail] = useState("");
  const [keyScope, setKeyScope] = useState("Full ledger");
  const [keyExpiry, setKeyExpiry] = useState("");
  const [review, setReview] = useState<null | "shield" | "key">(null);
  const [message, setMessage] = useState("Sign in to load privacy operations.");
  const [loading, setLoading] = useState(false);
  const visibleRoutes = ROUTES.filter((route) => route.net === network);

  useEffect(() => {
    void loadEvents();
  }, [cacheKey, network]);

  useEffect(() => {
    writeCachedJson(cacheKey, events);
  }, [cacheKey, events]);

  useEffect(() => {
    if (!visibleRoutes.some((route) => route.id === shieldRoute)) {
      setShieldRoute(visibleRoutes[0]?.id ?? "cloak");
    }
  }, [shieldRoute, visibleRoutes]);

  async function loadEvents() {
    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured for privacy operation records.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setEvents([]);
      setMessage("Sign in to load privacy operations.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("arcpay_privacy_events")
      .select("*")
      .eq("network", network)
      .order("created_at", { ascending: false });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setEvents((data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      provider: row.provider,
      amount: row.amount === null ? null : Number(row.amount),
      token: row.token,
      recipientName: row.recipient_name,
      recipientEmail: row.recipient_email,
      scope: row.scope,
      status: row.status,
      created: new Date(row.created_at).toLocaleString(),
    })));
    setMessage("Privacy operation records loaded from Supabase.");
  }

  async function createShieldEvent() {
    const amount = Number.parseFloat(shieldAmt);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a positive shield amount.");
    const blockReason = checkActionPolicies({
      action: "Shield",
      network,
      token: "USDC",
      amount,
      walletConnected: Boolean(wallet.connected && wallet.publicKey),
    });
    if (blockReason) throw new Error(blockReason);
    const supabase = getOptionalSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sign in before preparing privacy actions.");

    const route = visibleRoutes.find((item) => item.id === shieldRoute);
    if (!route) throw new Error(`No ${network} privacy route is enabled.`);
    const provider = route?.name ?? shieldRoute;
    const token = route.token;
    const providerResult = await callPrivacyProvider(shieldRoute, amount, wallet.publicKey?.toBase58());
    const { error } = await supabase.from("arcpay_privacy_events").insert({
      user_id: user.id,
      network,
      action: "shield",
      provider,
      amount,
      token,
      status: providerResult.status,
      provider_response: providerResult.response,
    });
    if (error) throw error;
    setMessage(providerResult.message);
    setShieldAmt("");
    await loadEvents();
  }

  async function createViewingKeyEvent() {
    const recipientName = keyName.trim();
    const recipientEmail = keyEmail.trim();
    const scope = keyScope.trim();
    const expiry = keyExpiry.trim();

    if (!recipientName) throw new Error("Recipient name is required.");
    if (!recipientEmail) throw new Error("Recipient email is required.");
    if (!scope) throw new Error("Disclosure scope is required.");
    if (!expiry) throw new Error("Expiry date is required.");

    const blockReason = checkActionPolicies({
      action: "Issue viewing key",
      network,
      walletConnected: Boolean(wallet.connected && wallet.publicKey),
    });
    if (blockReason) throw new Error(blockReason);
    const supabase = getOptionalSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sign in before creating viewing-key records.");

    const { error } = await supabase.from("arcpay_privacy_events").insert({
      user_id: user.id,
      network,
      action: "viewing_key",
      provider: "ArcPay selective disclosure",
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      scope: `${scope} until ${expiry}`,
      status: "configured",
      provider_response: {
        note: "Viewing-key disclosure record created. Provider key export is signer-gated.",
      },
    });
    if (error) throw error;
    setMessage("Viewing-key disclosure record saved.");
    setKeyName("");
    setKeyEmail("");
    setKeyScope("Full ledger");
    setKeyExpiry("");
    await loadEvents();
  }

  const viewingKeys = events.filter((event) => event.action === "viewing_key");
  const shieldEvents = events.filter((event) => event.action === "shield");

  return (
    <div>
      <PageHeader
        icon={EyeOff}
        eyebrow="Treasury intelligence"
        title="Privacy"
        description={network === "devnet"
          ? "Prepare shielded payment and selective-disclosure operations against live devnet provider routes, then persist proof records in Supabase."
          : "Verify mainnet privacy and stable-rail routes, then persist proof records in Supabase."}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Lock} label="Prepared shields" value={shieldEvents.length} hint="Awaiting signatures / provider txs" />
        <StatCard icon={Eye} label="Viewing records" value={viewingKeys.length} hint="Scoped disclosures" />
        <StatCard icon={Send} label="Submitted" value={events.filter((event) => event.status === "submitted").length} />
        <StatCard icon={Sparkles} label="Live routes" value={visibleRoutes.length} hint={network === "devnet" ? "Cloak, MagicBlock, Umbra, Ika" : "PUSD"} />
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {loading ? "Loading privacy operations..." : message}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-surface-dark p-6 text-surface-dark-foreground">
          <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Shield funds</div>
          <h2 className="text-2xl font-medium tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            {network === "devnet" ? "Prepare a stealth-pool deposit" : "Verify a privacy rail"}
          </h2>
          <p className="mt-2 text-sm text-white/60">
            ArcPay reaches the selected provider first, then records the exact provider response. No fake transaction success is written.
          </p>
          <button onClick={() => setShieldOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-110">
            Prepare shield <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Disclosure</div>
          <h2 className="text-2xl font-medium tracking-tight" style={{ letterSpacing: "-0.02em" }}>Create a viewing-key record</h2>
          <p className="mt-2 text-sm text-muted-foreground">Persist audit intent, scope, recipient, and expiry. Provider-specific key export remains signer-gated.</p>
          <button onClick={() => setKeyOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
            Configure disclosure <KeyRound className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4 text-sm font-medium">Privacy operation records</div>
          <div className="divide-y divide-border">
            {events.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No privacy records yet.</div>}
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{event.provider} - {event.action}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {event.amount ? `${event.amount} ${event.token}` : event.scope || "No amount"} - {event.created}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${event.status === "submitted" || event.status === "configured" ? "bg-success/15 text-success" : event.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-warning/30 text-warning-foreground"}`}>
                  {event.status}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4 text-sm font-medium">Privacy routes</div>
          <div className="divide-y divide-border">
            {visibleRoutes.map((route) => (
              <div key={route.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{route.name}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{route.net}</span>
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">{route.status}</span>
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{route.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {shieldOpen && (
        <Sheet onClose={() => setShieldOpen(false)} title="Prepare shield">
          <div className="space-y-4">
            <div>
              <Label>Amount ({visibleRoutes.find((route) => route.id === shieldRoute)?.token ?? "USDC"})</Label>
              <input value={shieldAmt} onChange={(event) => setShieldAmt(event.target.value)} type="number" step="0.01" placeholder="0.00" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <Label>Route</Label>
              <div className="grid gap-2">
                {visibleRoutes.map((route) => (
                  <label key={route.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${shieldRoute === route.id ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="radio" checked={shieldRoute === route.id} onChange={() => setShieldRoute(route.id)} className="mt-1 accent-primary" />
                    <div><div className="text-sm font-medium">{route.name}</div><div className="text-xs text-muted-foreground">{route.desc}</div></div>
                  </label>
                ))}
              </div>
            </div>
            <button onClick={() => { setShieldOpen(false); setReview("shield"); }} disabled={!shieldAmt} className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50">Review shield record</button>
          </div>
        </Sheet>
      )}

      {keyOpen && (
        <Sheet onClose={() => setKeyOpen(false)} title="Configure disclosure">
          <div className="space-y-4">
            <Field label="Recipient name"><input value={keyName} onChange={(event) => setKeyName(event.target.value)} className="ap-in" placeholder="Auditor name" /></Field>
            <Field label="Email"><input value={keyEmail} onChange={(event) => setKeyEmail(event.target.value)} type="email" className="ap-in" placeholder="auditor@firm.com" /></Field>
            <Field label="Scope"><select value={keyScope} onChange={(event) => setKeyScope(event.target.value)} className="ap-in"><option>Full ledger</option><option>Payroll only</option><option>Revenue only</option><option>Single transaction</option></select></Field>
            <Field label="Expires"><input value={keyExpiry} onChange={(event) => setKeyExpiry(event.target.value)} type="date" className="ap-in" /></Field>
            <button
              onClick={() => { setKeyOpen(false); setReview("key"); }}
              disabled={!keyName.trim() || !keyEmail.trim() || !keyScope.trim() || !keyExpiry.trim()}
              className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
            >
              Review disclosure
            </button>
            <style>{`.ap-in{width:100%;border-radius:0.75rem;border:1px solid var(--border);background:var(--background);padding:0.625rem 0.75rem;font-size:0.875rem;outline:none}.ap-in:focus{box-shadow:0 0 0 2px var(--ring)}`}</style>
          </div>
        </Sheet>
      )}

      <ReviewModal
        open={review === "shield"}
        onOpenChange={(value) => { if (!value) setReview(null); }}
        title="Review shield record"
        description="This calls the selected live provider route before saving the proof record."
        rows={[
          { label: "Amount", value: `${Number.parseFloat(shieldAmt || "0").toLocaleString()} ${visibleRoutes.find((route) => route.id === shieldRoute)?.token ?? "USDC"}`, mono: true },
          { label: "Route", value: visibleRoutes.find((route) => route.id === shieldRoute)?.name ?? shieldRoute },
          { label: "Provider call", value: "Required before save", warn: true },
        ]}
        warnings={["If the provider has no route/funds/config, the save fails with the real provider error."]}
        confirmLabel="Call provider & save"
        onConfirm={async () => { await createShieldEvent(); }}
      />
      <ReviewModal
        open={review === "key"}
        onOpenChange={(value) => { if (!value) setReview(null); }}
        title="Review disclosure record"
        description="Creates a persisted audit disclosure record."
        rows={[
          { label: "Recipient", value: keyName || "Not set" },
          { label: "Email", value: keyEmail || "Not set" },
          { label: "Scope", value: keyScope },
          { label: "Expiry", value: keyExpiry || "Not set" },
        ]}
        warnings={["Provider-specific key export remains signer-gated."]}
        confirmLabel="Save disclosure"
        onConfirm={async () => { await createViewingKeyEvent(); }}
      />
    </div>
  );
}

function Sheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-medium tracking-tight" style={{ letterSpacing: "-0.02em" }}>{title}</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}

async function callPrivacyProvider(
  provider: string,
  amount: number,
  owner?: string,
): Promise<{
  message: string;
  response: Record<string, unknown>;
  status: PrivacyEvent["status"];
}> {
  const endpoint = endpointForProvider(provider);
  if (provider === "magicblock" && !owner) {
    throw new Error("Connect a wallet before preparing a MagicBlock private payment.");
  }
  const init: RequestInit =
    provider === "magicblock"
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ amount: Math.round(amount * 1_000_000), owner }),
        }
      : { method: "GET" };

  const response = await fetch(endpoint, init);
  const payload = (await response.json()) as Record<string, unknown> & { error?: string; status?: string; proofConfirmationStatus?: string; transactionBytes?: number };
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? `${provider} provider route failed with HTTP ${response.status}.`);
  }

  if (provider === "cloak" && payload.proofConfirmationStatus) {
    return { message: "Cloak devnet proof signature confirmed and record saved.", response: payload, status: "submitted" };
  }
  if (provider === "magicblock" && payload.transactionBytes) {
    return { message: `MagicBlock built a Private Payments transaction (${payload.transactionBytes} bytes).`, response: payload, status: "ready_to_sign" };
  }
  if (provider === "ika" && payload.status === "dwallet_ready") {
    return { message: "Ika dWallet/program proof checked and record saved.", response: payload, status: "configured" };
  }
  if (provider === "pusd" && payload.status === "passed") {
    return { message: "PUSD official mint and Palm circulation API verified.", response: payload, status: "configured" };
  }
  return { message: `${provider} provider route responded and record saved.`, response: payload, status: "configured" };
}

function endpointForProvider(provider: string) {
  switch (provider) {
    case "cloak": return "/api/cloak";
    case "magicblock": return "/api/magicblock";
    case "umbra": return "/api/umbra";
    case "ika": return "/api/ika";
    case "pusd": return "/api/pusd";
    default: throw new Error(`Unsupported privacy provider: ${provider}`);
  }
}
