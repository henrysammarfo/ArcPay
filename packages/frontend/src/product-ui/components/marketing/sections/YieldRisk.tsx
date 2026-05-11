import { SectionHeading } from "@/components/primitives/SectionHeading";
import { TrendingUp, Layers, ShieldAlert, Lock } from "lucide-react";

export function YieldRisk() {
  return (
    <section className="bg-background pb-24 px-6">
      <div className="max-w-[88rem] mx-auto">
        <SectionHeading
          eyebrow="Treasury intelligence"
          title={<>Yield routing and risk, <span className="text-primary">policy-bounded</span>.</>}
          description="Idle balances sweep into yield. Counterparties are scored before payment. You set the rules; ArcPay enforces them at the final-review step."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-12">
          {/* Yield card */}
          <div className="rounded-3xl border border-border bg-card p-8">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground mb-4">
              <TrendingUp className="w-3.5 h-3.5" /> Yield positions
            </div>
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl bg-muted p-5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Kamino USDC vault</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Conservative · Liquid</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-medium">8.2%</div>
                  <div className="text-xs text-muted-foreground">est. APY</div>
                </div>
              </div>
              <div className="rounded-2xl bg-muted p-5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">LP Agent · Meteora Zap-In</div>
                  <div className="text-xs text-warning-foreground/80 mt-0.5 flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> LP Agent premium endpoint connected
                  </div>
                </div>
                <div className="text-right opacity-50">
                  <div className="text-lg font-medium">—</div>
                  <div className="text-xs">ready</div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk card */}
          <div className="rounded-3xl border border-border bg-card p-8">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground mb-4">
              <ShieldAlert className="w-3.5 h-3.5" /> Counterparty risk
            </div>
            <div className="rounded-2xl bg-muted p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-xs text-muted-foreground">7Hk…9bX</div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">Approve</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-medium">82</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">GoldRush</div>
                </div>
                <div>
                  <div className="text-lg font-medium">9 mo</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Wallet age</div>
                </div>
                <div>
                  <div className="text-lg font-medium">142</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tx 30d</div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Daily limit · 25k USDC", "Allowed: USDC, AUDD, PUSD", "Min score · 60", "Block · sanctioned"].map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-muted text-foreground/70">
                  <Layers className="w-3 h-3" /> {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
