"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.payments";

export default function PaymentsPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
