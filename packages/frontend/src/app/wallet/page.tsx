"use client";

import { ProductAppShell, renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/app.wallet";

export default function WalletPage() {
  return <ProductAppShell>{renderProductRoute(Route)}</ProductAppShell>;
}
