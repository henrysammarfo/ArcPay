"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopBar } from "@/components/app/AppTopBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type ProductRoute = {
  readonly options?: {
    readonly component?: () => ReactNode;
  };
  readonly component?: () => ReactNode;
};

export function renderProductRoute(route: ProductRoute): ReactNode {
  const Component = route.options?.component ?? route.component;

  if (!Component) {
    return null;
  }

  return <Component />;
}

export function ProductAppShell({ children }: { readonly children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col">
          <AppTopBar />
          <main className="flex-1 p-6 lg:p-8">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
