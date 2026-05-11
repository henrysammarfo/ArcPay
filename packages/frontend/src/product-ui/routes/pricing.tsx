import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeading } from "@/components/primitives/SectionHeading";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — ArcPay" },
      { name: "description", content: "Simple, transparent pricing for AI-agent treasuries on Solana." },
      { property: "og:title", content: "Pricing — ArcPay" },
      { property: "og:description", content: "Simple, transparent pricing for AI-agent treasuries." },
    ],
  }),
  component: PricingPage,
});

const TIERS = [
  {
    name: "Devnet",
    price: "Free",
    sub: "While in beta",
    cta: "Start on devnet",
    features: [
      "Unlimited devnet workspaces",
      "All policy controls",
      "Cloak devnet, Ika pre-alpha",
      "QuickNode webhook activity",
      "Audit export",
    ],
  },
  {
    name: "Operator",
    price: "$0.05",
    sub: "per settled $1k, mainnet only",
    cta: "Request mainnet",
    highlight: true,
    features: [
      "USDC, AUDD, PUSD, SOL",
      "Kamino yield routing",
      "DFlow + Zerion swap rails",
      "GoldRush risk scoring",
      "Up to 5 workspace members",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    sub: "Volume + private rails",
    cta: "Talk to us",
    features: [
      "Cloak / Umbra production rails",
      "LP Agent Zap-In (premium)",
      "Ika dWallet policy approvals",
      "SSO + workspace controls",
      "Dedicated infra & support",
    ],
  },
];

function PricingPage() {
  return (
    <MarketingShell navTone="light">
      <div className="px-6 pt-16 pb-24">
        <div className="max-w-[88rem] mx-auto">
          <SectionHeading
            align="center"
            eyebrow="Pricing"
            title={<>Pay only when value <span className="text-primary">settles</span>.</>}
            description="No seat licenses, no setup fees. Mainnet usage is metered on settled volume; devnet is free during beta."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={`rounded-3xl border p-8 flex flex-col ${
                  t.highlight
                    ? "border-primary bg-surface-dark text-surface-dark-foreground"
                    : "border-border bg-card"
                }`}
              >
                <div className="text-sm font-semibold uppercase tracking-[0.18em] mb-3 opacity-80">{t.name}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-medium" style={{ letterSpacing: "-0.03em" }}>
                    {t.price}
                  </span>
                </div>
                <div className={`text-sm mt-1 ${t.highlight ? "text-white/60" : "text-muted-foreground"}`}>{t.sub}</div>
                <ul className="mt-6 space-y-3 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className={`w-4 h-4 mt-0.5 ${t.highlight ? "text-primary" : "text-success"}`} />
                      <span className={t.highlight ? "text-white/85" : "text-foreground/85"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/sign-up"
                  className={`mt-8 inline-flex items-center justify-center text-sm font-medium px-5 py-3 rounded-full transition-colors ${
                    t.highlight
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                >
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
