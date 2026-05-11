"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.contractors";

export default function ContractorsPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
