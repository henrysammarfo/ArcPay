"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.invoices";

export default function InvoicesPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
