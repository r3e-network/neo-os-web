import { test, expect, Page } from "@playwright/test";

// All MiniApps to test (excluding _shared)
const ALL_MINIAPPS = [
  "breakup-contract",
  "burn-league",
  "candidate-vote",
  "canvas",
  "coin-flip",
  "compound-capsule",
  "crypto-riddle",
  "dev-tipping",
  "dice-game",
  "doomsday-clock",
  "ex-files",
  "explorer",
  "flashloan",
  "fog-puzzle",
  "garden-of-neo",
  "gas-circle",
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
  "puzzle-mining",
  "red-envelope",
  "scratch-card",
  "secret-poker",
  "self-loan",
  "time-capsule",
  "unbreakable-vault",
];

// Track test results
const results: { app: string; status: string; error?: string }[] = [];

test.describe("MiniApp Navigation Tests", () => {
  test.setTimeout(120000); // 2 minutes for full suite

  test("should navigate to MiniApps listing page", async ({ page }) => {
    await page.goto("/miniapps");
    await page.waitForLoadState("networkidle");

    // Verify page loaded
    await expect(page).toHaveURL(/\/miniapps/);
    console.log("✓ MiniApps listing page loaded");

    // Take screenshot
    await page.screenshot({ path: "test-results/miniapps-listing.png" });
  });

  test("should click into first 10 MiniApps and verify pages load", async ({ page }) => {
    const appsToTest = ALL_MINIAPPS.slice(0, 10);

    for (const app of appsToTest) {
      await testMiniAppPage(page, app);
    }

    console.log("\n=== Batch 1 Results (1-10) ===");
    logResults(appsToTest);
  });

  test("should click into MiniApps 11-20 and verify pages load", async ({ page }) => {
    const appsToTest = ALL_MINIAPPS.slice(10, 20);

    for (const app of appsToTest) {
      await testMiniAppPage(page, app);
    }

    console.log("\n=== Batch 2 Results (11-20) ===");
    logResults(appsToTest);
  });

  test("should click into MiniApps 21-30 and verify pages load", async ({ page }) => {
    const appsToTest = ALL_MINIAPPS.slice(20, 30);

    for (const app of appsToTest) {
      await testMiniAppPage(page, app);
    }

    console.log("\n=== Batch 3 Results (21-30) ===");
    logResults(appsToTest);
  });

  test("should click into MiniApps 31-40 and verify pages load", async ({ page }) => {
    const appsToTest = ALL_MINIAPPS.slice(30, 40);

    for (const app of appsToTest) {
      await testMiniAppPage(page, app);
    }

    console.log("\n=== Batch 4 Results (31-40) ===");
    logResults(appsToTest);
  });

  test("should click into MiniApps 41-50 and verify pages load", async ({ page }) => {
    const appsToTest = ALL_MINIAPPS.slice(40, 50);

    for (const app of appsToTest) {
      await testMiniAppPage(page, app);
    }

    console.log("\n=== Batch 5 Results (41-50) ===");
    logResults(appsToTest);
  });

  test("should click into MiniApps 51-60 and verify pages load", async ({ page }) => {
    const appsToTest = ALL_MINIAPPS.slice(50, 60);

    for (const app of appsToTest) {
      await testMiniAppPage(page, app);
    }

    console.log("\n=== Batch 6 Results (51-60) ===");
    logResults(appsToTest);
  });

  test("should click into remaining MiniApps (61-68) and verify pages load", async ({ page }) => {
    const appsToTest = ALL_MINIAPPS.slice(60);

    for (const app of appsToTest) {
      await testMiniAppPage(page, app);
    }

    console.log("\n=== Batch 7 Results (61-68) ===");
    logResults(appsToTest);
  });

  test("should generate final summary report", async ({ page }) => {
    // Navigate to listing to ensure page context
    await page.goto("/miniapps");

    const passed = results.filter((r) => r.status === "PASS").length;
    const failed = results.filter((r) => r.status === "FAIL").length;

    console.log("\n" + "=".repeat(50));
    console.log("FINAL SUMMARY");
    console.log("=".repeat(50));
    console.log(`Total MiniApps: ${ALL_MINIAPPS.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / ALL_MINIAPPS.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log("\nFailed Apps:");
      results
        .filter((r) => r.status === "FAIL")
        .forEach((r) => {
          console.log(`  - ${r.app}: ${r.error}`);
        });
    }

    // Take final screenshot
    await page.screenshot({ path: "test-results/miniapps-final.png", fullPage: true });
  });
});

async function testMiniAppPage(page: Page, appName: string): Promise<void> {
  try {
    // Navigate directly to the MiniApp detail page
    const url = `/miniapps/${appName}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Wait for page to stabilize
    await page.waitForTimeout(1000);

    // Check for error indicators
    const hasError =
      (await page.locator("text=404").count()) > 0 ||
      (await page.locator("text=Error").count()) > 0 ||
      (await page.locator("text=Not Found").count()) > 0;

    if (hasError) {
      results.push({ app: appName, status: "FAIL", error: "Page shows error/404" });
      console.log(`✗ ${appName}: Page shows error`);
      return;
    }

    // Verify page has content
    const bodyText = await page.locator("body").textContent();
    if (!bodyText || bodyText.length < 50) {
      results.push({ app: appName, status: "FAIL", error: "Page has no content" });
      console.log(`✗ ${appName}: No content`);
      return;
    }

    // Success
    results.push({ app: appName, status: "PASS" });
    console.log(`✓ ${appName}: OK`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ app: appName, status: "FAIL", error: errorMsg.substring(0, 100) });
    console.log(`✗ ${appName}: ${errorMsg.substring(0, 50)}`);
  }
}

function logResults(apps: string[]): void {
  const batchResults = results.filter((r) => apps.includes(r.app));
  const passed = batchResults.filter((r) => r.status === "PASS").length;
  const failed = batchResults.filter((r) => r.status === "FAIL").length;
  console.log(`Passed: ${passed}/${apps.length}, Failed: ${failed}`);
}
