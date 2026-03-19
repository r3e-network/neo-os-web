import { test, expect } from "@playwright/test";

test.describe("MiniApps List", () => {
  test.beforeEach(async ({ page }) => {
    const catalogRequest = page
      .waitForResponse((response) => response.url().includes("/api/miniapps/catalog"))
      .catch(() => null);
    const communityRequest = page
      .waitForResponse((response) => response.url().includes("/api/miniapps/community"))
      .catch(() => null);

    await page.goto("/miniapps");
    await Promise.all([catalogRequest, communityRequest]);
  });

  test("should display MiniApps hero and controls", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /One catalog\. Seven flagship miniapps\./i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Primary miniapps/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /All MiniApps/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Filters/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sort options" })).toBeVisible();
    await expect(page.getByRole("button", { name: "List view" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Grid view" })).toBeVisible();
  });

  test("should show MiniApp cards or fallback state", async ({ page }) => {
    const cards = page.locator('a[aria-label^="View "]');
    const cardCount = await cards.count();

    if (cardCount > 0) {
      await expect(cards.first()).toBeVisible();
    } else {
      const fallbackMessage = page.locator("text=No apps to display");
      const errorAlert = page.locator("role=alert");
      const visibleFallback = await fallbackMessage.count();
      const visibleAlert = await errorAlert.count();
      expect(visibleFallback + visibleAlert).toBeGreaterThan(0);
    }
  });

  test("should have search functionality", async ({ page }) => {
    const searchInput = page.getByRole("searchbox", { name: /search/i }).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("survivor");
    await expect(searchInput).toHaveValue("survivor");
    await searchInput.fill("");
  });

  test("should filter by category", async ({ page }) => {
    const categorySection = page.getByRole("button", { name: "Category" });
    if ((await categorySection.getAttribute("aria-expanded")) === "false") {
      await categorySection.click();
    }

    const gamingOption = page.locator("label", { hasText: "Gaming" }).first();
    await expect(gamingOption).toBeVisible();

    const checkIcon = gamingOption.locator("svg");
    await expect(checkIcon).toHaveCount(0);

    await gamingOption.click();
    await expect(checkIcon).toHaveCount(1);

    await gamingOption.click();
    await expect(checkIcon).toHaveCount(0);
  });
});
