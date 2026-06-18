#!/usr/bin/env node
/**
 * Runtime asset-integrity audit: serves each built miniapp's dist and reports
 * any failed network responses (4xx/5xx), failed requests, broken <img>
 * elements (naturalWidth===0 after load), and console errors. Catches missing
 * logos/banners/icons and other resources that fail to load or display.
 *
 * Usage: node scripts/audit-miniapp-assets.mjs [slug ...]   (default: all built apps)
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const appsRoot = path.join(repoRoot, "apps");

let slugs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (slugs.length === 0) {
  slugs = fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "shared")
    .map((e) => e.name)
    .filter((s) => fs.existsSync(path.join(appsRoot, s, "dist", "index.html")));
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ico": "image/x-icon",
};

function serveDir(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        let filePath = path.join(rootDir, urlPath);
        if (!filePath.startsWith(rootDir)) { res.writeHead(403).end(); return; }
        let stat = await fsp.stat(filePath).catch(() => null);
        if (stat && stat.isDirectory()) { filePath = path.join(filePath, "index.html"); stat = await fsp.stat(filePath).catch(() => null); }
        if (!stat) { filePath = path.join(rootDir, "index.html"); stat = await fsp.stat(filePath).catch(() => null); if (!stat) { res.writeHead(404).end("not found"); return; } }
        res.writeHead(200, { "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) { res.writeHead(500).end(String(err)); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const browser = await chromium.launch();
const report = [];

for (const slug of slugs) {
  const distDir = path.join(appsRoot, slug, "dist");
  if (!fs.existsSync(path.join(distDir, "index.html"))) { report.push({ slug, error: "no dist" }); continue; }
  const server = await serveDir(distDir);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;
  const failedResponses = [], failedRequests = [], consoleErrors = [];
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on("response", (r) => { if (r.status() >= 400) failedResponses.push(`${r.status()} ${r.url().replace(base, "/")}`); });
    page.on("requestfailed", (r) => { const f = r.failure(); failedRequests.push(`${r.url().replace(base, "/")} (${f ? f.errorText : "failed"})`); });
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));

    await page.setViewportSize({ width: 1365, height: 900 });
    await page.goto(base, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
    // scroll to bottom to trigger any lazy/below-the-fold images
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(600);

    // broken <img>: loaded but zero natural size, or never completed
    const brokenImgs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img"))
        .filter((img) => {
          const src = img.currentSrc || img.getAttribute("src") || "";
          if (!src) return false; // no src is a different problem, not a broken load
          return img.complete && img.naturalWidth === 0;
        })
        .map((img) => (img.currentSrc || img.getAttribute("src") || "").slice(0, 160))
    ).catch(() => []);

    // images that failed to decode are also caught by failedResponses; dedupe asset 404s
    const assetFails = failedResponses.filter((r) => /\.(png|jpe?g|svg|webp|avif|gif|ico|woff2?|css|js)\b/i.test(r));
    await ctx.close();
    report.push({ slug, failedResponses, failedRequests, brokenImgs, consoleErrors, assetFails });
    const bad = assetFails.length + failedRequests.length + brokenImgs.length;
    console.log(`${bad ? "⚠️ " : "ok "} ${slug}: ${brokenImgs.length} broken-img, ${assetFails.length} asset-4xx, ${failedRequests.length} req-fail, ${consoleErrors.length} console-err`);
  } catch (err) {
    report.push({ slug, error: String(err).slice(0, 200) });
    console.log(`ERR ${slug}: ${String(err).slice(0, 120)}`);
  } finally { server.close(); }
}

await browser.close();
const outPath = "/tmp/p2-asset-audit.json";
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

const problems = report.filter((r) => r.error || (r.brokenImgs || []).length || (r.assetFails || []).length || (r.failedRequests || []).length);
console.log(`\n=== SUMMARY: ${report.length} apps, ${problems.length} with asset problems ===`);
for (const p of problems) {
  console.log(`\n${p.slug}:`);
  if (p.error) console.log("  ERROR:", p.error);
  (p.brokenImgs || []).forEach((x) => console.log("  broken-img:", x));
  (p.assetFails || []).forEach((x) => console.log("  asset-4xx:", x));
  (p.failedRequests || []).forEach((x) => console.log("  req-fail:", x));
}
console.log(`\nFull report: ${outPath}`);
