import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { MarketingNav } from "../MarketingNav";
import { HERO_VIDEO_URL, PARTNERS } from "@/lib/marketing";
import { useAppAccess } from "@/hooks/use-app-access";

export function Hero() {
  const access = useAppAccess();

  return (
    <section className="relative bg-background">
      <div className="h-screen flex flex-col overflow-hidden">
        <MarketingNav tone="light" absolute />
        <div className="flex-1 px-4 md:px-6 pt-20 pb-6 flex items-end">
          <div
            className="relative w-full rounded-3xl overflow-hidden max-w-[88rem] mx-auto"
            style={{ height: "calc(100vh - 96px)" }}
          >
            <video
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            >
              <source src={HERO_VIDEO_URL} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/20" />
            <div className="relative z-10 flex flex-col items-start justify-end h-full p-8 md:p-14">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur border border-white/20 px-3 py-1 text-xs text-white/85 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Solana mainnet beta
              </div>
              <h1
                className="text-white text-4xl md:text-6xl lg:text-7xl font-medium leading-[1.02] max-w-3xl mb-5"
                style={{ letterSpacing: "-0.04em" }}
              >
                Treasury that thinks
                <br />
                for your agents.
              </h1>
              <p className="text-white/75 text-base md:text-lg max-w-xl mb-8 leading-relaxed">
                ArcPay is the private operating account for AI-agent businesses on Solana —
                receive paid requests, shield balances, earn yield, route swaps, and pay
                contractors under one policy.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={access.canOpenApp ? "/app/dashboard" : "/onboard"}
                  className="inline-flex items-center gap-3 bg-white text-black text-base md:text-lg font-medium pl-6 pr-1.5 py-1.5 rounded-full hover:bg-white/90 transition-colors"
                >
                  <span>{access.canOpenApp ? "Open App" : "Join the beta"}</span>
                  <span className="bg-black rounded-full p-2.5 inline-flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </span>
                </Link>
                {!access.canOpenApp && (
                  <Link
                    to="/sign-in"
                    className="inline-flex items-center gap-2 text-white/85 hover:text-white text-sm md:text-base font-medium px-5 py-2.5 rounded-full border border-white/20 hover:border-white/40 transition-colors"
                  >
                    Sign in
                  </Link>
                )}
              </div>

              {/* Marquee */}
              <div className="hero-marquee mt-12 w-full max-w-md overflow-hidden">
                <div className="text-xs text-white/50 mb-3 uppercase tracking-[0.18em]">Wired into</div>
                <div className="relative">
                  <div className="ap-marquee flex gap-10 whitespace-nowrap">
                    {[...PARTNERS, ...PARTNERS].map((p, i) => (
                      <span key={i} className="text-white/85 text-base font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
