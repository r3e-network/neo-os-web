import { test, expect } from "@playwright/test";

test("debug SDK timeout", async ({ page }) => {
  const logs: string[] = [];
  const errors: string[] = [];

  page.on("console", (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  page.on("pageerror", (err) => {
    errors.push(err.message);
    console.error("[PAGE ERROR]", err.message);
  });

  // Navigate
  const response = await page.goto("http://localhost:3004/launch/miniapp-dicegame");
  console.log(`\n=== PAGE STATUS: ${response?.status()} ===`);
  console.log(`=== PAGE URL: ${page.url()} ===`);

  await page.waitForTimeout(2000);

  // Check page content
  const title = await page.title();
  console.log(`=== PAGE TITLE: ${title} ===`);

  // Check iframe
  const iframeCount = await page.locator("iframe").count();
  console.log(`=== IFRAME COUNT: ${iframeCount} ===`);

  if (iframeCount > 0) {
    const iframeSrc = await page.locator("iframe").first().getAttribute("src");
    console.log(`=== IFRAME SRC: ${iframeSrc} ===`);

    // Listen to iframe console
    const frame = page.frames()[1];
    if (frame) {
      console.log(`=== IFRAME URL: ${frame.url()} ===`);
    }
  }

  await page.waitForTimeout(6000);

  console.log("\n=== ERRORS ===");
  errors.forEach((e) => console.log(e));

  const hasTimeout = errors.some((e) => e.includes("timeout"));
  console.log(`\n=== HAS TIMEOUT: ${hasTimeout} ===`);
});
