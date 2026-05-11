"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.dashboard";

export default function DashboardPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
