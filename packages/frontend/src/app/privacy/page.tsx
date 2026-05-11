"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.privacy";

export default function PrivacyPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
