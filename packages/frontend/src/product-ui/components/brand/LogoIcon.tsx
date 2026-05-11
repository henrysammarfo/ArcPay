import type { SVGProps } from "react";

export function LogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M 128.005 191.173 C 128.448 156.208 156.93 128 192 128 L 192 64 L 128 64 C 128 99.346 99.346 128 64 128 L 64 192 L 128 192 Z M 192 256 L 64 256 C 28.654 256 0 227.346 0 192 L 0 64 L 64 64 L 64 0 L 192 0 C 227.346 0 256 28.654 256 64 L 256 192 L 192 192 Z" />
    </svg>
  );
}

export function Wordmark({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  const icon = size === "lg" ? "w-8 h-8" : size === "sm" ? "w-5 h-5" : "w-7 h-7";
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <LogoIcon className={`${icon} text-primary`} />
      <span className={`${text} font-semibold tracking-tight`} style={{ letterSpacing: "-0.03em" }}>
        ArcPay
      </span>
    </div>
  );
}
