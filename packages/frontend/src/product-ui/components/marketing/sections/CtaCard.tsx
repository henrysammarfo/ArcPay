import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function CtaCard() {
  return (
    <section className="bg-background pb-16 px-6">
      <div className="max-w-[88rem] mx-auto">
        <div
          className="ap-animated-gradient rounded-3xl py-20 px-8 md:px-16 text-white flex flex-col items-center text-center"
          style={{ boxShadow: "0 20px 60px -20px rgba(0,0,0,0.4)" }}
        >
          <h2
            className="text-4xl md:text-6xl font-medium leading-[1.05] mb-4 max-w-3xl"
            style={{ letterSpacing: "-0.035em" }}
          >
            Ready to give your agents
            <br />
            a treasury that thinks?
          </h2>
          <p className="text-base md:text-lg text-white/85 mb-8 max-w-xl">
            Join the ArcPay beta. Devnet is open today; mainnet rolls out by invite.
          </p>
          <Link
            to="/sign-up"
            className="inline-flex items-center gap-3 bg-foreground text-background pl-6 pr-1.5 py-1.5 rounded-full text-base font-semibold transition-transform hover:-translate-y-0.5"
            style={{ boxShadow: "0 14px 30px rgba(0,0,0,0.4)" }}
          >
            <span>Get started</span>
            <span className="bg-background text-foreground rounded-full p-2 inline-flex items-center justify-center">
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
