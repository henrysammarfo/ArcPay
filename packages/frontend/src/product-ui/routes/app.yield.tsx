import { createFileRoute } from "@tanstack/react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { TrendingUp, Coins, Lock, Zap, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { ReviewModal } from "@/components/primitives/ReviewModal";
import { StatCard } from "@/components/primitives/StatCard";
import { checkActionPolicies } from "@/lib/policy";
import { useNetwork } from "@/store/network";

export const Route = createFileRoute("/app/yield")({
  head: () => ({ meta: [{ title: "Yield — ArcPay" }] }),
  component: YieldPage,
});

const VAULTS = [
  { id: "kamino-usdc", venue: "Kamino", token: "USDC", apy: null, tvl: "Live tx builder", min: 10, lock: "None", deposited: 0, status: "available" as const },
  { id: "kamino-pusd", venue: "Kamino", token: "PUSD", apy: null, tvl: "Reserve required", min: 10, lock: "None", deposited: 0, status: "available" as const },
  { id: "kamino-sol",  venue: "Kamino", token: "SOL",  apy: null, tvl: "Reserve required", min: 0.1, lock: "None", deposited: 0, status: "available" as const },
  { id: "lpagent-meteora", venue: "LP Agent - Meteora", token: "USDC/SOL", apy: null, tvl: "Live positions", min: 0.01, lock: "Variable", deposited: 0, status: "available" as const },
];

