#!/usr/bin/env node
/**
 * Full verification of a published CDN release.
 *
 * Checks every app in both catalogues, not a sample: the catalogue entry, the
 * release pointer, the bundle entry document, its manifest, its artwork, and
 * every asset the entry document references. Also asserts the cache policy the
 * layout depends on - immutable objects must be frozen for a year and the
 * mutable pointer must not be - because a wrong Cache-Control here is invisible
 * until a release fails to take effect.
 *
 * Usage:
 *   node scripts/verify-cdn-release.mjs
 *   node scripts/verify-cdn-release.mjs --base https://meshmini.app --concurrency 12
 */
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && index < args.length - 1 ? args[index + 1] : fallback;
}

const CDN = String(arg("base", process.env.MINIAPP_CDN_BASE_URL || "https://meshmini.app")).replace(/\/+$/, "");
const PLATFORM = String(arg("platform", process.env.MINIAPP_PLATFORM_BASE_URL || "https://neomini.app")).replace(/\/+$/, "");
const CONCURRENCY = Number(arg("concurrency", "12"));
const KINDS = ["minigames", "miniapps"];

const IMMUTABLE = "public, max-age=31536000, immutable";
const POINTER = "public, max-age=60, stale-while-revalidate=300";

const failures = [];
let checks = 0;

function fail(scope, detail) {
  failures.push({ scope, detail });
}

/**
 * Cloudflare rejects some default agents, and a HEAD is not always served the
 * same way as the GET a browser makes, so every probe is a GET with a browser
 * user agent.
 */
async function probe(url) {
  checks += 1;
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        origin: "null",
      },
    });
    return {
      ok: response.ok,
      status: response.status,
      cacheControl: response.headers.get("cache-control") || "",
      cors: response.headers.get("access-control-allow-origin") || "",
      contentType: response.headers.get("content-type") || "",
      body: response,
    };
  } catch (error) {
    return { ok: false, status: 0, cacheControl: "", cors: "", contentType: "", error: String(error) };
  }
}

async function mapLimit(items, limit, worker) {
  const out = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) return;
        out[index] = await worker(items[index], index);
      }
    }),
  );
  return out;
}

/** Assets an entry document pulls in - what a browser would actually request. */
function referencedAssets(html, baseUrl) {
  const refs = new Set();
  for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith("data:") || raw.startsWith("#") || raw.startsWith("mailto:")) continue;
    if (/^https?:\/\//i.test(raw)) {
      if (raw.startsWith(CDN)) refs.add(raw);
      continue;
    }
    refs.add(new URL(raw, `${baseUrl}/`).toString());
  }
  return [...refs];
}

