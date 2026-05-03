#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const appsRoot = path.join(repoRoot, "apps");
const publicRoot = path.join(repoRoot, "platform", "host-app", "public", "miniapps");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await fs.mkdir(publicRoot, { recursive: true });
  const entries = await fs.readdir(appsRoot, { withFileTypes: true });
  const staged = [];
  const skipped = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "shared") continue;
    const slug = entry.name;
    const appDir = path.join(appsRoot, slug);
    const manifestPath = path.join(appDir, "neo-manifest.json");
    const distDir = path.join(appDir, "dist");
    if (!(await exists(manifestPath))) continue;
    if (!(await exists(path.join(distDir, "index.html")))) {
      skipped.push({ slug, reason: "missing dist/index.html" });
      continue;
    }

    const dest = path.join(publicRoot, slug);
    await fs.rm(dest, { recursive: true, force: true });
    await fs.cp(distDir, dest, { recursive: true });
    await fs.copyFile(manifestPath, path.join(dest, "neo-manifest.json"));
    staged.push(slug);
  }

  console.log(
    JSON.stringify(
      {
        publicRoot,
        stagedCount: staged.length,
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
