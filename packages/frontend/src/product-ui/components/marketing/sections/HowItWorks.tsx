import { Inbox, Shield, Sparkles, Send } from "lucide-react";
import { SectionHeading } from "@/components/primitives/SectionHeading";

const STEPS = [
  {
    icon: Inbox,
    name: "Receive",
    body: "Agents collect payment via x402-style endpoints, invoices, and pay links — in USDC, AUDD, PUSD, or SOL.",
  },
  {
    icon: Shield,
    name: "Shield",
    body: "Route incoming funds into shielded balances with viewing-key disclosure, so the public ledger doesn't leak per-agent revenue.",
  },
  {
    icon: Sparkles,
    name: "Earn",
    body: "Idle dollars sweep into Kamino and (when enabled) LP Agent Zap-In, with policy-bounded risk levels.",
  },
  {
    icon: Send,
    name: "Pay",
    body: "Pay contractors and run batch payroll through DFlow / Zerion routes, with GoldRush risk scoring at the review step.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-background py-24 px-6">
      <div className="max-w-[88rem] mx-auto">
        <SectionHeading
          eyebrow="How ArcPay works"
          title={<>One pipeline, <span className="text-primary">four moves</span>.</>}
          description="Every dollar that lands in an agent wallet flows through the same auditable pipeline. You decide the policies; ArcPay enforces them."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {STEPS.map((s, i) => (
            <div key={s.name} className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <s.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">0{i + 1}</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{s.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
