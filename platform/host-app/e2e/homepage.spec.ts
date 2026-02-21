import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load homepage", async ({ page }) => {
    await expect(page).toHaveTitle(/NeoHub|Neo/i);
  });

  test("should display navigation", async ({ page }) => {
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("should have Connect Wallet button", async ({ page }) => {
    const connectBtn = page.getByRole("button", { name: /connect wallet/i });
    await expect(connectBtn).toBeVisible();
  });

  test("should navigate to MiniApps page", async ({ page }) => {
    const miniappsLink = page.getByRole("link", { name: /miniapps|apps/i }).first();
    if (await miniappsLink.isVisible()) {
      await miniappsLink.click();
      await expect(page).toHaveURL(/miniapps/);
    }
  });
});
