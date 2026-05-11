"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.swaps";

export default function SwapsPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
