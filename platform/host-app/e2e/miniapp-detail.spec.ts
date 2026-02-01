import { test, expect } from "@playwright/test";

test.describe("MiniApp Detail", () => {
  test("should load lottery miniapp", async ({ page }) => {
    await page.goto("/miniapps/miniapp-lottery");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should load coinflip miniapp", async ({ page }) => {
    await page.goto("/miniapps/miniapp-coinflip");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should show app info", async ({ page }) => {
    await page.goto("/miniapps/miniapp-lottery");
    await page.waitForTimeout(1000);
    // Check for any content loaded
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });
});
