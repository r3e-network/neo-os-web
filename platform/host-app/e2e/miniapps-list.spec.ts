import { test, expect } from "@playwright/test";

test.describe("MiniApps List", () => {
  test.beforeEach(async ({ page }) => {
    const catalogRequest = page.waitForResponse((response) => response.url().includes("/api/miniapps/catalog"));
    await Promise.all([catalogRequest, page.goto("/miniapps")]);
  });

  test("should display the flagship catalog hero", async ({ page }) => {
    await expect(page.getByText("Neo N3 Mainnet")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Flagship MiniApps" })).toBeVisible();
    await expect(page.getByText("Nine flagship miniapps with production workflows. Pick one and start using it.")).toBeVisible();
  });

  test("should render the canonical flagship cards", async ({ page }) => {
    const cards = page.locator('a[href^="/miniapps/miniapp-"]');
    await expect(cards).toHaveCount(9);
    await expect(page.locator('a[href="/miniapps/miniapp-last-survivor"]')).toBeVisible();
    await expect(page.locator('a[href="/miniapps/miniapp-fogplay"]')).toBeVisible();
    await expect(page.locator('a[href="/miniapps/miniapp-neo-pay"]')).toBeVisible();
    await expect(page.locator('a[href="/miniapps/miniapp-profitanchor"]')).toBeVisible();
    await expect(page.locator('a[href="/miniapps/miniapp-trustanchor"]')).toBeVisible();
  });

  test("should link flagship cards to their detail pages", async ({ page }) => {
    await expect(page.locator('a[href="/miniapps/miniapp-last-survivor"]')).toHaveAttribute("href", "/miniapps/miniapp-last-survivor");
    await expect(page.locator('a[href="/miniapps/miniapp-redenvelope"]')).toHaveAttribute("href", "/miniapps/miniapp-redenvelope");
    await expect(page.locator('a[href="/miniapps/miniapp-self-loan"]')).toHaveAttribute("href", "/miniapps/miniapp-self-loan");
  });

  test("should show flagship status and category metadata", async ({ page }) => {
    await expect(page.getByText("Live").first()).toBeVisible();
    await expect(page.getByText("gaming").first()).toBeVisible();
    await expect(page.getByText("social").first()).toBeVisible();
    await expect(page.getByText("defi").first()).toBeVisible();
  });
});
