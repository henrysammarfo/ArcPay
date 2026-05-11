"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.settings";

export default function SettingsPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
