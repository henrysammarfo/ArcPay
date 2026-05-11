"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.audit";

export default function AuditPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
