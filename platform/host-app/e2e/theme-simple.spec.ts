import { test } from "@playwright/test";

test("verify miniapp theme", async ({ page }) => {
  // Go directly to miniapp launch page
  await page.goto("/miniapps/council-governance");
  await page.waitForTimeout(3000);

  // Get iframe
  const iframe = page.frameLocator("iframe");

  // Check iframe HTML attributes
  const htmlAttrs = await iframe.locator("html").evaluate((el) => ({
    dataTheme: el.getAttribute("data-theme"),
    className: el.className,
  }));
  console.log("Iframe HTML attributes:", htmlAttrs);

  // Check CSS variables
  const cssVars = await iframe.locator("html").evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      bgPrimary: style.getPropertyValue("--bg-primary").trim(),
      textPrimary: style.getPropertyValue("--text-primary").trim(),
    };
  });
  console.log("CSS Variables:", cssVars);

  // Take screenshot
  await page.screenshot({ path: "e2e-results/theme-test.png" });
});
