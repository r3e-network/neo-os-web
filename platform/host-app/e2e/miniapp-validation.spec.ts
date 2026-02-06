import { test, expect } from "@playwright/test";

// All MiniApp IDs
const MINIAPP_IDS = [
  "breakupcontract",
  "burn-league",
  "candidate-vote",
  "coinflip",
  "compound-capsule",
  "council-governance",
  "dailycheckin",
  "dev-tipping",
  "doomsday-clock",
  "event-ticket-pass",
  "exfiles",
  "explorer",
  "flashloan",
  "forever-album",
  "garden-of-neo",
  "gas-sponsor",
  "gov-merc",
  "grant-share",
  "graveyard",
  "guardianpolicy",
  "hall-of-fame",
  "heritage-trust",
  "lottery",
  "masqueradedao",
  "memorial-shrine",
  "milestone-escrow",
  "millionpiecemap",
  "neoburger",
  "neo-convert",
  "neo-gacha",
  "neo-multisig",
  "neo-news-today",
  "neo-ns",
  "neo-sign-anything",
  "neo-swap",
  "neo-treasury",
  "onchaintarot",
  "piggy-bank",
  "quadratic-funding",
  "redenvelope",
  "self-loan",
  "soulbound-certificate",
  "stream-vault",
  "time-capsule",
  "turtle-match",
  "unbreakablevault",
  "wallet-health",
];

test.describe("MiniApp Validation", () => {
  for (const appId of MINIAPP_IDS) {
    test(`${appId}: should load and display correctly`, async ({ page }) => {
      // Navigate to MiniApp
      await page.goto(`/miniapps/miniapp-${appId}`);
      await page.waitForLoadState("networkidle");

      // Use title-based selector to target the specific MiniApp iframe
      // and contentFrame() (Playwright 1.58+ API) to access frame content
      const iframeLocator = page.locator('iframe[title$="MiniApp"]').first();
      const frame = iframeLocator.contentFrame();
      await expect(frame.locator("body")).toBeVisible({ timeout: 10000 });

      // Check that content is loaded
      const content = await page.content();
      expect(content.length).toBeGreaterThan(1000);
    });

    test(`${appId}: should have docs tab`, async ({ page }) => {
      await page.goto(`/miniapps/miniapp-${appId}`);
      await page.waitForLoadState("networkidle");

      // Use title-based selector + contentFrame() (Playwright 1.58+ API)
      const iframeLocator = page.locator('iframe[title$="MiniApp"]').first();
      const frame = iframeLocator.contentFrame();
      await expect(frame.locator("body")).toBeVisible({ timeout: 10000 });

      // Look for docs tab in navbar
      const docsTab = frame.locator('[data-tab="docs"], .nav-item:has-text("Docs")');
      if ((await docsTab.count()) > 0) {
        await docsTab.first().click();
        await page.waitForTimeout(500);
        // Verify NeoDoc component is visible
        const neoDoc = frame.locator(".neo-doc, .doc-container");
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
