"use client";

import { createFileRoute } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, FileText, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getOptionalSupabaseClient } from "../../app/supabase-client";
import { PageHeader } from "@/components/app/PageHeader";
import { ReviewModal } from "@/components/primitives/ReviewModal";
import { StatCard } from "@/components/primitives/StatCard";
import { useNetwork } from "@/store/network";

export const Route = createFileRoute("/app/invoices")({
  head: () => ({ meta: [{ title: "Invoices - ArcPay" }] }),
  component: InvoicesPage,
});

const TOKENS = ["USDC", "AUDD", "PUSD", "SOL"] as const;
const TOKENS_BY_NETWORK = {
  devnet: ["USDC", "SOL"],
  mainnet: ["USDC", "AUDD", "PUSD", "SOL"],
} as const;

const schema = z.object({
  client: z.string().trim().min(2, "Client name required").max(80),
  email: z.string().trim().email("Invalid email"),
  amount: z.coerce.number().positive("Amount must be positive"),
  token: z.enum(TOKENS),
  due: z.string().min(1, "Pick a due date"),
  memo: z.string().trim().max(280).optional(),
});
type Form = z.infer<typeof schema>;

type Invoice = {
  id: string;
  publicId: string;
  client: string;
  email: string;
  amount: number;
  token: string;
  due: string;
  memo: string;
  status: "paid" | "pending" | "overdue" | "failed" | "cancelled";
  paymentUrl: string;
};

