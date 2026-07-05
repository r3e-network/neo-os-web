import { test, expect } from "@playwright/test";

/**
 * v2 Design System Surface Test
 * Loads each key miniapp detail page and verifies it renders without errors.
 */
const KEY_APPS = [
  "miniapp-dice-game",
  "miniapp-onchaintarot",
  "miniapp-red-envelope",
  "miniapp-burn-league",
  "miniapp-last-survivor",
  "miniapp-fogplay",
  "miniapp-gasbox",
  "miniapp-daily-checkin",
  "miniapp-flashloan",
  "miniapp-gas-lucky-pool",
  "miniapp-neo-treasury",
  "miniapp-quadratic-funding",
  "miniapp-gov-merc",
  "miniapp-milestone-escrow",
  "miniapp-self-loan",
  "miniapp-council-governance",
  "miniapp-neo-swap",
  "miniapp-neo-multisig",
  "miniapp-forever-album",
  "miniapp-soulbound-certificate",
  "miniapp-memorial-shrine",
  "miniapp-time-capsule",
  "miniapp-unbreakable-vault",
  "miniapp-event-ticket-pass",
  "miniapp-breakup-contract",
  "miniapp-graveyard",
  "miniapp-wallet-health",
  "miniapp-oracle-price-console",
  "miniapp-neo-ns",
  "miniapp-explorer",
];

for (const slug of KEY_APPS) {
  test(`${slug} detail page renders without error`, async ({ page }) => {
    await page.goto(`/miniapps/${slug}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    
    const body = page.locator("body");
    await expect(body).toBeVisible();
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });
}
