import { useEffect, useState } from "react";
import { Wallet, Lock, Coins, TrendingUp } from "lucide-react";
import { SectionHeading } from "@/components/primitives/SectionHeading";
import { StatCard } from "@/components/primitives/StatCard";

const SAMPLE = [
  { t: "00:00", in: 1200, out: 800 },
  { t: "04:00", in: 2200, out: 1200 },
  { t: "08:00", in: 3400, out: 1800 },
  { t: "12:00", in: 4800, out: 2900 },
  { t: "16:00", in: 4100, out: 3500 },
  { t: "20:00", in: 5400, out: 3200 },
  { t: "24:00", in: 6200, out: 3900 },
];

export function WorkflowPreview() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="bg-background pt-8 pb-24 px-6">
      <div className="max-w-[88rem] mx-auto">
        <div className="rounded-3xl bg-surface-dark text-surface-dark-foreground p-6 md:p-10 ap-grid-bg">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <SectionHeading
              tone="dark"
              eyebrow="Live treasury"
              title="A finance dashboard for daily agent operations."
              description="Balances, approvals, route checks, yield sweeps, and risk signals stay in one operator view."
            />
            <span className="inline-flex items-center gap-2 self-start text-xs text-white/60 px-3 py-1.5 rounded-full border border-white/15">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Connect a wallet for live data
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard tone="dark" icon={Wallet} label="Operating" value="$184,420" delta={{ value: "2.3%", direction: "up" }} hint="USDC + PUSD + AUDD" />
            <StatCard tone="dark" icon={Lock} label="Shielded" value="$62,910" delta={{ value: "0.8%", direction: "up" }} hint="Cloak + Umbra routes" />
            <StatCard tone="dark" icon={Coins} label="Idle" value="$11,304" delta={{ value: "12%", direction: "down" }} hint="Sweep eligible" />
            <StatCard tone="dark" icon={TrendingUp} label="Yield running" value="$48,200" delta={{ value: "8.2% APY", direction: "up" }} hint="Kamino positions" emphasis />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <div className="lg:col-span-2 rounded-2xl bg-white/[0.04] border border-white/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider">24h flow</div>
                  <div className="text-xl font-medium mt-1">Inflow vs outflow</div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-white/70"><span className="w-2 h-2 rounded-full bg-primary" /> Inflow</span>
                  <span className="inline-flex items-center gap-1.5 text-white/70"><span className="w-2 h-2 rounded-full bg-accent" /> Outflow</span>
                </div>
              </div>
              <div className="h-56">
                {mounted ? <PreviewChart /> : <div className="h-full rounded-xl bg-white/[0.04]" />}
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 flex flex-col">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-4">Pending approvals</div>
              <div className="flex flex-col gap-3 flex-1">
                {[
                  { who: "Contractor payroll", amt: "$4,200 USDC", risk: "Approve" },
                  { who: "Swap to AUDD", amt: "$1,800", risk: "Review" },
                  { who: "Kamino top-up", amt: "$10,000", risk: "Approve" },
                ].map((r) => (
                  <div key={r.who} className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-3 border border-white/5">
                    <div>
                      <div className="text-sm font-medium text-white">{r.who}</div>
                      <div className="text-xs text-white/50">{r.amt}</div>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      r.risk === "Approve" ? "bg-success/20 text-success" : "bg-warning/20 text-warning-foreground"
                    }`}>
                      {r.risk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewChart() {
  const width = 760;
  const height = 220;
  const padX = 26;
  const padY = 20;
  const max = Math.max(...SAMPLE.flatMap((row) => [row.in, row.out]));
  const points = (key: "in" | "out") =>
    SAMPLE.map((row, index) => {
      const x = padX + (index / (SAMPLE.length - 1)) * (width - padX * 2);
      const y = height - padY - (row[key] / max) * (height - padY * 2);
      return `${x},${y}`;
    }).join(" ");
  const area = (key: "in" | "out") => `${padX},${height - padY} ${points(key)} ${width - padX},${height - padY}`;

  return (
    <svg aria-label="Preview treasury flow chart" className="h-full w-full" role="img" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="previewIn" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.74 0.18 47)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="oklch(0.74 0.18 47)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="previewOut" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.85 0.13 85)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.85 0.13 85)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line key={ratio} x1={padX} x2={width - padX} y1={height * ratio} y2={height * ratio} stroke="rgba(255,255,255,0.06)" strokeDasharray="5 8" />
      ))}
      <polygon points={area("in")} fill="url(#previewIn)" />
      <polygon points={area("out")} fill="url(#previewOut)" />
      <polyline points={points("in")} fill="none" stroke="oklch(0.74 0.18 47)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      <polyline points={points("out")} fill="none" stroke="oklch(0.85 0.13 85)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
    </svg>
  );
}
