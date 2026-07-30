#!/usr/bin/env node
/**
 * One-time CDN seeding for the repo split.
 *
 * The app repos own the ongoing publish pipeline, but their CI cannot run until
 * the SDK packages are published, and the platform should not be left serving
 * bundles from its own `public/miniapps` in the meantime. This seeds R2 from the
 * bundles already built in this repo, using exactly the layout the app repos'
 * publisher writes, so the platform can be switched over to the CDN immediately
 * and later releases simply overwrite these keys.
 *
 * Layout (see docs/ARCHITECTURE.md for the repo split; the CDN paths are below):
 *   <kind>/<slug>/<version>/**           immutable, 1y
 *   meta/<kind>/<slug>/latest.json       60s pointer
 *   catalog/<kind>.json                  60s launcher catalogue
 *
 * Usage:
 *   node scripts/seed-cdn-bundles.mjs --dry-run
 *   node scripts/seed-cdn-bundles.mjs [slug ...]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createR2Client, IMMUTABLE_CACHE, POINTER_CACHE, contentTypeFor } from "./lib/r2-client.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appsRoot = path.join(repoRoot, "apps");

const dryRun = process.argv.includes("--dry-run");
// Rewrites only the pointers and catalogues, leaving the immutable bundle
// objects alone. Useful when catalogue metadata changes but no app was rebuilt -
// re-uploading 130MB of unchanged, content-addressed assets would be pure waste.
const catalogOnly = process.argv.includes("--catalog-only");
const selected = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith("-")));

const cdnBase = String(process.env.MINIAPP_CDN_BASE_URL || "https://meshmini.app").trim().replace(/\/+$/, "");
const bucket = String(process.env.MINIAPP_R2_BUCKET || "miniapps").trim();
// OneGate launches through the platform's chrome-free /play route rather than a
// raw CDN URL, so the platform keeps ownership of the wallet bridge, the sandbox
// policy, and the loading state.
const platformBase = String(process.env.MINIAPP_PLATFORM_BASE_URL || "https://neomini.app")
  .trim()
  .replace(/\/+$/, "");

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    console.error(`seed-cdn-bundles: ${name} is required (or pass --dry-run)`);
    process.exit(2);
  }
  return value;
}

const client = dryRun
  ? { put: async (key, body, cacheControl) => ({ key, bytes: body.length, contentType: contentTypeFor(key), cacheControl }) }
  : createR2Client({
      accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
      apiToken: requireEnv("CLOUDFLARE_API_TOKEN"),
      apiTokenId: requireEnv("CF_API_TOKEN_ID"),
      bucket,
    });

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, base)));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out.sort();
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function asString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim() || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * Manifests declare artwork as a platform-absolute path
 * (`/miniapps/<slug>/logo.webp`), but in a bundle the file sits at the root, so
 * only its final segment is meaningful here. An absolute http(s) value is left
 * alone: an app is free to point at artwork it hosts elsewhere.
 */
