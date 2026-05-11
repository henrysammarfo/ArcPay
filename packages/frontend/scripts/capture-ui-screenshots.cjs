const { chromium } = require("playwright");

const routes = ["/", "/dashboard", "/wallet", "/yield", "/risk", "/policies", "/audit", "/settings"];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { width: 1440, height: 1000 },
  });

  for (const route of routes) {
    await page.goto(`http://127.0.0.1:3000${route}`, {
      timeout: 60_000,
      waitUntil: "networkidle",
    });
    await page.screenshot({
      fullPage: true,
      path: `packages/frontend/screenshots${route === "/" ? "/landing" : route}.png`,
    });
  }

  const mobile = await browser.newPage({
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  await mobile.goto("http://127.0.0.1:3000/dashboard", {
    timeout: 60_000,
    waitUntil: "networkidle",
  });
  await mobile.screenshot({
    fullPage: true,
    path: "packages/frontend/screenshots/dashboard-mobile.png",
  });

  await browser.close();
})();
