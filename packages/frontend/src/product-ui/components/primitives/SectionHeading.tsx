import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
}) {
  const alignCls = align === "center" ? "text-center mx-auto" : "";
  const eyebrowColor = tone === "dark" ? "text-primary" : "text-primary";
  const titleColor = tone === "dark" ? "text-white" : "text-foreground";
  const descColor = tone === "dark" ? "text-white/60" : "text-muted-foreground";
  return (
    <div className={`max-w-2xl ${alignCls}`}>
      {eyebrow && (
        <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${eyebrowColor} mb-3`}>
          {eyebrow}
        </div>
      )}
      <h2
        className={`text-3xl md:text-5xl font-medium ${titleColor} leading-[1.05]`}
        style={{ letterSpacing: "-0.035em" }}
      >
        {title}
      </h2>
      {description && (
        <p className={`mt-4 text-base md:text-lg ${descColor} leading-relaxed`}>{description}</p>
      )}
    </div>
  );
}
