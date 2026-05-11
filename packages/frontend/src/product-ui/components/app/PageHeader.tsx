import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { NetworkBadge } from "@/components/primitives/NetworkBadge";

export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  back = true,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 mb-6">
      {back && (
        <Link to="/app/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Overview
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            {eyebrow ?? "ArcPay"} <NetworkBadge />
          </div>
          <div className="flex items-center gap-3 mt-2">
            {Icon && (
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </span>
            )}
            <h1 className="text-3xl md:text-4xl font-medium tracking-tight" style={{ letterSpacing: "-0.03em" }}>{title}</h1>
          </div>
          {description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