async function verifyApp(app, kind) {
  const scope = `${kind}/${app.slug}`;

  // 1. Release pointer, and its agreement with the catalogue.
  const pointerUrl = `${CDN}/meta/${kind}/${app.slug}/latest.json`;
  const pointerRes = await probe(pointerUrl);
  if (!pointerRes.ok) {
    fail(scope, `pointer HTTP ${pointerRes.status} ${pointerUrl}`);
    return;
  }
  if (!pointerRes.cacheControl.includes("max-age=60")) {
    fail(scope, `pointer must stay short-lived, got "${pointerRes.cacheControl}"`);
  }
  const pointer = await pointerRes.body.json();
  if (pointer.version !== app.version) {
    fail(scope, `pointer version ${pointer.version} != catalogue ${app.version}`);
  }
  if (pointer.entry_url !== app.entry_url) {
    fail(scope, `pointer entry_url ${pointer.entry_url} != catalogue ${app.entry_url}`);
  }
  if (pointer.kind !== kind) fail(scope, `pointer kind ${pointer.kind} != ${kind}`);

  // 2. The version must be in the path, which is what makes the object immutable.
  const expectedPrefix = `${CDN}/${kind}/${app.slug}/${app.version}/`;
  if (!app.entry_url.startsWith(expectedPrefix)) {
    fail(scope, `entry_url is not under the versioned prefix: ${app.entry_url}`);
  }

  // 3. Entry document.
  const entryRes = await probe(app.entry_url);
  if (!entryRes.ok) {
    fail(scope, `entry HTTP ${entryRes.status} ${app.entry_url}`);
    return;
  }
  if (entryRes.cacheControl !== IMMUTABLE) {
    fail(scope, `entry Cache-Control "${entryRes.cacheControl}" != "${IMMUTABLE}"`);
  }
  if (entryRes.cors !== "*") {
    fail(scope, `entry missing wildcard CORS (sandboxed iframes are origin "null"), got "${entryRes.cors}"`);
  }
  if (!entryRes.contentType.includes("text/html")) {
    fail(scope, `entry Content-Type "${entryRes.contentType}" is not html`);
  }
  const html = await entryRes.body.text();

  // 4. Manifest travelling with the bundle.
  const manifestRes = await probe(app.manifest_url);
  if (!manifestRes.ok) {
    fail(scope, `manifest HTTP ${manifestRes.status} ${app.manifest_url}`);
  } else {
    const manifest = await manifestRes.body.json();
    if (String(manifest.version) !== app.version) {
      fail(scope, `bundled manifest version ${manifest.version} != ${app.version}`);
    }
  }

  // 5. Artwork the launcher renders before anything is loaded.
  for (const [field, url] of [["icon_url", app.icon_url], ["banner_url", app.banner_url]]) {
    if (!url) {
      fail(scope, `${field} is empty`);
      continue;
    }
    const res = await probe(url);
    if (!res.ok) fail(scope, `${field} HTTP ${res.status} ${url}`);
    else if (!res.contentType.startsWith("image/")) {
      fail(scope, `${field} Content-Type "${res.contentType}" is not an image`);
    }
  }

  // 6. Everything the entry document actually pulls in.
  const assets = referencedAssets(html, `${CDN}/${kind}/${app.slug}/${app.version}`);
  const assetResults = await mapLimit(assets, 6, async (url) => ({ url, res: await probe(url) }));
  for (const { url, res } of assetResults) {
    if (!res.ok) fail(scope, `asset HTTP ${res.status} ${url}`);
    else if (url.includes("/assets/") && res.cacheControl !== IMMUTABLE) {
      fail(scope, `asset Cache-Control "${res.cacheControl}" != "${IMMUTABLE}" ${url}`);
    }
  }

  // 7. OneGate opens the platform's chrome-free route, never a raw bundle URL.
  const oneGateUrl = app.onegate?.url || "";
  if (!oneGateUrl.startsWith(`${PLATFORM}/play/`)) {
    fail(scope, `onegate.url should be ${PLATFORM}/play/<slug>, got "${oneGateUrl}"`);
  } else if (!oneGateUrl.endsWith(`/play/${app.slug}`)) {
    fail(scope, `onegate.url slug mismatch: ${oneGateUrl}`);
  }

  return { slug: app.slug, assets: assets.length };
}

async function main() {
  const summary = {};
  for (const kind of KINDS) {
    const catalogUrl = `${CDN}/catalog/${kind}.json`;
    const res = await probe(catalogUrl);
    if (!res.ok) {
      fail(`catalog/${kind}`, `HTTP ${res.status} ${catalogUrl}`);
      continue;
    }
    if (!res.cacheControl.includes("max-age=60")) {
      fail(`catalog/${kind}`, `catalog must stay short-lived, got "${res.cacheControl}"`);
    }
    const catalog = await res.body.json();
    if (catalog.count !== catalog.apps.length) {
      fail(`catalog/${kind}`, `count ${catalog.count} != apps ${catalog.apps.length}`);
    }

    // The catalogue is what the launcher renders for ~80 apps at once; if a
    // bundle payload leaked into it that promise is broken.
    const raw = JSON.stringify(catalog);
    if (raw.includes("<!DOCTYPE") || raw.includes("<script")) {
      fail(`catalog/${kind}`, "catalogue carries bundle markup; it must be metadata only");
    }

    const results = await mapLimit(catalog.apps, CONCURRENCY, (app) => verifyApp(app, kind));
    summary[kind] = {
      apps: catalog.apps.length,
      assets_checked: results.reduce((sum, r) => sum + (r?.assets || 0), 0),
    };
    process.stdout.write(`[verify] ${kind}: ${catalog.apps.length} apps\n`);
  }

  console.log(
    JSON.stringify(
      { cdn: CDN, platform: PLATFORM, summary, http_checks: checks, failures: failures.length },
      null,
      2,
    ),
  );
  for (const failure of failures.slice(0, 40)) {
    console.log(`  FAIL ${failure.scope}: ${failure.detail}`);
  }
  if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more`);
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
