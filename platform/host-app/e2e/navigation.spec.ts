import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("should navigate between pages", async ({ page }) => {
    await page.goto("/");

    // Check home loads
    await expect(page.locator("body")).toBeVisible();

    // Navigate to miniapps
    await page.goto("/miniapps");
    await expect(page).toHaveURL(/miniapps/);
  });

  test("should handle 404 gracefully", async ({ page }) => {
    await page.goto("/nonexistent-page");
    // Should not crash
    await expect(page.locator("body")).toBeVisible();
  });
});
