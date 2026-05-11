import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function RouteEmptyState({
  icon: Icon,
  title,
  description,
  bullets,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <div className="max-w-3xl">
      <Link to="/app/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to overview
      </Link>
      <div className="rounded-3xl border border-border bg-card p-10">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
          <Icon className="w-5 h-5" />
        </div>
        <h1 className="text-2xl md:text-3xl font-medium tracking-tight" style={{ letterSpacing: "-0.03em" }}>
          {title}
        </h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-xl">{description}</p>
        {bullets && bullets.length > 0 && (
          <ul className="mt-6 space-y-2">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="mt-2 w-1 h-1 rounded-full bg-primary" />
                {b}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Building in the next phase
        </div>
      </div>
    </div>
  );
}
