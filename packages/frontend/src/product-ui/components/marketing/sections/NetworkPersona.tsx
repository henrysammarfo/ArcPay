import { Globe, Zap } from "lucide-react";

export function NetworkPersona() {
  return (
    <section className="bg-background pb-24 px-6">
      <div className="max-w-[88rem] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
        <div className="rounded-3xl border border-border bg-card p-10 flex flex-col justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-primary font-semibold mb-3">Network model</div>
            <h3 className="text-2xl md:text-3xl font-medium leading-tight" style={{ letterSpacing: "-0.03em" }}>
              One interface. Two networks. Always explicit.
            </h3>
            <p className="mt-3 text-muted-foreground">
              Switch between Devnet and Mainnet from the top bar. Every money-moving action shows network, wallet, token, fees, route, slippage, and recipient, then blocks execution when funds, pools, or routes are missing.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-warning/15 p-4">
              <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-warning-foreground" /><span className="text-sm font-semibold">Devnet</span></div>
              <div className="text-xs text-muted-foreground">Faucet funds, Cloak devnet, Ika pre-alpha, MagicBlock builder</div>
            </div>
            <div className="rounded-2xl bg-success/15 p-4">
              <div className="flex items-center gap-2 mb-2"><Globe className="w-4 h-4 text-success" /><span className="text-sm font-semibold">Mainnet</span></div>
              <div className="text-xs text-muted-foreground">Real PUSD, Zerion-routed transactions, DFlow routes, Kamino positions</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-surface-dark text-surface-dark-foreground p-10 flex flex-col justify-between min-h-[400px] ap-grid-bg">
          <div className="text-xs uppercase tracking-[0.18em] text-white/50">For operators like Ada</div>
          <div>
            <p className="text-2xl md:text-3xl font-medium leading-snug" style={{ letterSpacing: "-0.025em" }}>
              "Clients pay in USDC, AUDD, and PUSD. Contractors want SOL or stables. I needed one
              dashboard that showed treasury health without leaking per-agent balances. ArcPay is that."
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-semibold text-black">
              A
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Ada, multi-agent agency operator</div>
              <div className="text-xs text-white/50">Treasury teams, agencies, and agent operators.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
