"use client";

import { renderProductRoute } from "../product-render";
import { Route } from "../../product-ui/routes/pricing";

export default function PricingPage() {
  return renderProductRoute(Route);
}
