"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.policies";

export default function PoliciesPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
