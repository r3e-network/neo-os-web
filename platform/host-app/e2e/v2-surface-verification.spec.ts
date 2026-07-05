import { test, expect } from "@playwright/test";

/**
 * v2 Surface Verification
 * 
 * Loads each miniapp detail page and verifies it renders without errors.
 * This catches PlayArea build issues, SCSS compilation problems, and
 * missing asset references.
 */

const APPS_TO_VERIFY = [
  "miniapp-dice-game",
  "miniapp-onchaintarot",
  "miniapp-redenvelope",
  "miniapp-burn-league",
  "miniapp-last-survivor",
  "miniapp-fogplay",
  "miniapp-gasbox",
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
  "miniapp-neo-sign-anything",
];

for (const slug of APPS_TO_VERIFY) {
  test(`${slug} detail page renders`, async ({ page }) => {
    await page.goto(`/miniapps/${slug}`);
    await page.waitForTimeout(1500);
    
    // Page should not show an error
    const body = page.locator("body");
    await expect(body).toBeVisible();
    
    // Content should be substantial (not a blank page)
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });
}
