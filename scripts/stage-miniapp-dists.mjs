#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const appsRoot = path.join(repoRoot, "apps");
const publicRoot = path.join(repoRoot, "platform", "host-app", "public", "miniapps");

const archivedSlugs = new Set(["flamingo", "flaminggo", "neoburger", "neo-burger"]);
const defaultBaseUrl = "https://neomini.app";
const baseUrl = normalizeBaseUrl(
  process.env.MINIAPP_DAPP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    defaultBaseUrl,
);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return defaultBaseUrl;
  try {
    const parsed = new URL(raw);
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return defaultBaseUrl;
  }
}

function absoluteUrl(rawPath) {
  const raw = String(rawPath || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw, `${baseUrl}/`).toString();
  } catch {
    return "";
  }
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function asString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  const out = String(value).trim();
  return out || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : [];
}

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

function localizedJson(en, zh) {
  const name = asString(en);
  const zhName = asString(zh);
  return JSON.stringify(zhName && zhName !== name ? { en: name, zh: zhName } : { en: name });
}

function normalizeStandaloneEntry(manifest, slug) {
  const urls = asObject(manifest.urls);
  const entry = asString(urls.entry);
  if (entry.startsWith("/miniapps/")) return entry;
  if (entry.startsWith("http://") || entry.startsWith("https://")) return entry;
  return `/miniapps/${slug}/index.html`;
}

function normalizeAssetUrl(value, slug, fileName) {
  const raw = asString(value);
  if (raw) return raw;
  return `/miniapps/${slug}/${fileName}`;
}

async function readManifest(appDir) {
  const text = await fs.readFile(path.join(appDir, "neo-manifest.json"), "utf8");
  return JSON.parse(text);
}

function buildCatalogItem(slug, manifest) {
  const appId = asString(manifest.id, `miniapp-${slug}`);
  const urls = asObject(manifest.urls);
  const developer = asObject(manifest.developer);
  const standalonePath = normalizeStandaloneEntry(manifest, slug);
  const manifestPath = `/miniapps/${slug}/neo-manifest.json`;
  const iconPath = normalizeAssetUrl(urls.icon, slug, "logo.jpg");
  const bannerPath = normalizeAssetUrl(urls.banner, slug, "banner.jpg");
  const name = asString(manifest.name, appId);
  const nameZh = asString(manifest.name_zh);
  const description = asString(manifest.description);
  const descriptionZh = asString(manifest.description_zh);
  const website = asString(developer.website || developer.url);
  const tags = Array.from(new Set(asArray(manifest.tags)));
  const languages = nameZh || descriptionZh ? ["en", "zh"] : ["en"];
  const onegateId = resolveOneGateId(manifest, appId);

  const onegate = {
    id: onegateId,
    isActive: true,
    name: localizedJson(name, nameZh),
    url: absoluteUrl(standalonePath),
    iconUrl: absoluteUrl(iconPath),
    tags,
    languages,
    developer: asString(developer.name, "R3E Network").slice(0, 32),
    website: website ? absoluteUrl(website) : undefined,
    previews: [absoluteUrl(bannerPath)].filter(Boolean),
    description: description || descriptionZh ? localizedJson(description, descriptionZh) : undefined,
  };

  return {
    app_id: appId,
    slug,
    name,
    name_zh: nameZh || undefined,
    description,
    description_zh: descriptionZh || undefined,
    category: asString(manifest.category, "utility"),
    tags,
    version: asString(manifest.version, "1.0.0"),
    dapp_url: standalonePath,
    dapp_absolute_url: absoluteUrl(standalonePath),
    manifest_url: manifestPath,
    manifest_absolute_url: absoluteUrl(manifestPath),
    icon_url: iconPath,
    banner_url: bannerPath,
    supported_networks: asArray(manifest.supported_networks),
    default_network: asString(manifest.default_network),
    contracts: asObject(manifest.contracts),
    onegate,
  };
}

async function main() {
  await fs.mkdir(publicRoot, { recursive: true });
  const entries = await fs.readdir(appsRoot, { withFileTypes: true });
  const staged = [];
  const skipped = [];
  const catalogApps = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name === "shared") continue;
    const slug = entry.name;
    if (archivedSlugs.has(slug)) continue;

    const appDir = path.join(appsRoot, slug);
    const manifestPath = path.join(appDir, "neo-manifest.json");
    const distDir = path.join(appDir, "dist");
    if (!(await exists(manifestPath))) continue;

    if (!(await exists(path.join(distDir, "index.html")))) {
      skipped.push({ slug, reason: "missing dist/index.html" });
      continue;
    }

    const manifest = await readManifest(appDir);
    const dest = path.join(publicRoot, slug);
    await fs.rm(dest, { recursive: true, force: true });
    await fs.cp(distDir, dest, { recursive: true });
    await fs.copyFile(manifestPath, path.join(dest, "neo-manifest.json"));
    staged.push(slug);
    catalogApps.push(buildCatalogItem(slug, manifest));
  }

  const generatedAt = new Date().toISOString();
  const catalog = {
    generated_at: generatedAt,
    base_url: baseUrl,
    count: catalogApps.length,
    apps: catalogApps,
  };
  await fs.writeFile(
    path.join(publicRoot, "catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(publicRoot, "onegate-catalog.json"),
    `${JSON.stringify({
      generatedAt,
      source: "neo-miniapps-platform",
      baseUrl,
      dapps: catalogApps.map((app) => app.onegate),
    }, null, 2)}\n`,
  );

  console.log(
    JSON.stringify(
      {
        publicRoot,
        baseUrl,
        stagedCount: staged.length,
        catalogCount: catalogApps.length,
        skipped,
      },
      null,
      2,
    ),
  );

  if (skipped.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
