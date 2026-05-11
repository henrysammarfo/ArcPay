import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";

export type ReviewRow = { label: string; value: ReactNode; mono?: boolean; warn?: boolean };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  rows: ReviewRow[];
  warnings?: string[];
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
};

export function ReviewModal({ open, onOpenChange, title, description, rows, warnings, confirmLabel = "Confirm & sign", onConfirm }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handle() {
    setSubmitting(true);
    try {
      await onConfirm();
      setDone(true);
      setTimeout(() => {
        onOpenChange(false);
        setSubmitting(false);
        setDone(false);
      }, 1200);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl tracking-tight" style={{ letterSpacing: "-0.02em" }}>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="rounded-xl bg-muted/60 divide-y divide-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</div>
              <div className={`text-sm text-right ${r.mono ? "font-mono" : "font-medium"} ${r.warn ? "text-warning-foreground" : ""}`}>{r.value}</div>
            </div>
          ))}
        </div>
        {warnings && warnings.length > 0 && (
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {warnings.map((w) => (
              <li key={w} className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-warning shrink-0" />{w}</li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-success" /> ArcPay never auto-submits. You sign every transaction.
        </div>
        <DialogFooter className="gap-2">
          <button type="button" disabled={submitting} onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-full text-sm font-medium hover:bg-muted disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={submitting} onClick={handle} className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-70">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {done ? "Submitted" : "Signing…"}</> : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
