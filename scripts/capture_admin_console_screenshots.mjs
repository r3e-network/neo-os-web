import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.ADMIN_BASE_URL || "http://127.0.0.1:3002";
const outputDir = process.env.ADMIN_SCREENSHOT_DIR || path.resolve("docs/reports/admin-console-screenshots");

const routes = [
  "/",
  "/miniapps",
  "/contracts",
  "/services",
  "/templates",
  "/users",
  "/analytics",
  "/pricefeeds",
  "/oracle-secrets",
  "/simulations",
  "/settings",
];

function safeFileName(input) {
  return String(input).replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
}

async function capturePage(page, { route, viewport, suffix }) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(250);
  const fileName = `admin__${safeFileName(route === "/" ? "root" : route.slice(1))}__${suffix}.webp`;
  const outPath = path.join(outputDir, fileName);
  await page.screenshot({ path: outPath, fullPage: true });
  return { route, outPath };
}

fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

const index = [];
for (const route of routes) {
  const desktop = await capturePage(page, { route, viewport: { width: 1365, height: 768 }, suffix: "desktop" });
  const mobile = await capturePage(page, { route, viewport: { width: 390, height: 844 }, suffix: "mobile" });
  index.push({
    route,
    desktop: path.relative(outputDir, desktop.outPath),
    mobile: path.relative(outputDir, mobile.outPath),
    ts: new Date().toISOString(),
  });
}

fs.writeFileSync(path.join(outputDir, "index.json"), JSON.stringify(index, null, 2));
await browser.close();
