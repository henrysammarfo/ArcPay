import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LogoIcon } from "@/components/brand/LogoIcon";
import { AUTH_VIDEO_URL } from "@/lib/marketing";

type Step = { n: number; t: string };

export function AuthShell({
  steps,
  activeStep,
  heading,
  subheading,
  children,
}: {
  steps?: Step[];
  activeStep?: number;
  heading: string;
  subheading: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full bg-black p-2 lg:h-screen lg:overflow-hidden lg:p-4">
      {/* Left hero */}
      <aside className="hidden lg:flex w-[52%] relative flex-col items-center justify-end pb-24 px-12 rounded-3xl overflow-hidden shadow-2xl h-full">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source src={AUTH_VIDEO_URL} type="video/mp4" />
        </video>
        <div className="relative z-10 w-full max-w-sm space-y-7">
          <Link to="/" className="inline-flex items-center gap-2 text-white">
            <LogoIcon className="w-6 h-6" />
            <span className="text-xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
              ArcPay
            </span>
          </Link>
          <div>
            <h2 className="text-white text-3xl font-medium tracking-tight" style={{ letterSpacing: "-0.03em" }}>
              {heading}
            </h2>
            <p className="text-white/65 text-sm leading-relaxed mt-2">{subheading}</p>
          </div>
          {steps && (
            <div className="space-y-2">
              {steps.map((s) => {
                const active = s.n === activeStep;
                return (
                  <div
                    key={s.n}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                      active
                        ? "bg-white text-black border-white"
                        : "bg-white/5 text-white border-white/10"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                        active ? "bg-black text-white" : "bg-white/10 text-white/50"
                      }`}
                    >
                      {s.n}
                    </div>
                    <span className="text-sm font-medium">{s.t}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Right form */}
      <section className="flex-1 flex flex-col items-center justify-center bg-background rounded-3xl py-12 px-4 sm:px-12 lg:px-16 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 text-foreground mb-4">
            <LogoIcon className="w-6 h-6 text-primary" />
            <span className="text-xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
              ArcPay
            </span>
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