function InvoicesPage() {
  const network = useNetwork((state) => state.mode);
  const tokenOptions = TOKENS_BY_NETWORK[network];
  const [items, setItems] = useState<Invoice[]>([]);
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<Form | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState("Sign in to load and create invoices.");
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { token: "USDC" },
  });

  useEffect(() => {
    void loadInvoices();
  }, [network]);

  async function loadInvoices() {
    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured for invoice persistence.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setItems([]);
      setMessage("Sign in to load and create invoices.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("arcpay_invoices")
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
      client: row.client,
      email: row.email,
      amount: Number(row.amount),
      token: row.token,
      due: row.due,
      memo: row.memo,
      status: row.status,
      paymentUrl: row.payment_url,
    })));
    setMessage("Invoices loaded from Supabase.");
  }

  const onSubmit = (data: Form) => setReview(data);
  const confirm = async () => {
    if (!review) return;
    const supabase = getOptionalSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sign in before creating invoices.");

    const publicId = createInvoiceId();
    const paymentUrl = `${window.location.origin}/pay/${publicId}`;
    const { error } = await supabase.from("arcpay_invoices").insert({
      user_id: user.id,
      public_id: publicId,
      network,
      client: review.client,
      email: review.email,
      amount: review.amount,
      token: review.token,
      due: review.due,
      memo: review.memo ?? "",
      status: "pending",
      payment_url: paymentUrl,
    });

    if (error) throw error;

    await loadInvoices();
    setMessage("Invoice saved and pay-link generated.");
    setReview(null);
    setOpen(false);
    reset({ token: tokenOptions[0] });
  };

  async function copyLink(invoice: Invoice) {
    if (!invoice.paymentUrl || typeof navigator === "undefined") return;
    await navigator.clipboard?.writeText(invoice.paymentUrl);
    setCopied(invoice.id);
    window.setTimeout(() => setCopied(null), 1500);
  }

  const outstanding = items.filter((item) => item.status === "pending" || item.status === "overdue");
  const paid = items.filter((item) => item.status === "paid");

  return (
    <div>
      <PageHeader
        icon={FileText}
        eyebrow="Treasury"
        title="Invoices"
        description={`Generate persisted ${network} invoices with pay-links and due dates. Payment settlement can be updated by webhook or operator review.`}
        actions={
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90">
            <Plus className="h-4 w-4" /> New invoice
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Outstanding" value={`$${sum(outstanding).toLocaleString()}`} hint={`${outstanding.length} open`} />
        <StatCard label="Overdue" value={items.filter((item) => item.status === "overdue").length} hint="Webhook/operator status" />
        <StatCard label="Paid" value={`$${sum(paid).toLocaleString()}`} />
        <StatCard label="Invoices" value={items.length} hint="Stored in Supabase" />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {loading ? "Loading invoices..." : message}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-12 gap-3 border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-2">ID</div><div className="col-span-3">Client</div><div className="col-span-2">Due</div><div className="col-span-2">Amount</div><div className="col-span-2">Status</div><div className="col-span-1 text-right">Link</div>
        </div>
        <div className="divide-y divide-border">
          {items.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No invoices yet.</div>}
          {items.map((invoice) => (
            <div key={invoice.id} className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 text-sm hover:bg-muted/40">
              <div className="col-span-2 font-mono text-xs">{invoice.publicId}</div>
              <div className="col-span-3 truncate">{invoice.client}</div>
              <div className="col-span-2 text-muted-foreground">{invoice.due}</div>
              <div className="col-span-2 font-mono">{invoice.amount.toLocaleString()} {invoice.token}</div>
              <div className="col-span-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  invoice.status === "paid" ? "bg-success/15 text-success" :
                  invoice.status === "pending" ? "bg-warning/30 text-warning-foreground" :
                  "bg-destructive/15 text-destructive"
                }`}>{invoice.status}</span>
              </div>
              <div className="col-span-1 text-right">
                <button onClick={() => void copyLink(invoice)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  {copied === invoice.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
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
                <div className="text-xs uppercase tracking-wider text-muted-foreground">New invoice</div>
                <h2 className="mt-1 text-2xl font-medium tracking-tight" style={{ letterSpacing: "-0.02em" }}>Bill a client</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <div className="space-y-4">
              <Field label="Client name" error={errors.client?.message}><input {...register("client")} className="ap-input" placeholder="Acme Robotics" /></Field>
              <Field label="Email" error={errors.email?.message}><input type="email" {...register("email")} className="ap-input" placeholder="ap@acme.io" /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Amount" error={errors.amount?.message} className="col-span-2"><input type="number" step="0.01" {...register("amount")} className="ap-input" placeholder="0.00" /></Field>
                <Field label="Token"><select {...register("token")} className="ap-input">{tokenOptions.map((token) => <option key={token}>{token}</option>)}</select></Field>
              </div>
              <Field label="Due date" error={errors.due?.message}><input type="date" {...register("due")} className="ap-input" /></Field>
              <Field label="Memo" error={errors.memo?.message}><textarea rows={3} {...register("memo")} className="ap-input resize-none" placeholder="Notes for the client" /></Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm hover:bg-muted">Cancel</button>
              <button type="submit" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:brightness-110">Review</button>
            </div>
            <style>{`.ap-input{width:100%;border-radius:0.75rem;border:1px solid var(--border);background:var(--background);padding:0.625rem 0.75rem;font-size:0.875rem;outline:none}.ap-input:focus{box-shadow:0 0 0 2px var(--ring)}`}</style>
          </form>
        </div>
      )}

      <ReviewModal
        open={!!review}
        onOpenChange={(value) => { if (!value) setReview(null); }}
        title="Review invoice"
        description="A persisted invoice and payment URL will be created."
        rows={review ? [
          { label: "Client", value: review.client },
          { label: "Email", value: review.email },
          { label: "Amount", value: `${review.amount.toLocaleString()} ${review.token}`, mono: true },
          { label: "Due", value: review.due },
        ] : []}
        warnings={["This saves the invoice. It does not mark funds paid until settlement is detected or manually updated."]}
        confirmLabel="Save invoice"
        onConfirm={confirm}
      />
    </div>
  );
}

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function createInvoiceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `inv_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  }
  return `inv_${Date.now().toString(36)}`;
}

function sum(items: Invoice[]) {
  return items.reduce((total, item) => total + item.amount, 0);
}
