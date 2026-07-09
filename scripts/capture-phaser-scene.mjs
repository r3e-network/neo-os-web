#!/usr/bin/env node
/**
 * Capture the LIVE Phaser canvas of one or more built miniapp games.
 *
 * The standard capture-miniapp-runtime.mjs only reaches the launcher hero; the
 * playable Phaser scene sits behind the launcher's primary CTA. This harness
 * serves a game's dist, clicks the launcher CTA (`.n3h-button--primary`) to
 * mount the PhaserGameComponent, waits for the canvas to report ready, and
 * screenshots (a) the canvas region on its own and (b) the full page, at both
 * desktop and mobile viewports.
 *
 * Usage:
 *   node scripts/capture-phaser-scene.mjs <slug> [<slug> ...] [--out <dir>] [--tag <label>]
 *
 * Each app must already be built (`npm --prefix apps/<slug> run build`).
 * Output per slug: <out>/<slug>__<tag>__{desktop,mobile}.png       (canvas crop)
 *                  <out>/<slug>__<tag>__{desktop,mobile}-full.png   (full page)
 *                  <out>/index__<tag>.json                          (results)
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
let outDir = path.resolve(repoRoot, "docs/reports/phaser-scene");
let tag = "current";
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === "--out") outDir = path.resolve(rawArgs[++i]);
  else if (a === "--tag") tag = rawArgs[++i];
  else if (!a.startsWith("-")) slugs.push(a);
}
if (slugs.length === 0) {
  console.error("usage: capture-phaser-scene.mjs <slug> [<slug> ...] [--out dir] [--tag label]");
  process.exit(2);
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ico": "image/x-icon",
};

function serve(distDir) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    let f = path.join(distDir, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(distDir, "index.html");
    res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, port: server.address().port })));
}

/** Reach the live canvas: click the launcher primary CTA, then wait for ready. */
async function enterGame(page) {
  // The launcher primary CTA mounts the PlayArea (and thus the Phaser canvas).
  const primary = page.locator(".n3h-button--primary").first();
  if (await primary.count().catch(() => 0)) {
    await primary.click({ timeout: 8000 }).catch(() => {});
  } else {
    // Fallbacks for any launcher variant.
    for (const rx of [/play/i, /enter/i, /start/i, /practice/i]) {
      const el = page.getByRole("button", { name: rx }).first();
      if (await el.count().catch(() => 0)) { await el.click().catch(() => {}); break; }
    }
  }
  // Wait for the Phaser host to report ready and a sized canvas to exist.
  await page
    .waitForFunction(() => {
      const host = document.querySelector(".phaser-game-host");
      const canvas = document.querySelector(".phaser-game-host canvas") || document.querySelector("canvas");
      return host?.getAttribute("data-ready") === "true" && canvas && canvas.width > 0;
    }, { timeout: 20000 })
    .catch(() => {});
}

async function shootViewport(page, { width, height }, canvasFile, fullFile) {
  await page.setViewportSize({ width, height });
  await enterGame(page);
  // Let boot tweens settle to a stable idle frame.
  await page.waitForTimeout(1400);
  await page.screenshot({ path: fullFile, animations: "disabled", timeout: 20000 }).catch(() => {});
  const box = await page
    .locator(".phaser-game-host canvas, .phaser-game-host")
    .first()
    .boundingBox()
    .catch(() => null);
  if (box && box.width > 4 && box.height > 4) {
    await page
      .screenshot({ path: canvasFile, animations: "disabled", clip: box, timeout: 20000 })
      .catch(() => {});
    return true;
  }
  return false;
}

await fsp.mkdir(outDir, { recursive: true });
const results = [];
const browser = await chromium.launch();

for (const slug of slugs) {
  const distDir = path.join(repoRoot, "apps", slug, "dist");
  if (!fs.existsSync(path.join(distDir, "index.html"))) {
    console.error(`[${slug}] no dist/index.html — build first (npm --prefix apps/${slug} run build)`);
    results.push({ slug, ok: false, reason: "no-dist" });
    continue;
  }
  const { server, port } = await serve(distDir);
  const errors = [];
  try {
    for (const [label, size] of [["desktop", { width: 1365, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
      const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(600);
      const canvasFile = path.join(outDir, `${slug}__${tag}__${label}.png`);
      const fullFile = path.join(outDir, `${slug}__${tag}__${label}-full.png`);
      const ok = await shootViewport(page, size, canvasFile, fullFile);
      results.push({ slug, viewport: label, canvasCaptured: ok, canvasFile, fullFile });
      await page.close();
    }
    console.log(`[${slug}] captured (${errors.length} console errors)${errors.length ? " :: " + errors.slice(0, 2).join(" | ") : ""}`);
  } finally {
    server.close();
  }
}

await browser.close();
await fsp.writeFile(path.join(outDir, `index__${tag}.json`), JSON.stringify(results, null, 2));
console.log(`\nWrote scene captures for ${slugs.length} app(s) to ${outDir}`);
