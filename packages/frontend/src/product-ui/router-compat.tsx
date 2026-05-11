"use client";

import NextLink from "next/link";
import { usePathname, useRouter as useNextRouter } from "next/navigation";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  readonly children?: ReactNode;
  readonly href?: string;
  readonly to?: string;
};

function normalizePath(value: string): string {
  if (value === "/app") {
    return "/dashboard";
  }

  if (value.startsWith("/app/")) {
    return value.replace(/^\/app/, "");
  }

  return value;
}

function toRouterPath(value: string): string {
  if (value === "/dashboard" || value.startsWith("/dashboard/")) {
    return value.replace(/^\/dashboard/, "/app/dashboard");
  }

  const appRoutes = [
    "wallet",
    "payments",
    "invoices",
    "contractors",
    "swaps",
    "yield",
    "privacy",
    "risk",
    "policies",
    "audit",
    "settings",
  ];

  const first = value.replace(/^\//, "").split("/")[0];
  return first && appRoutes.includes(first) ? `/app${value}` : value;
}

export function Link({ to, href, children, ...props }: LinkProps) {
  const target = normalizePath(to ?? href ?? "#");
  return (
    <NextLink href={target} {...props}>
      {children}
    </NextLink>
  );
}

export function createFileRoute(_path: string) {
  return function routeFactory<T extends Record<string, unknown>>(options: T): T & { options: T } {
    return { ...options, options };
  };
}

export function Outlet() {
  return null;
}

export function redirect(args: unknown) {
  return args;
}

export function useNavigate() {
  const router = useNextRouter();

  return ({ to }: { readonly to: string }) => {
    router.push(normalizePath(to));
  };
}

export function useRouterState<T = { location: { pathname: string } }>(args?: {
  readonly select?: (state: { location: { pathname: string } }) => T;
}): T {
  const pathname = usePathname();
  const state = { location: { pathname: toRouterPath(pathname) } };
  return args?.select ? args.select(state) : (state as T);
}

export function useRouter() {
  return {
    invalidate: () => undefined,
  };
}

export function HeadContent() {
  return null;
}

export function Scripts() {
  return null;
}
