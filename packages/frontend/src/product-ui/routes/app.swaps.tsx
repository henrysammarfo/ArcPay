"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { ArrowLeftRight, ChevronDown, Info, Loader2, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ReviewModal } from "@/components/primitives/ReviewModal";
import { checkActionPolicies } from "@/lib/policy";
import { useNetwork } from "@/store/network";

export const Route = createFileRoute("/app/swaps")({
  head: () => ({ meta: [{ title: "Swaps - ArcPay" }] }),
  component: SwapsPage,
});

const TOKENS = ["USDC", "AUDD", "PUSD", "SOL", "USDT"] as const;
const PRIORITY = [
  { id: "fast", label: "Fastest" },
  { id: "cheapest", label: "Cheapest" },
  { id: "balanced", label: "Balanced" },
] as const;

type Token = typeof TOKENS[number];
type Priority = typeof PRIORITY[number]["id"];

type DFlowQuote = {
  contextSlot?: number;
  executionMode?: "sync" | "async";
  inAmount?: string;
  minOutAmount?: string;
  outAmount?: string;
  priceImpactPct?: string;
  signable: boolean;
  slippageBps?: number;
  transaction?: string;
  uiMinOutAmount: string;
  uiOutAmount: string;
};

function SwapsPage() {
  const network = useNetwork((state) => state.mode);
  const wallet = useWallet();
  const { connection } = useConnection();
  const [from, setFrom] = useState<Token>("USDC");
  const [to, setTo] = useState<Token>("SOL");
  const [amount, setAmount] = useState("10");
  const [slippage, setSlippage] = useState("0.5");
  const [priority, setPriority] = useState<Priority>("balanced");
  const [quote, setQuote] = useState<DFlowQuote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("Request a live DFlow order quote before signing.");
  const [review, setReview] = useState(false);
  const [signature, setSignature] = useState("");

  const num = Number.parseFloat(amount) || 0;
  const slippageBps = Math.round((Number.parseFloat(slippage) || 0) * 100);
  const tooSmall = num > 0 && num < 10 && from !== "SOL";
  const canQuote = num > 0 && from !== to && !tooSmall && quoteStatus !== "loading";
  const publicKey = wallet.publicKey?.toBase58();

  useEffect(() => {
    setQuote(null);
    setQuoteStatus("idle");
    setMessage("Request a live DFlow order quote before signing.");
    setSignature("");
  }, [amount, from, priority, publicKey, slippage, to]);

  async function requestQuote() {
    if (!canQuote) return;

    const blockReason = checkActionPolicies({
      action: "Swap",
      network,
      token: from,
      amount: num,
      walletConnected: Boolean(wallet.connected && wallet.publicKey),
    });
    if (blockReason) {
      setQuoteStatus("error");
      setMessage(blockReason);
      return;
    }

    setQuoteStatus("loading");
    setMessage("Requesting live DFlow order quote...");
    setQuote(null);
    setSignature("");

    try {
      const response = await fetch("/api/dflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          from,
          priority,
          slippageBps,
          to,
          userPublicKey: publicKey,
        }),
      });
      const payload = (await response.json()) as DFlowQuote | { error?: string; details?: unknown };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload && payload.error ? payload.error : "DFlow quote failed.");
      }

      if (!isDFlowQuote(payload)) {
        throw new Error("DFlow quote returned an invalid response.");
      }

      setQuote(payload);
      setQuoteStatus("ready");
      setMessage(payload.signable ? "DFlow returned a signable order transaction." : "DFlow returned a quote. Connect a wallet for a signable order.");
    } catch (error) {
      setQuoteStatus("error");
      setMessage(error instanceof Error ? error.message : "DFlow quote failed.");
    }
  }

  async function signAndSubmit() {
    const blockReason = checkActionPolicies({
      action: "Swap",
      network,
      token: from,
      amount: num,
      walletConnected: Boolean(wallet.connected && wallet.publicKey),
    });
    if (blockReason) {
      setMessage(blockReason);
      throw new Error(blockReason);
    }

    if (!quote?.transaction) {
      setMessage("No signable DFlow transaction returned. Connect wallet and refresh quote.");
      throw new Error("No signable DFlow transaction.");
    }

    if (!wallet.publicKey || !wallet.signTransaction) {
      setMessage("Connect a wallet that supports transaction signing.");
      throw new Error("Wallet cannot sign.");
    }

    try {
      const transaction = VersionedTransaction.deserialize(base64ToBytes(quote.transaction));
      const signed = await wallet.signTransaction(transaction);
      const txid = await connection.sendRawTransaction(signed.serialize(), {
        maxRetries: 2,
        skipPreflight: false,
      });
      setSignature(txid);
      setMessage("DFlow transaction submitted to Solana.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "DFlow transaction signing/submission failed.";
      setMessage(text);
      throw error;
    }
  }

  function flip() {
    const currentFrom = from;
    setFrom(to);
    setTo(currentFrom);
  }

  const quoteRows = useMemo(() => quote ? [
    { label: "You pay", value: `${num.toLocaleString()} ${from}`, mono: true },
    { label: "Expected out", value: `${quote.uiOutAmount} ${to}`, mono: true },
    { label: "Min received", value: `${quote.uiMinOutAmount} ${to}`, mono: true },
    { label: "Price impact", value: quote.priceImpactPct ? `${quote.priceImpactPct}%` : "Provider did not return impact" },
    { label: "Slot", value: quote.contextSlot ?? "Not returned" },
    { label: "Signable", value: quote.signable ? "Yes" : "No", warn: !quote.signable },
  ] : [], [from, num, quote, to]);

  return (
    <div>
      <PageHeader
        icon={ArrowLeftRight}
        eyebrow="Treasury"
        title="Swaps"
        description="Get live DFlow order quotes and submit only after wallet signature. Zerion is represented as the mainnet execution proof path and will run after funded wallet approval."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-3">
          <div className="space-y-3">
            <div className="rounded-xl bg-muted/60 p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>You pay</span>
                <span>{wallet.connected ? "Wallet connected" : "Connect wallet for a signable order"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-3xl font-medium tracking-tight outline-none"
                  placeholder="0.00"
                />
                <TokenSelect value={from} onChange={setFrom} />
              </div>
            </div>

            <div className="relative z-10 -my-3 flex justify-center">
              <button type="button" onClick={flip} className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background hover:opacity-90">
                <ArrowLeftRight className="h-4 w-4 rotate-90" />
              </button>
            </div>

            <div className="rounded-xl bg-muted/60 p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>You receive</span>
                <span>Live DFlow quote</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="min-w-0 flex-1 text-3xl font-medium tracking-tight">
                  {quote ? quote.uiOutAmount : "--"}
                </div>
                <TokenSelect value={to} onChange={setTo} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
              <Segmented label="Priority" value={priority} options={PRIORITY.map((p) => ({ value: p.id, label: p.label }))} onChange={(v) => setPriority(v as Priority)} />
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Max slippage</div>
                <div className="flex flex-wrap items-center gap-2">
                  {["0.1", "0.5", "1.0"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSlippage(value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${slippage === value ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"}`}
                    >
                      {value}%
                    </button>
                  ))}
                  <input value={slippage} onChange={(event) => setSlippage(event.target.value)} className="w-16 rounded-full bg-muted px-2 py-1.5 text-center text-xs outline-none" />
                </div>
              </div>
            </div>
          </div>

          {tooSmall && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-warning/15 p-3 text-xs">
              <Info className="mt-0.5 h-3.5 w-3.5 text-warning-foreground" /> Route minimum is 10 for stablecoin quotes.
            </div>
          )}

          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              quoteStatus === "error" ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {quoteStatus === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
              {message}
            </span>
            {signature && (
              <div className="mt-2 font-mono text-xs text-success">
                Submitted: {signature}
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={!canQuote}
              onClick={() => void requestQuote()}
              className="w-full rounded-full bg-primary py-3 font-medium text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {quoteStatus === "loading" ? "Requesting quote..." : "Get live DFlow quote"}
            </button>
            <button
              type="button"
              disabled={!quote}
              onClick={() => setReview(true)}
              className="w-full rounded-full bg-foreground py-3 font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Review order
            </button>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Execution routes</div>
            <div className="space-y-2">
              <RouteCard active label="DFlow" note="Live order quote, optional signable transaction when wallet is connected." />
              <RouteCard active label="Zerion" note="Mainnet proof route configured for funded execution; no browser fake success is shown." />
              <RouteCard active label="Balanced split" note="Uses DFlow browser signer first; Zerion proof is recorded after the funded mainnet run." />
            </div>
          </div>

          <div className="rounded-2xl bg-surface-dark p-5 text-surface-dark-foreground">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
              <Zap className="h-3.5 w-3.5 text-primary" /> Quote summary
            </div>
            <Row k="Expected out" v={quote ? `${quote.uiOutAmount} ${to}` : "Not quoted"} />
            <Row k="Minimum out" v={quote ? `${quote.uiMinOutAmount} ${to}` : "Not quoted"} />
            <Row k="Execution mode" v={quote?.executionMode ?? "Not quoted"} />
            <Row k="Signable tx" v={quote?.signable ? "Yes" : "No"} highlight={quote?.signable} />
          </div>
        </div>
      </div>

      <ReviewModal
        open={review}
        onOpenChange={setReview}
        title="Review DFlow order"
        description={`${from} -> ${to}`}
        rows={quoteRows}
        warnings={[
          quote?.signable ? "Your wallet will sign the DFlow transaction. ArcPay will submit it only after signature." : "Connect wallet and refresh the quote to get a signable order transaction.",
          "If the wallet is unfunded, Solana preflight should return insufficient funds or a provider route error.",
        ]}
        confirmLabel={quote?.signable ? "Sign & submit" : "No signable tx"}
        onConfirm={signAndSubmit}
      />
    </div>
  );
}

function RouteCard({ active, label, note }: { active?: boolean; label: string; note: string }) {
  return (
    <div className={`rounded-xl border p-3 ${active ? "border-primary bg-primary/5" : "border-border bg-muted/30 opacity-75"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{label}</div>
        {active ? <ShieldCheck className="h-3.5 w-3.5 text-success" /> : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">WAITING</span>}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-white/60">{k}</span>
      <span className={`font-mono ${highlight ? "font-semibold text-primary" : ""}`}>{v}</span>
    </div>
  );
}

function TokenSelect({ value, onChange }: { value: Token; onChange: (v: Token) => void }) {
  return (
    <div className="relative">
      <select value={value} onChange={(event) => onChange(event.target.value as Token)} className="cursor-pointer appearance-none rounded-full bg-foreground py-2 pl-4 pr-9 text-sm font-semibold text-background outline-none">
        {TOKENS.map((token) => <option key={token} value={token}>{token}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-background" />
    </div>
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="inline-flex items-center rounded-full bg-muted p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${value === option.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isDFlowQuote(value: DFlowQuote | { error?: string; details?: unknown }): value is DFlowQuote {
  return (
    typeof (value as DFlowQuote).uiOutAmount === "string" &&
    typeof (value as DFlowQuote).uiMinOutAmount === "string" &&
    typeof (value as DFlowQuote).signable === "boolean"
  );
}
