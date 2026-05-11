"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.risk";

export default function RiskPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