function YieldPage() {
  const network = useNetwork((state) => state.mode);
  const wallet = useWallet();
  const [active, setActive] = useState<typeof VAULTS[number] | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [review, setReview] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lpStatus, setLpStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [lpMessage, setLpMessage] = useState("Connect a wallet to read Meteora positions through LP Agent.");
  const [lpPositionCount, setLpPositionCount] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState("Kamino deposit/withdraw builds an unsigned transaction before wallet signing.");
  const [buildingTx, setBuildingTx] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLpAgentPositions() {
      if (!wallet.publicKey) {
        setLpStatus("idle");
        setLpMessage("Connect a wallet to read Meteora positions through LP Agent.");
        setLpPositionCount(null);
        return;
      }

      setLpStatus("loading");
      setLpMessage("Reading LP Agent positions...");

      try {
        const response = await fetch(`/api/lpagent?owner=${encodeURIComponent(wallet.publicKey.toBase58())}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { positionCount?: number; error?: string };

        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? "LP Agent positions request failed.");
        }

        if (!cancelled) {
          setLpPositionCount(typeof payload.positionCount === "number" ? payload.positionCount : 0);
          setLpStatus("ready");
          setLpMessage("LP Agent positions loaded for the connected wallet.");
        }
      } catch (error) {
        if (!cancelled) {
          setLpPositionCount(null);
          setLpStatus("error");
          setLpMessage(error instanceof Error ? error.message : "LP Agent positions request failed.");
        }
      }
    }

    void loadLpAgentPositions();

    return () => {
      cancelled = true;
    };
  }, [wallet.publicKey]);

  const open = (v: typeof VAULTS[number], m: "deposit" | "withdraw") => {
    setActive(v); setMode(m); setAmount(""); setReview(false);
  };

  const num = parseFloat(amount) || 0;
  const projDay = active?.apy ? (num * (active.apy / 100)) / 365 : 0;

  return (
    <div>
      <PageHeader icon={TrendingUp} eyebrow="Treasury intelligence" title="Yield" description="Sweep idle balances into Kamino vaults and LP Agent powered Meteora positions from one policy-controlled workspace." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={TrendingUp} label="Yield running" value={lpPositionCount ?? "--"} hint="Live LP Agent positions" emphasis />
        <StatCard icon={Coins} label="Idle eligible" value={wallet.connected ? "review" : "--"} hint={wallet.connected ? "Choose amount, then build provider tx" : "Connect wallet first"} />
        <StatCard icon={Zap} label="Projected (30d)" value="--" hint="Shown after provider APY is returned" />
        <StatCard icon={Lock} label="LP Agent positions" value={lpPositionCount ?? "--"} hint={lpStatus === "loading" ? "Loading..." : lpMessage} />
      </div>

      <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${actionMessage.toLowerCase().includes("failed") || actionMessage.toLowerCase().includes("error") ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-border bg-muted/40 text-muted-foreground"}`}>
        {buildingTx ? "Building provider transaction..." : actionMessage}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Provider status</div>
              <div className="text-2xl font-medium tracking-tight mt-1">Provider quotes</div>
            </div>
            <div className="text-xs text-muted-foreground">Source: Kamino builder + LP Agent</div>
          </div>
          <div className="h-48">
              {mounted ? (
                <ProviderStatus message={lpMessage} status={lpStatus} />
              ) : (
                <div className="h-full rounded-xl bg-muted/40" />
              )}
          </div>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="text-xs uppercase tracking-wider text-primary mb-2">Suggested sweep</div>
          <div className="text-2xl font-medium tracking-tight">Build a Kamino USDC transaction</div>
          <p className="text-sm text-muted-foreground mt-2">ArcPay calls the provider builder first. If the reserve, wallet, or amount is invalid, the real provider error is shown before signing.</p>
          <button onClick={() => open(VAULTS[0]!, "deposit")} className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-medium hover:brightness-110">
            Review sweep <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border text-sm font-medium">Available vaults</div>
        <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          <div className="col-span-3">Venue</div><div className="col-span-2">Token</div><div className="col-span-1">APY</div><div className="col-span-2">TVL</div><div className="col-span-2">Min · Lock</div><div className="col-span-2 text-right">Action</div>
        </div>
        <div className="divide-y divide-border">
          {VAULTS.map((v) => (
            <div key={v.id} className="grid grid-cols-12 gap-3 px-5 py-4 items-center text-sm hover:bg-muted/40">
              <div className="col-span-3 font-medium">{v.venue}</div>
              <div className="col-span-2"><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{v.token}</span></div>
              <div className="col-span-1 font-mono text-success">{v.apy ? `${v.apy}%` : "--"}</div>
              <div className="col-span-2 text-muted-foreground">{v.tvl}</div>
              <div className="col-span-2 text-xs text-muted-foreground">{v.min} {v.token.split("/")[0]} · {v.lock}</div>
              <div className="col-span-2 text-right">
                {v.deposited > 0 ? (
                  <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <button onClick={() => open(v, "withdraw")} className="text-xs px-3 py-1.5 rounded-full hover:bg-muted">Withdraw</button>
                    <button onClick={() => open(v, "deposit")} className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:brightness-110">Top up</button>
                  </div>
                ) : (
                  <button onClick={() => open(v, "deposit")} className="text-xs px-3 py-1.5 rounded-full bg-foreground text-background hover:opacity-90">Deposit</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {active && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActive(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card rounded-2xl border border-border p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{active.venue}</div>
            <h2 className="text-2xl font-medium tracking-tight mt-1" style={{ letterSpacing: "-0.02em" }}>{mode === "deposit" ? "Deposit to" : "Withdraw from"} {active.token} vault</h2>
            <div className="mt-4 inline-flex items-center bg-muted rounded-full p-0.5">
              {(["deposit", "withdraw"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize ${mode === m ? "bg-foreground text-background" : "text-muted-foreground"}`}>{m}</button>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-muted p-4">
              <div className="text-xs text-muted-foreground mb-1">Amount ({active.token})</div>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" placeholder="0.00" className="w-full bg-transparent text-3xl font-medium tracking-tight outline-none" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Stat k="APY" v={active.apy ? `${active.apy}%` : "provider"} />
              <Stat k="Min" v={`${active.min} ${active.token.split("/")[0]}`} />
              <Stat k="Projected/day" v={active.apy ? `$${projDay.toFixed(2)}` : "provider"} />
            </div>
            {num > 0 && num < active.min && <div className="mt-3 text-xs text-destructive">Below minimum deposit ({active.min} {active.token.split("/")[0]}).</div>}
            <button disabled={num < active.min} onClick={() => setReview(true)} className="mt-5 w-full bg-primary text-primary-foreground rounded-full py-3 font-medium hover:brightness-110 disabled:opacity-50">Review {mode}</button>
          </div>
        </div>
      )}

      <ReviewModal
        open={review}
        onOpenChange={setReview}
        title={`Review ${mode}`}
        description={active ? `${active.venue} · ${active.token}` : ""}
        rows={active ? [
          { label: "Action", value: mode === "deposit" ? "Deposit" : "Withdraw" },
          { label: "Amount", value: `${num.toLocaleString()} ${active.token}`, mono: true },
          { label: "APY", value: active.apy ? `${active.apy}%` : "Provider quote required" },
          { label: "Lock", value: active.lock },
          { label: "Network fee est.", value: "≈ 0.00012 SOL", mono: true },
        ] : []}
        warnings={["Yield rates are variable and may change at any time."]}
        confirmLabel={mode === "deposit" ? "Sign deposit" : "Sign withdrawal"}
        onConfirm={buildYieldTransaction}
      />
    </div>
  );

  async function buildYieldTransaction() {
    if (!active) return;
    if (!num || num < active.min) throw new Error(`Below minimum ${active.min} ${active.token.split("/")[0]}.`);

    const blockReason = checkActionPolicies({
      action: mode === "deposit" ? "Yield deposit" : "Yield withdraw",
      network,
      token: active.token.split("/")[0],
      amount: num,
      walletConnected: Boolean(wallet.connected && wallet.publicKey),
    });
    if (blockReason) {
      setActionMessage(blockReason);
      throw new Error(blockReason);
    }

    if (active.venue.startsWith("LP Agent")) {
      setActionMessage("LP Agent positions are live. Zap-In needs a selected Meteora pool id before a transaction can be built.");
      setActive(null);
      return;
    }

    const walletAddress = wallet.publicKey?.toBase58();
    setBuildingTx(true);
    setActionMessage("Calling Kamino transaction builder...");

    try {
      const response = await fetch("/api/kamino", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: mode,
          amount: num,
          mint: active.token === "USDC" ? undefined : active.token,
          wallet: walletAddress,
        }),
      });
      const payload = (await response.json()) as { error?: string; transactionBytes?: number; action?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? `Kamino HTTP ${response.status}`);
      }
      setActionMessage(`Kamino ${payload.action ?? mode} transaction built (${payload.transactionBytes ?? 0} bytes). Connect/sign with wallet to submit.`);
      setActive(null);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Kamino transaction build failed.";
      setActionMessage(`Kamino failed: ${text}`);
      throw error;
    } finally {
      setBuildingTx(false);
    }
  }
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="rounded-lg bg-muted/60 p-2.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div><div className="text-sm font-medium font-mono mt-0.5">{v}</div></div>;
}

function ProviderStatus({ message, status }: { message: string; status: "idle" | "loading" | "ready" | "error" }) {
  return (
    <div className="flex h-full flex-col justify-center rounded-2xl border border-border bg-muted/40 p-5">
      <div className="text-sm font-medium capitalize">{status}</div>
      <div className="mt-2 text-sm text-muted-foreground">{message}</div>
      <div className="mt-4 text-xs text-muted-foreground">
        Deposit and withdrawal buttons call the Kamino transaction builder. LP Agent reads positions from the connected wallet.
      </div>
    </div>
  );
}
