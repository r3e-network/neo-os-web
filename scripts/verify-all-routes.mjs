#!/usr/bin/env node
/**
 * Walk every URL the host actually serves.
 *
 * The page count in pages/ is not the surface: three of those routes are
 * dynamic and render a different app each, so the real surface is
 *
 *   static pages + (dynamic routes x published apps)
 *
 * Each dynamic instance is checked to render *that* app rather than a shared
 * shell, so a route that silently falls back to the same content for every id
 * fails instead of passing 78 times.
 *
 *   node scripts/verify-all-routes.mjs [--host http://localhost:3100]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const args = process.argv.slice(2);
const hostFlag = args.indexOf("--host");
const HOST = (hostFlag >= 0 ? args[hostFlag + 1] : process.env.PLATFORM_HOST || "http://localhost:3100").replace(/\/+$/, "");
const CDN = (process.env.MINIAPP_CDN_BASE_URL || "https://meshmini.app").replace(/\/+$/, "");

function listStaticPages() {
  const pagesDir = path.join(repoRoot, "platform/host-app/pages");
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "api") continue;
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      if (/^_(app|document|error)\.tsx$/.test(entry.name)) continue;
      const rel = path.relative(pagesDir, full).replace(/\.tsx$/, "");
      if (rel.includes("[")) continue;
      out.push(`/${rel.replace(/(^|\/)index$/, "")}`.replace(/\/$/, "") || "/");
    }
  };
  walk(pagesDir);
  return [...new Set(out)].sort();
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function check(url, { expectStatus = 200 } = {}) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    const ok = Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus;
    return { url, status: res.status, ok, body: ok ? await res.text() : "" };
  } catch (error) {
    return { url, status: 0, ok: false, body: "", error: error.message };
  }
}

async function main() {
  const catalogues = await Promise.all([
    getJson(`${CDN}/catalog/minigames.json`),
    getJson(`${CDN}/catalog/miniapps.json`),
  ]);
  const apps = catalogues.flatMap((c) => c.apps);
  if (apps.length === 0) throw new Error("catalogues are empty - refusing to report a pass");

  const staticPages = listStaticPages();
  const failures = [];

  console.log(`${staticPages.length} static pages, ${apps.length} apps x 3 dynamic routes\n`);

  for (const page of staticPages) {
    // /404 is reached by rendering, not by requesting it; it answers 404 by design.
    const expect = page === "/404" ? [200, 404] : [200, 302, 307];
    const res = await check(`${HOST}${page}`, { expectStatus: expect });
    if (!res.ok) failures.push(`static ${page} -> HTTP ${res.status}${res.error ? ` (${res.error})` : ""}`);
  }
  console.log(`  static pages: ${staticPages.length - failures.length}/${staticPages.length} ok`);

  // Each dynamic route, for every app, must render that app - not a shell that
  // looks identical whatever id you pass.
  const dynamic = [
    { name: "/miniapps/[id]", url: (a) => `${HOST}/miniapps/${a.app_id}`, identifies: (a, body) => body.includes(a.slug) || body.includes(a.name) },
    { name: "/miniapp-detail/[id]", url: (a) => `${HOST}/miniapp-detail/${a.app_id}`, identifies: (a, body) => body.includes(a.slug) || body.includes(a.name) },
    { name: "/play/[id]", url: (a) => `${HOST}/play/${a.slug}`, identifies: (a, body) => body.includes(`/${a.slug}/${a.version}/`) },
  ];

  for (const route of dynamic) {
    let ok = 0;
    const seen = new Map();
    for (const app of apps) {
      let res = await check(route.url(app));
      // A route may deliberately redirect - the vault's detail page sends
      // OneGate straight to its standalone surface. Follow it and judge where
      // it lands, so an intentional redirect is not reported as a dead route.
      if ([301, 302, 307, 308].includes(res.status)) {
        const location = (await fetch(route.url(app), { redirect: "manual" })).headers.get("location");
        if (location) res = await check(new URL(location, HOST).toString());
      }
      if (!res.ok) {
        failures.push(`${route.name} ${app.slug} -> HTTP ${res.status}${res.error ? ` (${res.error})` : ""}`);
        continue;
      }
      if (!route.identifies(app, res.body) && !res.url.includes(app.slug)) {
        failures.push(`${route.name} ${app.slug} -> 200 but does not render that app`);
        continue;
      }
      // Catch a route that returns the same bytes for every id.
      const fingerprint = res.body.length;
      seen.set(fingerprint, (seen.get(fingerprint) || 0) + 1);
      ok += 1;
    }
    const identical = [...seen.values()].some((count) => count === apps.length);
    if (identical) failures.push(`${route.name} returned byte-identical output for all ${apps.length} apps`);
    console.log(`  ${route.name}: ${ok}/${apps.length} render their own app`);
  }

  const total = staticPages.length + dynamic.length * apps.length;
  console.log(`\n${total - failures.length}/${total} URLs ok`);
  if (failures.length > 0) {
    for (const failure of failures.slice(0, 25)) console.log(`  ✗ ${failure}`);
    if (failures.length > 25) console.log(`  ... and ${failures.length - 25} more`);
    process.exit(1);
  }
  console.log("every route the host serves renders");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
