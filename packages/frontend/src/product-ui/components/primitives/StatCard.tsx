import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  icon?: LucideIcon;
  tone?: "light" | "dark";
  emphasis?: boolean;
};

export function StatCard({ label, value, hint, delta, icon: Icon, tone = "light", emphasis = false }: Props) {
  const isDark = tone === "dark";
  const base = isDark
    ? "bg-surface-dark text-surface-dark-foreground border-white/10"
    : "bg-card text-card-foreground border-border";
  return (
    <div className={`relative rounded-2xl border ${base} p-5 flex flex-col gap-3 ${emphasis ? "ring-1 ring-primary/30" : ""}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-muted-foreground"}`}>
          {label}
        </span>
        {Icon && (
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? "bg-white/5" : "bg-muted"}`}>
            <Icon className={`w-4 h-4 ${isDark ? "text-white/70" : "text-muted-foreground"}`} />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <div className="text-2xl md:text-3xl font-medium tracking-tight" style={{ letterSpacing: "-0.025em" }}>
          {value}
        </div>
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium ${
              delta.direction === "up" ? "text-success" : delta.direction === "down" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {delta.direction === "up" ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : delta.direction === "down" ? (
              <ArrowDownRight className="w-3.5 h-3.5" />
            ) : null}
            {delta.value}
          </span>
        )}
      </div>
      {hint && <div className={`text-xs ${isDark ? "text-white/45" : "text-muted-foreground"}`}>{hint}</div>}
    </div>
  );
}
