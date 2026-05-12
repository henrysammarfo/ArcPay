"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, ExternalLink, Plus, Search, Send, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getOptionalSupabaseClient } from "../../app/supabase-client";
import { PageHeader } from "@/components/app/PageHeader";
import { ReviewModal, type ReviewRow } from "@/components/primitives/ReviewModal";
import { StatCard } from "@/components/primitives/StatCard";
import { readCachedJson, writeCachedJson } from "@/lib/browser-cache";
import { checkActionPolicies } from "@/lib/policy";
import { useNetwork } from "@/store/network";

export const Route = createFileRoute("/app/payments")({
  head: () => ({ meta: [{ title: "Payments - ArcPay" }] }),
  component: PaymentsPage,
});

const TOKENS = ["USDC", "AUDD", "PUSD", "SOL"] as const;
const TOKENS_BY_NETWORK = {
  devnet: ["USDC", "SOL"],
  mainnet: ["USDC", "AUDD", "PUSD", "SOL"],
} as const;
const ROUTING_BY_NETWORK = {
  devnet: [
    { id: "operating", label: "Operating wallet", desc: "Keep liquid for devnet spend" },
  ],
  mainnet: [
    { id: "operating", label: "Operating wallet", desc: "Keep liquid for spend" },
    { id: "shield", label: "Shielded sub-account", desc: "Cloak / Umbra route" },
    { id: "yield", label: "Sweep to yield", desc: "LP Agent / Kamino route" },
    { id: "swap", label: "Swap on receipt", desc: "Convert through DFlow" },
  ],
} as const;

const schema = z.object({
  amount: z.coerce.number({ invalid_type_error: "Enter an amount" }).positive("Amount must be positive").max(1_000_000, "Above policy daily cap"),
  token: z.enum(TOKENS),
  memo: z.string().trim().max(140, "Max 140 chars").optional(),
  routeTo: z.string(),
});
type Form = z.infer<typeof schema>;

type RequestRow = {
  id: string;
  publicId: string;
  amount: number;
  token: string;
  memo: string;
  route: string;
  status: "pending" | "settled" | "failed" | "cancelled";
  created: string;
  paymentUrl: string;
};

