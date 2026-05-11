import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  to?: string;
  href?: string;
  children: ReactNode;
  variant?: "dark" | "light" | "primary";
  withArrow?: boolean;
  size?: "md" | "lg";
  className?: string;
  onClick?: () => void;
};

export function PillButton({
  to,
  href,
  children,
  variant = "dark",
  withArrow = false,
  size = "md",
  className = "",
  onClick,
}: Props) {
  const base =
    variant === "light"
      ? "bg-white text-black hover:bg-white/90"
      : variant === "primary"
        ? "bg-primary text-primary-foreground hover:brightness-110"
        : "bg-black text-white hover:bg-neutral-800";
  const padding = withArrow
    ? size === "lg"
      ? "pl-7 pr-2 py-2"
      : "pl-6 pr-2 py-1.5"
    : size === "lg"
      ? "px-7 py-3"
      : "px-6 py-2.5";
  const text = size === "lg" ? "text-base md:text-lg" : "text-sm md:text-base";

  const content = (
    <span className={`inline-flex items-center gap-3 ${base} ${padding} ${text} font-medium rounded-full transition-all duration-200 ${className}`}>
      <span>{children}</span>
      {withArrow && (
        <span className="bg-white text-black rounded-full p-2 inline-flex items-center justify-center">
          <ArrowRight className="w-4 h-4" />
        </span>
      )}
    </span>
  );

  if (to) return <Link to={to}>{content}</Link>;
  if (href) return <a href={href}>{content}</a>;
  return <button type="button" onClick={onClick}>{content}</button>;
}
