import type { ReactNode } from "react";
import { MarketingNav } from "./MarketingNav";
import { MarketingFooter } from "./MarketingFooter";

export function MarketingShell({ children, navTone = "light" }: { children: ReactNode; navTone?: "light" | "dark" }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingNav tone={navTone} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
