#!/usr/bin/env node
/**
 * Accessibility audit: serves each built miniapp's dist and runs axe-core
 * (WCAG 2.0/2.1 A + AA) against it, reporting violations by impact + rule.
 * Catches missing names/labels, color-contrast, roles, alt text, etc.
 *
 * Requires axe.min.js at $AXE_PATH (default /tmp/axe.min.js). Apps must be
 * built (npm --prefix apps/<slug> run build).
 *
 * Usage: node scripts/audit-miniapp-a11y.mjs [slug ...]   (default: all built apps)
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
const AXE = process.env.AXE_PATH || "/tmp/axe.min.js";
const axeSrc = fs.readFileSync(AXE, "utf8");

let slugs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (slugs.length === 0) {
  slugs = fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "shared")
    .map((e) => e.name)
    .filter((s) => fs.existsSync(path.join(appsRoot, s, "dist", "index.html")));
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon" };
function serveDir(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        let filePath = path.join(rootDir, urlPath);
        if (!filePath.startsWith(rootDir)) { res.writeHead(403).end(); return; }
        let stat = await fsp.stat(filePath).catch(() => null);
        if (stat && stat.isDirectory()) { filePath = path.join(filePath, "index.html"); stat = await fsp.stat(filePath).catch(() => null); }
        if (!stat) { filePath = path.join(rootDir, "index.html"); stat = await fsp.stat(filePath).catch(() => null); if (!stat) { res.writeHead(404).end(); return; } }
        res.writeHead(200, { "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) { res.writeHead(500).end(String(err)); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const browser = await chromium.launch();
const report = [];
const ruleTotals = {};
for (const slug of slugs) {
  const distDir = path.join(appsRoot, slug, "dist");
  if (!fs.existsSync(path.join(distDir, "index.html"))) { report.push({ slug, error: "no dist" }); continue; }
  const server = await serveDir(distDir);
  const { port } = server.address();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(axeSrc);
    const results = await page.evaluate(async () => {
      // WCAG 2.0/2.1 level A + AA
      return await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    });
    const v = (results.violations || []).map((vi) => ({ id: vi.id, impact: vi.impact, nodes: vi.nodes.length, help: vi.help, sample: (vi.nodes[0]?.target || []).join(" ") }));
    for (const vi of v) ruleTotals[vi.id] = (ruleTotals[vi.id] || 0) + vi.nodes;
    const crit = v.filter((x) => x.impact === "critical" || x.impact === "serious");
    report.push({ slug, violations: v, critSerious: crit.length });
    await ctx.close();
    console.log(`${crit.length ? "⚠️ " : "ok "} ${slug}: ${v.length} rules (${crit.length} critical/serious)`);
  } catch (err) {
    report.push({ slug, error: String(err).slice(0, 160) });
    console.log(`ERR ${slug}: ${String(err).slice(0, 120)}`);
  } finally { server.close(); }
}
await browser.close();
fs.writeFileSync(process.env.AXE_OUT || "/tmp/a11y-report.json", JSON.stringify(report, null, 2));
console.log(`\n=== ${report.length} apps; violation rules across fleet (by total nodes) ===`);
for (const [rule, n] of Object.entries(ruleTotals).sort((a, b) => b[1] - a[1])) console.log(`  ${n}  ${rule}`);
const withCrit = report.filter((r) => r.critSerious > 0);
console.log(`\napps with critical/serious violations: ${withCrit.length}/${report.length}`);
