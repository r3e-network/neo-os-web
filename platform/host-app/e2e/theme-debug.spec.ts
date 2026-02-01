import { test } from "@playwright/test";

test.describe("Theme Debug", () => {
  test("debug theme switching in miniapp", async ({ page }) => {
    // Go to homepage
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Take screenshot of homepage
    await page.screenshot({ path: "e2e-results/01-homepage.png" });

    // Check current theme in host app
    const hostTheme = await page.evaluate(() => {
      return {
        localStorage: localStorage.getItem("theme"),
        darkClass: document.documentElement.classList.contains("dark"),
        htmlClasses: document.documentElement.className,
      };
    });
    console.log("Host App Theme State:", JSON.stringify(hostTheme, null, 2));

    // Find and click on a miniapp card
    const miniappCard = page.locator('[data-testid="miniapp-card"]').first();
    if (await miniappCard.isVisible()) {
      await miniappCard.click();
    } else {
      // Try alternative selector
      const appLink = page.locator('a[href*="/miniapps/"]').first();
      await appLink.click();
    }

    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e-results/02-miniapp-detail.png" });

    // Click launch button
    const launchBtn = page.locator("text=Launch").first();
    if (await launchBtn.isVisible()) {
      await launchBtn.click();
      await page.waitForLoadState("networkidle");
    }

    // Wait for iframe to load
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e-results/03-miniapp-launch.png" });

    // Check iframe URL
    const iframe = page.frameLocator("iframe").first();
    const iframeSrc = await page.locator("iframe").first().getAttribute("src");
    console.log("Iframe URL:", iframeSrc);

    // Check if theme parameter is in URL
    if (iframeSrc) {
      const hasThemeParam = iframeSrc.includes("theme=");
      console.log("Has theme parameter:", hasThemeParam);
    }

    // Try to access iframe content
    try {
      const iframeTheme = await iframe.locator("html").getAttribute("data-theme");
      console.log("Iframe data-theme:", iframeTheme);

      const iframeClasses = await iframe.locator("html").getAttribute("class");
      console.log("Iframe html classes:", iframeClasses);

      // Check CSS variables in iframe
      const cssVars = await iframe.locator("html").evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          bgPrimary: style.getPropertyValue("--bg-primary"),
          bgSecondary: style.getPropertyValue("--bg-secondary"),
          textPrimary: style.getPropertyValue("--text-primary"),
        };
      });
      console.log("Iframe CSS Variables:", JSON.stringify(cssVars, null, 2));
    } catch (e) {
      console.log("Could not access iframe content:", e);
    }

    // Take final screenshot
    await page.screenshot({ path: "e2e-results/04-final.png", fullPage: true });
  });
});