function PaymentsPage() {
  const network = useNetwork((state) => state.mode);
  const wallet = useWallet();
  const tokenOptions = TOKENS_BY_NETWORK[network];
  const routeOptions = ROUTING_BY_NETWORK[network];
  const cacheKey = `arcpay-payments-${network}`;
  const [items, setItems] = useState<RequestRow[]>(() => readCachedJson(cacheKey, [] as RequestRow[]));
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<Form | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("Sign in to load and create payment requests.");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { token: "USDC", routeTo: "operating" },
  });
  const selectedToken = watch("token");
  const selectedRoute = watch("routeTo");

  useEffect(() => {
    void loadRequests();
  }, [network]);

  useEffect(() => {
    writeCachedJson(cacheKey, items);
  }, [cacheKey, items]);

  useEffect(() => {
    if (!tokenOptions.some((token) => token === selectedToken)) {
      setValue("token", tokenOptions[0]);
    }
    if (!routeOptions.some((route) => route.id === selectedRoute)) {
      setValue("routeTo", routeOptions[0].id);
    }
  }, [network, routeOptions, selectedRoute, selectedToken, setValue, tokenOptions]);

  async function loadRequests() {
    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured for payment persistence.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setItems([]);
      setMessage("Sign in to load and create payment requests.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("arcpay_payment_requests")
      .select("*")
      .eq("network", network)
      .order("created_at", { ascending: false });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setItems((data ?? []).map((row) => ({
      id: row.id,
      publicId: row.public_id,
      amount: Number(row.amount),
      token: row.token,
      memo: row.memo,
      route: row.route_to,
      status: row.status,
      created: new Date(row.created_at).toLocaleString(),
      paymentUrl: row.payment_url,
    })));
    setMessage("Payment requests loaded from Supabase.");
  }

  const onSubmit = (data: Form) => setReview(data);

  const confirm = async () => {
    if (!review) return;
    const blockReason = checkActionPolicies({
      action: "Send",
      network,
      token: review.token,
      amount: review.amount,
      walletConnected: Boolean(wallet.connected && wallet.publicKey),
    });
    if (blockReason) throw new Error(blockReason);
    const supabase = getOptionalSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sign in before creating payment requests.");

    const route = routeOptions.find((item) => item.id === review.routeTo)?.label ?? "Operating wallet";
    const publicId = createRequestId();
    const paymentUrl = `${window.location.origin}/pay/${publicId}`;
    const { error } = await supabase.from("arcpay_payment_requests").insert({
      user_id: user.id,
      public_id: publicId,
      network,
      amount: review.amount,
      token: review.token,
      memo: review.memo ?? "",
      route_to: route,
      status: "pending",
      payment_url: paymentUrl,
    });

    if (error) throw error;

    const torque = await submitTorqueEvent({
      amountUsd: review.amount,
      eventName: "arcpay_paid_agent_request",
      proofType: "frontend_payment_request",
      source: `arcpay-payments-${network}`,
    });

    await loadRequests();
    setMessage(
      torque.ok
        ? "Payment request saved, pay-link generated, and Torque event submitted."
        : `Payment request saved. ${torque.error}`,
    );
    setReview(null);
    setOpen(false);
    reset({ token: tokenOptions[0], routeTo: routeOptions[0].id });
  };

  const filtered = useMemo(
    () => items.filter((item) => (item.publicId + item.memo + item.token + item.route).toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  const pending = items.filter((item) => item.status === "pending");
  const settled = items.filter((item) => item.status === "settled");

  const reviewRows: ReviewRow[] = review ? [
    { label: "Amount", value: `${review.amount.toLocaleString()} ${review.token}`, mono: true },
    { label: "Route", value: routeOptions.find((item) => item.id === review.routeTo)?.label ?? "Operating wallet" },
    { label: "Memo", value: review.memo || "None" },
    { label: "Network", value: network },
    { label: "Stored pay-link", value: "Supabase", mono: true },
  ] : [];

  async function copyLink(row: RequestRow) {
    if (!row.paymentUrl || typeof navigator === "undefined") return;
    await navigator.clipboard?.writeText(row.paymentUrl);
    setCopied(row.id);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div>
      <PageHeader
        icon={Send}
        eyebrow="Treasury"
        title="Payments"
        description={`Create persisted ${network} payment requests and stored pay-links. Settlement status is ready for QuickNode webhook updates.`}
        actions={
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90">
            <Plus className="h-4 w-4" /> New request
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pending" value={pending.length} hint={`$${sum(pending).toLocaleString()} awaiting`} />
        <StatCard label="Settled" value={`$${sum(settled).toLocaleString()}`} />
        <StatCard label="Failed" value={items.filter((item) => item.status === "failed").length} hint="Provider/webhook failures" />
        <StatCard label="Pay-links" value={items.length} hint="Stored in Supabase" />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {loading ? "Loading payment requests..." : message}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="text-sm font-medium">Payment requests</div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search id, memo, token" className="w-full rounded-full border border-transparent bg-muted py-1.5 pl-8 pr-3 text-sm focus:border-border focus:outline-none" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No payment requests yet.</div>}
          {filtered.map((row) => (
            <div key={row.id} className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 hover:bg-muted/40">
              <div className="col-span-3 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                {row.publicId}
                <button type="button" onClick={() => void copyLink(row)} className="hover:text-foreground">
                  {copied === row.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className="col-span-4 truncate text-sm">{row.memo || "No memo"}</div>
              <div className="col-span-2 text-xs text-muted-foreground">{row.route}</div>
              <div className="col-span-2 font-mono text-sm">{row.amount.toLocaleString()} {row.token}</div>
              <div className="col-span-1 text-right">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.status === "settled" ? "bg-success/15 text-success" : row.status === "pending" ? "bg-warning/30 text-warning-foreground" : "bg-destructive/15 text-destructive"}`}>
                  {row.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <form onSubmit={handleSubmit(onSubmit)} onClick={(event) => event.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">New request</div>
                <h2 className="mt-1 text-2xl font-medium tracking-tight" style={{ letterSpacing: "-0.02em" }}>Request payment</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</label>
                <div className="mt-1.5 flex gap-2">
                  <input type="number" step="0.01" {...register("amount")} className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0.00" />
                  <select {...register("token")} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {tokenOptions.map((token) => <option key={token}>{token}</option>)}
                  </select>
                </div>
                {errors.amount && <p className="mt-1.5 text-xs text-destructive">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Memo</label>
                <input {...register("memo")} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="What is this for?" />
                {errors.memo && <p className="mt-1.5 text-xs text-destructive">{errors.memo.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Route on receipt</label>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {routeOptions.map((route) => (
                    <label key={route.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <input type="radio" value={route.id} {...register("routeTo")} className="mt-1 accent-primary" />
                      <div>
                        <div className="text-sm font-medium">{route.label}</div>
                        <div className="text-xs text-muted-foreground">{route.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Pay-link is saved on confirm. Settlement stays pending until a real payment or webhook update arrives.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm hover:bg-muted">Cancel</button>
              <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:brightness-110">
                <ExternalLink className="h-3.5 w-3.5" /> Review
              </button>
            </div>
          </form>
        </div>
      )}

      <ReviewModal
        open={!!review}
        onOpenChange={(value) => { if (!value) setReview(null); }}
        title="Review payment request"
        description="Final review before saving the pay-link."
        rows={reviewRows}
        warnings={["This creates a stored pay-link record. It does not mark funds settled until a payment/webhook updates it."]}
        confirmLabel="Generate pay-link"
        onConfirm={confirm}
      />
    </div>
  );
}

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `pay_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  }
  return `pay_${Date.now().toString(36)}`;
}

function sum(items: RequestRow[]) {
  return items.reduce((total, item) => total + item.amount, 0);
}

async function submitTorqueEvent(payload: {
  amountUsd: number;
  eventName: string;
  proofType: string;
  source: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/torque", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { error?: string; status?: string; reason?: string };
    if (body.status === "skipped") {
      return { ok: false, error: body.reason ?? "Torque event skipped." };
    }
    if (!response.ok || body.error) {
      throw new Error(body.error ?? `HTTP ${response.status}`);
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Torque event failed." };
  }
}
