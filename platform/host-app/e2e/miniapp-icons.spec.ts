import { test, expect } from "@playwright/test";

test.describe("MiniApp Icons and Banners", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/miniapps");
    // Wait for lazy loading to complete
    await page.waitForTimeout(3000);
  });

  test("should display MiniApp cards with images", async ({ page }) => {
    // Check that cards are rendered
    const cards = page.locator('a[href^="/miniapps/miniapp-"]');
    const count = await cards.count();
    console.log(`Found ${count} MiniApp cards`);
    expect(count).toBeGreaterThan(0);
  });

  test("should load banner images correctly", async ({ page }) => {
    // Find all banner images
    const bannerImages = page.locator('img[src*="/static/banner.jpg"]');
    const count = await bannerImages.count();
    console.log(`Found ${count} banner images`);

    if (count > 0) {
      // Check first banner is visible and loaded
      const firstBanner = bannerImages.first();
      await expect(firstBanner).toBeVisible();

      // Verify image loaded successfully (naturalWidth > 0)
      const isLoaded = await firstBanner.evaluate((img: HTMLImageElement) => {
        return img.complete && img.naturalWidth > 0;
      });
      expect(isLoaded).toBe(true);
    }
  });

  test("should load icon images correctly", async ({ page }) => {
    // Find all icon images
    const iconImages = page.locator('img[src*="/static/logo.jpg"]');
    const count = await iconImages.count();
    console.log(`Found ${count} icon images`);

    if (count > 0) {
      const firstIcon = iconImages.first();
      await expect(firstIcon).toBeVisible();
    }
  });

  test("should verify specific MiniApp icons exist", async ({ page }) => {
    // Test specific apps
    const testApps = ["lottery", "coin-flip", "neo-swap", "canvas"];

    for (const app of testApps) {
      const response = await page.request.get(`/miniapps/${app}/static/logo.jpg`);
      expect(response.status()).toBe(200);
      console.log(`✓ ${app} icon: HTTP ${response.status()}`);
    }
  });

  test("should verify specific MiniApp banners exist", async ({ page }) => {
    const testApps = ["lottery", "coin-flip", "neo-swap", "canvas"];

    for (const app of testApps) {
      const response = await page.request.get(`/miniapps/${app}/static/banner.jpg`);
      expect(response.status()).toBe(200);
      console.log(`✓ ${app} banner: HTTP ${response.status()}`);
    }
  });

  test("should render card content correctly", async ({ page }) => {
    // Find first card and check structure
    const firstCard = page.locator('a[href^="/miniapps/miniapp-"]').first();

    if (await firstCard.isVisible()) {
      // Check card has title text
      const cardText = await firstCard.textContent();
      expect(cardText).toBeTruthy();
      console.log(`First card content: ${cardText?.substring(0, 100)}...`);
    }
  });

  test("should take screenshot of MiniApps page", async ({ page }) => {
    await page.screenshot({
      path: "test-results/miniapps-page.png",
      fullPage: false,
    });
    console.log("Screenshot saved to test-results/miniapps-page.png");
  });
});