function bundleAssetUrl(baseUrl, value, fallback) {
  const raw = asString(value, fallback);
  if (/^https?:\/\//i.test(raw)) return raw;
  const fileName = raw.split(/[?#]/)[0].split("/").filter(Boolean).pop() || fallback;
  return `${baseUrl}/${fileName}`;
}

/** FNV-1a, so an app without a pinned OneGate id keeps a stable derived one. */
function stableOneGateId(appId) {
  let hash = 2166136261;
  for (let index = 0; index < appId.length; index += 1) {
    hash ^= appId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 1) || 1;
}

function resolveOneGateId(manifest, appId) {
  const onegate = asObject(manifest.onegate);
  const raw = asString(onegate.id || onegate.app_id || onegate.dapp_id);
  if (/^[1-9][0-9]{0,9}$/.test(raw)) return Number(raw);
  return stableOneGateId(appId);
}

function localizedJson(en, zh, ja) {
  const name = asString(en);
  const localized = { en: name };
  if (asString(zh) && asString(zh) !== name) localized.zh = asString(zh);
  if (asString(ja)) localized.ja = asString(ja);
  return JSON.stringify(localized);
}

async function main() {
  const plan = JSON.parse(await fs.readFile(path.join(repoRoot, "docs", "split", "plan.json"), "utf8"));
  const kindBySlug = new Map();
  for (const repo of ["neo-minigames", "neo-miniapps"]) {
    for (const app of plan.repos[repo].apps) kindBySlug.set(app.slug, app.kind);
  }

  const byKind = new Map([
    ["minigames", []],
    ["miniapps", []],
  ]);
  const skipped = [];
  const unpublished = [];
  let objects = 0;
  let bytesTotal = 0;

  for (const slug of [...kindBySlug.keys()].sort()) {
    if (selected.size > 0 && !selected.has(slug)) continue;
    const kind = kindBySlug.get(slug);
    const appDir = path.join(appsRoot, slug);
    const distDir = path.join(appDir, "dist");
    const manifestPath = path.join(appDir, "neo-manifest.json");

    if (!(await exists(path.join(distDir, "index.html")))) {
      skipped.push({ slug, reason: "missing dist/index.html" });
      continue;
    }

    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const appId = asString(manifest.id, `miniapp-${slug}`);
    const version = asString(manifest.version, "1.0.0");
    const prefix = `${kind}/${slug}/${version}`;

    const files = await walk(distDir);
    let bytes = 0;
    if (!catalogOnly) {
      // An app is the unit worth resuming. A single exhausted object used to
      // throw, discarding the objects already uploaded for this app and
      // abandoning every app after it - a publish died at 26 of 78 that way.
      // The upload is idempotent (versioned, immutable keys), so a failed app is
      // recorded and retried at the end rather than killing the run.
      try {
        for (const rel of files) {
          const body = await fs.readFile(path.join(distDir, rel));
          bytes += body.length;
          await client.put(`${prefix}/${rel}`, body, IMMUTABLE_CACHE);
          objects += 1;
        }
        const manifestBody = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
        await client.put(`${prefix}/neo-manifest.json`, manifestBody, IMMUTABLE_CACHE);
        objects += 1;
        bytes += manifestBody.length;
      } catch (error) {
        unpublished.push({ slug, kind, reason: error.message });
        process.stdout.write(`[seed] ${kind}/${slug} FAILED - ${error.message}\n`);
        continue;
      }
    }
    bytesTotal += bytes;

    const pointer = {
      app_id: appId,
      slug,
      kind,
      version,
      entry_url: `${cdnBase}/${prefix}/index.html`,
      base_url: `${cdnBase}/${prefix}`,
      manifest_url: `${cdnBase}/${prefix}/neo-manifest.json`,
      file_count: files.length + 1,
      bytes,
      published_at: new Date().toISOString(),
    };
    await client.put(
      `meta/${kind}/${slug}/latest.json`,
      Buffer.from(`${JSON.stringify(pointer, null, 2)}\n`, "utf8"),
      POINTER_CACHE,
    );
    objects += 1;

    byKind.get(kind).push({ manifest, pointer });
    process.stdout.write(`[seed] ${kind}/${slug}@${version} ${files.length + 1} files ${(bytes / 1024).toFixed(0)}KB\n`);
  }

  const catalogsWritten = [];
  if (selected.size === 0) {
    for (const [kind, entries] of byKind) {
      if (entries.length === 0) continue;
      const apps = entries.map(({ manifest, pointer }) => {
        const urls = asObject(manifest.urls);
        const developer = asObject(manifest.developer);
        const iconUrl = bundleAssetUrl(pointer.base_url, urls.icon, "logo.webp");
        const bannerUrl = bundleAssetUrl(pointer.base_url, urls.banner, "banner.webp");
        const tags = Array.from(new Set(asArray(manifest.tags)));
        return {
          app_id: pointer.app_id,
          slug: pointer.slug,
          kind,
          name: asString(manifest.name, pointer.slug),
          name_zh: asString(manifest.name_zh) || undefined,
          name_ja: asString(manifest.name_ja) || undefined,
          description: asString(manifest.description),
          description_zh: asString(manifest.description_zh) || undefined,
          description_ja: asString(manifest.description_ja) || undefined,
          category: asString(manifest.category, "utility"),
          tags,
          version: pointer.version,
          icon_url: iconUrl,
          banner_url: bannerUrl,
          entry_url: pointer.entry_url,
          manifest_url: pointer.manifest_url,
          supported_networks: asArray(manifest.supported_networks),
          default_network: asString(manifest.default_network),
          contracts: asObject(manifest.contracts),
          onegate: {
            id: resolveOneGateId(manifest, pointer.app_id),
            isActive: true,
            name: localizedJson(manifest.name, manifest.name_zh, manifest.name_ja),
            url: `${platformBase}/play/${pointer.slug}`,
            iconUrl,
            tags,
            developer: asString(developer.name, "R3E Network").slice(0, 32),
            previews: [bannerUrl],
          },
        };
      });

      const catalog = {
        generated_at: new Date().toISOString(),
        source: `neo-${kind}`,
        kind,
        cdn_base_url: cdnBase,
        count: apps.length,
        apps,
      };
      await client.put(
        `catalog/${kind}.json`,
        Buffer.from(`${JSON.stringify(catalog, null, 2)}\n`, "utf8"),
        POINTER_CACHE,
      );
      objects += 1;
      catalogsWritten.push({ kind, count: apps.length });
    }
  }

  console.log(
    JSON.stringify(
      {
        dry_run: dryRun,
        catalog_only: catalogOnly,
        bucket,
        cdn_base_url: cdnBase,
        minigames: byKind.get("minigames").length,
        miniapps: byKind.get("miniapps").length,
        objects,
        megabytes: Number((bytesTotal / 1024 / 1024).toFixed(1)),
        catalogs: catalogsWritten,
        skipped,
        unpublished,
      },
      null,
      2,
    ),
  );

  // A partial publish must never read as a success: the catalogue would
  // advertise a version that is not on the CDN, and every launch of that app
  // would 404.
  if (unpublished.length > 0) {
    console.error(`\n${unpublished.length} app(s) did not publish:`);
    for (const entry of unpublished) console.error(`  ${entry.kind}/${entry.slug}: ${entry.reason}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
