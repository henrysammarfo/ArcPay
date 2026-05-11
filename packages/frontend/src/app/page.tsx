"use client";

import { renderProductRoute } from "./product-render";
import { Route } from "../product-ui/routes/index";

export default function HomePage() {
  return renderProductRoute(Route);
}
