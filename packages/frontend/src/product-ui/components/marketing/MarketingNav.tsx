"use client";

import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { LogoIcon } from "@/components/brand/LogoIcon";
import { NAV_LINKS } from "@/lib/marketing";
import { useAppAccess } from "@/hooks/use-app-access";

type Props = { tone?: "light" | "dark"; absolute?: boolean };

export function MarketingNav({ tone = "dark", absolute = false }: Props) {
  const [open, setOpen] = useState(false);
  const access = useAppAccess();
  const isDark = tone === "dark";
  const link = isDark ? "text-white/75 hover:text-white" : "text-foreground/70 hover:text-foreground";
  const wordmark = isDark ? "text-white" : "text-foreground";
  const cta = isDark
    ? "bg-white text-black hover:bg-white/90"
    : "bg-foreground text-background hover:opacity-90";

  return (
    <nav
      className={`${
        absolute ? "absolute top-0 left-0 right-0 z-30" : "relative z-30 border-b border-border bg-background"
      } px-6 py-5`}
    >
      <div className="max-w-[88rem] mx-auto flex items-center justify-between">
        <Link to="/" className={`inline-flex items-center gap-2 ${wordmark}`}>
          <LogoIcon className="w-7 h-7 text-primary" />
          <span className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
            ArcPay
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className={`${link} text-sm font-medium transition-colors`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          {!access.canOpenApp && (
            <Link
              to="/sign-in"
              className={`${link} text-sm font-medium transition-colors`}
            >
              Sign in
            </Link>
          )}
          <Link
            to={access.openAppPath}
            className={`${cta} text-sm font-medium px-5 py-2.5 rounded-full transition-colors`}
          >
            Open App
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`md:hidden ${isDark ? "text-white" : "text-foreground"}`}
          aria-label="Menu"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden mt-4 mx-auto max-w-[88rem] rounded-2xl bg-background border border-border p-4 flex flex-col gap-3">
          {NAV_LINKS.map((l) => (
            <Link key={l.label} to={l.to} className="text-foreground/80 text-sm font-medium">
              {l.label}
            </Link>
          ))}
          {!access.canOpenApp && <Link to="/sign-in" className="text-foreground/80 text-sm font-medium">Sign in</Link>}
          <Link to={access.openAppPath} className="bg-foreground text-background text-sm font-medium px-5 py-2.5 rounded-full text-center">
            Open App
          </Link>
        </div>
      )}
    </nav>
  );
}
