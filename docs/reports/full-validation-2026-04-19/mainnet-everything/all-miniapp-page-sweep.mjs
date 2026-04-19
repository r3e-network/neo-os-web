#!/usr/bin/env node
/**
 * For every app under apps/<name>/ enumerate its app_id and check:
 *   1. /api/miniapps/catalog?app_id=<id> returns 200
 *   2. The returned contract_hash matches the bundled neo-manifest mainnet
 *      hash (when one is declared)
 *   3. /miniapps/<id> page loads (HTTP 200)
 *
 * Surfaces any miniapp whose page would 404, whose catalog returns a
 * wrong hash, or whose host-app routing is broken.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..", "..");
const APPS_DIR = path.join(ROOT, "apps");
const HOST = process.env.HOST_URL || "http://localhost:3100";

function loadAppIds() {
  const apps = [];
  for (const entry of fs.readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "shared") continue;
    const f = path.join(APPS_DIR, entry.name, "neo-manifest.json");
    if (!fs.existsSync(f)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(f, "utf8"));
      apps.push({
        slug: entry.name,
        app_id: m.id,
        expected_mainnet_hash: m.contracts?.["neo-n3-mainnet"] || null,
      });
    } catch {/* skip */}
  }
  return apps;
}

async function checkOne(app) {
  const result = { ...app, catalog: {}, page: {} };

  // Catalog probe
  try {
    const r = await fetch(`${HOST}/api/miniapps/catalog?app_id=${encodeURIComponent(app.app_id)}`, {
      signal: AbortSignal.timeout(15000),
    });
    result.catalog.status = r.status;
    if (r.ok) {
      const body = await r.json().catch(() => null);
      result.catalog.hash = body?.app?.contract_hash || null;
      result.catalog.name = body?.app?.name || null;
      result.catalog.found = !!body?.app;
    }
  } catch (err) {
    result.catalog.error = String(err?.message || err);
  }

  // Page probe (HEAD is enough for 200/404)
  try {
    const r = await fetch(`${HOST}/miniapps/${encodeURIComponent(app.app_id)}`, {
      method: "GET",
      signal: AbortSignal.timeout(20000),
    });
    result.page.status = r.status;
  } catch (err) {
    result.page.error = String(err?.message || err);
  }

  // Verdicts
  result.catalogOk = result.catalog.status === 200 && result.catalog.found === true;
  result.pageOk = result.page.status === 200;
  if (app.expected_mainnet_hash && result.catalog.hash) {
    result.hashMatches = result.catalog.hash.toLowerCase() === app.expected_mainnet_hash.toLowerCase();
  } else {
    result.hashMatches = null; // n/a
  }
  result.allOk = result.catalogOk && result.pageOk && (result.hashMatches !== false);
  return result;
}

async function main() {
  const apps = loadAppIds();
  process.stderr.write(`sweeping ${apps.length} miniapps via ${HOST}…\n`);
  const results = [];
  // Sequential with a small inter-request delay to stay below the
  // host-app rate limiter (default 60 req/min for the catalog endpoint).
  for (const app of apps) {
    process.stderr.write(`  ${app.slug}…\n`);
    let attempt = 0;
    let last;
    while (attempt < 3) {
      attempt++;
      last = await checkOne(app);
      if (last.catalog.status !== 429) break;
      await new Promise((r) => setTimeout(r, 2000 * attempt)); // back off on 429
    }
    results.push(last);
    await new Promise((r) => setTimeout(r, 1100)); // ~55 req/min, under limit
  }
  const summary = {
    total: results.length,
    allOk: results.filter((r) => r.allOk).length,
    catalogFail: results.filter((r) => !r.catalogOk).length,
    pageFail: results.filter((r) => !r.pageOk).length,
    hashMismatch: results.filter((r) => r.hashMatches === false).length,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.allOk === summary.total ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
