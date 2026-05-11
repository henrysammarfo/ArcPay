import { expect, test } from "@playwright/test";

const pages = [
  { path: "/", heading: /treasury that thinks for your/i },
  { path: "/dashboard", heading: /good morning, ada/i },
  { path: "/wallet", heading: /^wallet$/i },
  { path: "/payments", heading: /^payments$/i },
  { path: "/invoices", heading: /^invoices$/i },
  { path: "/contractors", heading: /^contractors$/i },
  { path: "/swaps", heading: /^swaps$/i },
  { path: "/yield", heading: /^yield$/i },
  { path: "/privacy", heading: /^privacy$/i },
  { path: "/risk", heading: /^risk$/i },
  { path: "/policies", heading: /^policies$/i },
  { path: "/audit", heading: /^audit$/i },
  { path: "/proofs", heading: /proofs, separated/i },
  { path: "/sign-in", heading: /^sign in$/i },
  { path: "/sign-up", heading: /create your workspace/i },
  { path: "/forgot-password", heading: /forgot password/i },
  { path: "/reset-password", heading: /^new password$/i },
  { path: "/profile", heading: /^profile$/i },
  { path: "/settings", heading: /^settings$/i },
] as const;

for (const pageCase of pages) {
  test(`${pageCase.path} renders without horizontal overflow`, async ({ page }) => {
    await page.goto(pageCase.path, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: pageCase.heading })).toBeVisible();

    const overflow = await page.evaluate(() => {
      const documentWidth = document.documentElement.scrollWidth;
      const viewportWidth = document.documentElement.clientWidth;
      const overflowingNodes = Array.from(document.body.querySelectorAll("*"))
        .filter((node) => {
          if (node.closest(".hero-marquee, .backers-marquee")) {
            return false;
          }

          const rect = node.getBoundingClientRect();
          return rect.right > viewportWidth + 1 || rect.left < -1;
        })
        .slice(0, 8)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            tag: node.tagName.toLowerCase(),
            className: node.getAttribute("class"),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
          };
        });

      return {
        documentWidth,
        viewportWidth,
        overflowingNodes,
      };
    });

    expect(overflow.documentWidth, JSON.stringify(overflow, null, 2)).toBeLessThanOrEqual(
      overflow.viewportWidth + 1,
    );
    expect(overflow.overflowingNodes, JSON.stringify(overflow, null, 2)).toEqual([]);
  });
}

test("proofs route exposes honest track states", async ({ page }) => {
  await page.goto("/proofs", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: /proofs, separated/i })).toBeVisible();
  await expect(page.getByText("QVAC", { exact: true })).toBeVisible();
  await expect(page.getByText(/native Linux/i)).toBeVisible();
  await expect(page.getByText("LP Agent", { exact: true })).toBeVisible();
  await expect(page.getByText(/server supports Zap-In transaction builds/i)).toBeVisible();
  await expect(page.getByText("PUSD", { exact: true })).toBeVisible();
  await expect(page.getByText("needs wallet", { exact: true }).first()).toBeVisible();
});
