import { Eye, EyeOff, KeyRound } from "lucide-react";
import { SectionHeading } from "@/components/primitives/SectionHeading";

export function PrivacyAudit() {
  return (
    <section className="bg-background pb-24 px-6">
      <div className="max-w-[88rem] mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4">
        <div className="rounded-3xl bg-card border border-border p-10">
          <SectionHeading
            eyebrow="Privacy & audit"
            title="Public ledger does not have to mean public revenue."
            description="ArcPay routes incoming and outgoing funds through shielded rails when available, then exports viewing-key reports when finance, tax, or compliance teams need disclosure."
          />
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: EyeOff, t: "Shield", b: "Private payment rails" },
              { icon: KeyRound, t: "Disclose", b: "Scoped viewing keys" },
              { icon: Eye, t: "Audit", b: "Date-range exports" },
            ].map((c) => (
              <div key={c.t} className="rounded-xl bg-muted p-4">
                <c.icon className="w-4 h-4 text-primary mb-2" />
                <div className="text-sm font-semibold">{c.t}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.b}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl bg-surface-dark text-surface-dark-foreground p-10 flex flex-col justify-between min-h-[420px] ap-grid-bg">
          <div className="text-xs uppercase tracking-[0.18em] text-white/50">Compliance posture</div>
          <div>
            <p className="text-2xl md:text-3xl font-medium leading-snug" style={{ letterSpacing: "-0.025em" }}>
              "Treasury privacy should not remove oversight. ArcPay keeps the public trail minimal while giving approved reviewers the records they need."
            </p>
            <div className="mt-6 text-sm text-white/55">ArcPay compliance principle</div>
          </div>
        </div>
      </div>
    </section>
  );
}
