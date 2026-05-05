#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const appsRoot = path.join(repoRoot, "apps");
const archivedSlugs = new Set(["flamingo", "flaminggo", "neoburger", "neo-burger"]);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function asString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function main() {
  const entries = await fs.readdir(appsRoot, { withFileTypes: true });
  const checked = [];
  const failures = [];
  const appIds = new Map();

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name === "shared") continue;
    const slug = entry.name;
    if (archivedSlugs.has(slug)) continue;
    const appDir = path.join(appsRoot, slug);
    const manifestPath = path.join(appDir, "neo-manifest.json");
    if (!(await exists(manifestPath))) continue;

    let manifest;
    try {
      manifest = await readJson(manifestPath);
    } catch (error) {
      failures.push({ slug, reason: `invalid neo-manifest.json: ${error instanceof Error ? error.message : String(error)}` });
      continue;
    }

    const appId = asString(manifest.id);
    if (!appId) failures.push({ slug, reason: "manifest.id is required" });
    if (appId) {
      const previous = appIds.get(appId);
      if (previous) failures.push({ slug, reason: `duplicate manifest.id also used by ${previous}` });
      appIds.set(appId, slug);
    }

    const urls = asObject(manifest.urls);
    const entryUrl = asString(urls.entry);
    const expectedEntry = `/miniapps/${slug}/index.html`;
    if (entryUrl !== expectedEntry) {
      failures.push({ slug, reason: `urls.entry must be ${expectedEntry} for standalone dApp export` });
    }

    const requiredFiles = [
      "package.json",
      "index.html",
      "vite.config.ts",
      "src/main.tsx",
    ];
    for (const relative of requiredFiles) {
      if (!(await exists(path.join(appDir, relative)))) {
        failures.push({ slug, reason: `missing ${relative}` });
      }
    }

    if (!asString(urls.icon) && !(await exists(path.join(appDir, "public/logo.jpg")))) {
      failures.push({ slug, reason: "missing icon asset: set urls.icon or add public/logo.jpg" });
    }
    if (!asString(urls.banner) && !(await exists(path.join(appDir, "public/banner.jpg")))) {
      failures.push({ slug, reason: "missing banner asset: set urls.banner or add public/banner.jpg" });
    }

    const packagePath = path.join(appDir, "package.json");
    if (await exists(packagePath)) {
      try {
        const pkg = await readJson(packagePath);
        if (!pkg.scripts?.build) {
          failures.push({ slug, reason: "package.json must define scripts.build" });
        }
      } catch (error) {
        failures.push({ slug, reason: `invalid package.json: ${error instanceof Error ? error.message : String(error)}` });
      }
    }

    checked.push({ slug, app_id: appId, entry_url: entryUrl });
  }

  console.log(JSON.stringify({
    checked_count: checked.length,
    failure_count: failures.length,
    failures,
  }, null, 2));

  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
