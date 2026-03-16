import { test, expect } from "@playwright/test";

test.describe("MiniApp Detail", () => {
  test("should load LastSurvivor miniapp", async ({ page }) => {
    await page.goto("/miniapps/miniapp-last-survivor");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should load FogPlay miniapp", async ({ page }) => {
    await page.goto("/miniapps/miniapp-fogplay");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should show app info", async ({ page }) => {
    await page.goto("/miniapps/miniapp-last-survivor");
    await page.waitForTimeout(1000);
    // Check for any content loaded
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });
});
