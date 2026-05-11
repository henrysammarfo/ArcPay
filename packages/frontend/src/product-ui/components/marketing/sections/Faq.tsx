import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { SectionHeading } from "@/components/primitives/SectionHeading";

const FAQS = [
  {
    q: "Which tokens does ArcPay support?",
    a: "Today: USDC, SOL, PUSD (mainnet pending fund), and AUDD for AUD settlement. More stable rails will come as native pools and routes are confirmed live.",
  },
  {
    q: "How is privacy actually delivered?",
    a: "Through Cloak and Umbra rails on Solana, with viewing-key disclosure for compliance. ArcPay labels each rail as devnet, pre-alpha, or production-ready, and never claims final privacy on a route that isn't live.",
  },
  {
    q: "Do you hold custody of funds?",
    a: "No. ArcPay is policy-controlled, not custodial. Signing happens in your wallet (and, when enabled, via Ika dWallet policy approvals). ArcPay enforces guardrails — it never moves money on its own.",
  },
  {
    q: "What happens when a route or pool isn't available?",
    a: "You get a real provider-style error: 'Insufficient SOL for network fees.', 'No active PUSD/USDC pool found.', 'Route minimum is 10 USDC.' We never pretend a transaction worked.",
  },
  {
    q: "Can I export an audit report?",
    a: "Yes. The audit page produces a date-range export including transaction signatures, viewing-key requests, and a 'public ledger shows X / private report reveals Y' explanation for each entry.",
  },
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="bg-background py-24 px-6">
      <div className="max-w-[88rem] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12">
        <SectionHeading
          eyebrow="FAQ"
          title="Straightforward answers."
          description="If you have a question we haven't covered, ping us — we'd rather give an honest 'not yet' than a marketing answer."
        />
        <div className="flex flex-col gap-3">
          {FAQS.map((f, i) => {
            const active = open === i;
            return (
              <button
                key={f.q}
                type="button"
                onClick={() => setOpen(active ? -1 : i)}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  active ? "border-foreground/15 bg-card shadow-sm" : "border-border bg-card hover:border-foreground/15"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-base font-medium">{f.q}</span>
                  {active ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
                {active && <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
