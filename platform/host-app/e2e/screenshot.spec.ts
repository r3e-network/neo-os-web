import { test } from "@playwright/test";

test("screenshot miniapp", async ({ page }) => {
  // Go directly to miniapp HTML
  await page.goto("/miniapps/council-governance/index.html?theme=dark");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "e2e-results/miniapp-dark.png", fullPage: true });

  // Check HTML attributes
  const attrs = await page.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute("data-theme"),
    classes: document.documentElement.className,
    bgColor: getComputedStyle(document.body).backgroundColor,
  }));
  console.log("Dark theme:", JSON.stringify(attrs, null, 2));

  // Now test light theme
  await page.goto("/miniapps/council-governance/index.html?theme=light");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "e2e-results/miniapp-light.png", fullPage: true });

  const lightAttrs = await page.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute("data-theme"),
    classes: document.documentElement.className,
    bgColor: getComputedStyle(document.body).backgroundColor,
  }));
  console.log("Light theme:", JSON.stringify(lightAttrs, null, 2));
});
