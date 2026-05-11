import { Link } from "@tanstack/react-router";
import { LogoIcon } from "@/components/brand/LogoIcon";
import { FOOTER_VIDEO_URL } from "@/lib/marketing";
import { siGithub, siX } from "simple-icons";

const NAV = [
  { title: "Product", links: [
    { label: "Overview", to: "/" },
    { label: "Solutions", to: "/solutions" },
    { label: "Pricing", to: "/pricing" },
    { label: "Security", to: "/security" },
  ]},
  { title: "Company", links: [
    { label: "Sign in", to: "/sign-in" },
    { label: "Sign up", to: "/sign-up" },
    { label: "Proofs", to: "/proofs" },
  ]},
];

const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";

function SocialLogo({ path }: { readonly path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current text-white">
      <path d={path} />
    </svg>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-background pt-20 pb-10 px-6">
      <div className="max-w-[88rem] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
          {/* Left video card */}
          <div className="relative rounded-3xl overflow-hidden p-8 min-h-[340px] flex flex-col justify-between" style={{ background: "#0F1418" }}>
            <video
              className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            >
              <source src={FOOTER_VIDEO_URL} type="video/mp4" />
            </video>
            <div className="relative z-10 inline-flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/30 backdrop-blur flex items-center justify-center">
                <LogoIcon className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                ArcPay
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-white text-lg leading-snug max-w-xs">
                Treasury automation,<br />
                <span className="text-white/65">policy-controlled and private.</span>
              </p>
            </div>
            <div className="relative z-10 flex items-center justify-between gap-3">
              <span className="text-white/85 text-sm" style={{ fontFamily: "ui-sans-serif" }}>Stay in touch</span>
              <div className="flex items-center gap-2">
                {[siX.path, LINKEDIN_PATH, siGithub.path].map((path, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-9 h-9 rounded-lg bg-black/60 hover:bg-black flex items-center justify-center transition-all hover:-translate-y-0.5"
                    aria-label="Social"
                  >
                    <SocialLogo path={path} />
                  </a>
                ))}
              </div>
            </div>
          </div>
          {/* Right gray card */}
          <div className="relative rounded-3xl bg-muted p-10 flex flex-col justify-between min-h-[340px]">
            <div className="grid grid-cols-2 gap-12">
              {NAV.map((col) => (
                <div key={col.title}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
                    {col.title}
                  </div>
                  <div className="flex flex-col gap-3">
                    {col.links.map((l) => (
                      <Link key={l.label} to={l.to} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end justify-between gap-6 mt-10">
              <div className="text-xs text-muted-foreground">© 2026 ArcPay Labs. All rights reserved.</div>
              <div className="flex flex-col gap-3 w-full sm:w-auto sm:max-w-sm">
                <p className="text-sm text-muted-foreground">
                  AI moves fast. <span className="text-foreground font-semibold">Get on the beta list.</span>
                </p>
                <form className="flex gap-1 bg-background border border-border rounded-xl p-1.5">
                  <input
                    type="email"
                    placeholder="Enter email address"
                    className="flex-1 bg-transparent outline-none px-3 py-2 text-sm placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    className="bg-foreground text-background text-sm font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Notify me
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Watermark */}
        <div aria-hidden className="mt-8 select-none pointer-events-none">
          <svg viewBox="0 0 1000 220" preserveAspectRatio="xMidYMid meet" className="w-full h-auto block overflow-visible">
            <text
              x="500"
              y="170"
              textAnchor="middle"
              fontSize="240"
              fontWeight={700}
              style={{ letterSpacing: "-0.04em", fontFamily: "Inter, sans-serif" }}
              fill="oklch(0.18 0.015 250 / 0.06)"
            >
              ArcPay
            </text>
          </svg>
        </div>
      </div>
    </footer>
  );
}
