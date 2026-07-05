#!/usr/bin/env node
/**
 * Capture runtime screenshots of one or more built miniapps for visual
 * regression review. Each app is served from its own `dist/` over an ephemeral
 * static server (SPA fallback to index.html), then captured at desktop and
 * mobile viewports.
 *
 * Usage:
 *   node scripts/capture-miniapp-runtime.mjs <slug> [<slug> ...] [--out <dir>] [--tag <label>]
 *
 * The app must already be built (`npm --prefix apps/<slug> run build`).
 * Output: <out>/<slug>__<tag>__desktop.png, __mobile.png, plus index.json.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const rawArgs = process.argv.slice(2);
const slugs = [];
let outDir = path.resolve(repoRoot, "docs/reports/miniapp-runtime");
let tag = "current";
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === "--out") { outDir = path.resolve(rawArgs[++i]); }
  else if (a === "--tag") { tag = rawArgs[++i]; }
  else if (!a.startsWith("-")) { slugs.push(a); }
}
if (slugs.length === 0) {
  console.error("usage: capture-miniapp-runtime.mjs <slug> [<slug> ...] [--out dir] [--tag label]");
  process.exit(2);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
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
        if (!stat) {
          // SPA fallback
          filePath = path.join(rootDir, "index.html");
          stat = await fsp.stat(filePath).catch(() => null);
          if (!stat) { res.writeHead(404).end("not found"); return; }
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500).end(String(err));
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const index = [];
let failures = 0;

for (const slug of slugs) {
  const distDir = path.join(repoRoot, "apps", slug, "dist");
  if (!fs.existsSync(path.join(distDir, "index.html"))) {
    console.error(`[${slug}] no dist/index.html — build it first`);
    failures++;
    continue;
  }
  const server = await serveDir(distDir);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/`;
  const consoleErrors = [];
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));

    const safe = slug.replace(/[^a-z0-9_-]+/gi, "_");
    const shots = {};
    for (const [vp, size] of [["desktop", { width: 1365, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
      await page.setViewportSize(size);
      await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
      await page.waitForTimeout(600);
      const file = path.join(outDir, `${safe}__${tag}__${vp}.webp`);
      // animations:"disabled" freezes CSS/Web animations so fullPage capture of
      // pages with perpetual motion (shimmer, marquees) can stabilize.
      await page.screenshot({ path: file, fullPage: true, animations: "disabled", timeout: 20_000 })
        .catch(async () => {
          // Fallback: viewport-only capture if a fullPage stitch still stalls.
          await page.screenshot({ path: file, animations: "disabled", timeout: 15_000 });
        });
      shots[vp] = path.relative(outDir, file);
    }
    await ctx.close();
    index.push({ slug, tag, ...shots, consoleErrors });
    console.log(`[${slug}] captured (${consoleErrors.length} console errors)`);
  } catch (err) {
    console.error(`[${slug}] FAILED: ${String(err).slice(0, 200)}`);
    failures++;
  } finally {
    server.close();
  }
}

await browser.close();
const indexPath = path.join(outDir, `index__${tag}.json`);
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
console.log(`\nWrote ${index.length} app captures to ${outDir} (index: ${path.basename(indexPath)})`);
if (failures > 0) { console.error(`${failures} app(s) failed to capture`); process.exit(1); }
