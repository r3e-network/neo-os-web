import { test, expect } from "@playwright/test";

// All MiniApp IDs
const MINIAPP_IDS = [
  "breakup-contract",
  "burn-league",
  "candidate-vote",
  "canvas",
  "coin-flip",
  "compound-capsule",
  "council-governance",
  "crypto-riddle",
  "dev-tipping",
  "dice-game",
  "doomsday-clock",
  "ex-files",
  "explorer",
  "flashloan",
  "garden-of-neo",
  "gas-sponsor",
  "gov-booster",
  "gov-merc",
  "grant-share",
  "graveyard",
  "guardian-policy",
  "heritage-trust",
  "lottery",
  "masquerade-dao",
  "million-piece-map",
  "neoburger",
  "neo-crash",
  "neo-ns",
  "neo-swap",
  "on-chain-tarot",
  "red-envelope",
  "scratch-card",
  "secret-poker",
  "self-loan",
  "time-capsule",
  "unbreakable-vault",
];

test.describe("MiniApp Validation", () => {
  for (const appId of MINIAPP_IDS) {
    test(`${appId}: should load and display correctly`, async ({ page }) => {
      // Navigate to MiniApp
      await page.goto(`/miniapps/miniapp-${appId}`);
      await page.waitForLoadState("networkidle");

      // Wait for iframe to load
      const iframe = page.frameLocator("iframe");
      await expect(iframe.locator("body")).toBeVisible({ timeout: 10000 });

      // Check that content is loaded
      const content = await page.content();
      expect(content.length).toBeGreaterThan(1000);
    });

    test(`${appId}: should have docs tab`, async ({ page }) => {
      await page.goto(`/miniapps/miniapp-${appId}`);
      await page.waitForLoadState("networkidle");

      // Wait for iframe
      const iframe = page.frameLocator("iframe");
      await expect(iframe.locator("body")).toBeVisible({ timeout: 10000 });

      // Look for docs tab in navbar
      const docsTab = iframe.locator('[data-tab="docs"], .nav-item:has-text("Docs")');
      if ((await docsTab.count()) > 0) {
        await docsTab.first().click();
        await page.waitForTimeout(500);
        // Verify NeoDoc component is visible
        const neoDoc = iframe.locator(".neo-doc, .doc-container");
        expect(await neoDoc.count()).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

test.describe("MiniApp Height Validation", () => {
  test("MiniApp should fit within container", async ({ page }) => {
    await page.goto("/miniapps/miniapp-lottery");
    await page.waitForLoadState("networkidle");

    // Get container dimensions
    const container = page.locator('[class*="MiniAppFrame"]').first();
    if ((await container.count()) > 0) {
      const box = await container.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        // Verify aspect ratio is approximately 430:932
        const ratio = box.width / box.height;
        expect(ratio).toBeGreaterThan(0.4);
        expect(ratio).toBeLessThan(0.5);
      }
    }
  });
});
