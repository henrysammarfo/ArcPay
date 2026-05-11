"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.yield";

export default function YieldPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
