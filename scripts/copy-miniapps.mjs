#!/usr/bin/env node
/**
 * Copy built miniapps to host-app/public/miniapps/
 * This script runs after miniapps are built with `pnpm build:miniapps`
 */

import { readdirSync, existsSync, cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const miniappsDir = join(projectRoot, "miniapps");
const targetDir = join(projectRoot, "platform/host-app/public/miniapp-assets");

const IMPORT_MAP_SNIPPET = `
  <script type="importmap">
    {
      "imports": {
        "encode-utf8": "https://esm.sh/encode-utf8@1.0.3",
        "dijkstrajs": "https://esm.sh/dijkstrajs@1.0.3"
      }
    }
  </script>`;

function injectImportMap(indexHtmlPath) {
  if (!existsSync(indexHtmlPath)) return;

  const html = readFileSync(indexHtmlPath, "utf-8");
  if (html.includes('type="importmap"') || html.includes("type='importmap'")) {
    return;
  }

  const patched = html.includes("<head>")
    ? html.replace("<head>", `<head>${IMPORT_MAP_SNIPPET}`)
    : `${IMPORT_MAP_SNIPPET}\n${html}`;

  writeFileSync(indexHtmlPath, patched, "utf-8");
}

function patchAbsoluteStaticPaths(rootDir) {
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    if (!current || !existsSync(current)) continue;

    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (!/\.(html|js|css)$/i.test(entry.name)) continue;

      const source = readFileSync(entryPath, "utf-8");
      const patched = source
        .replace(/"\/static\//g, '"./static/')
        .replace(/'\/static\//g, "'./static/")
        .replace(/\(\/static\//g, "(./static/");

      if (patched !== source) {
        writeFileSync(entryPath, patched, "utf-8");
      }
    }
  }
}

// Ensure target directory exists
if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

// Get all miniapp directories (exclude sdk)
const miniapps = readdirSync(miniappsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "sdk")
  .map((d) => d.name);

console.log(`📦 Copying ${miniapps.length} miniapps to host-app...`);

let copied = 0;
let skipped = 0;

// Asset files to copy from public/ directory
const PUBLIC_ASSETS = ["banner.jpg", "banner.png", "logo.jpg", "logo.png"];

for (const app of miniapps) {
  const buildDir = join(miniappsDir, app, "dist/build/h5");

  if (existsSync(buildDir)) {
    const dest = join(targetDir, app);
    // Remove existing and copy fresh
    if (existsSync(dest)) {
      rmSync(dest, { recursive: true });
    }
    cpSync(buildDir, dest, { recursive: true });

    injectImportMap(join(dest, "index.html"));
    patchAbsoluteStaticPaths(dest);

    // Copy public assets (banner, logo) if they exist
    const publicDir = join(miniappsDir, app, "public");
    if (existsSync(publicDir)) {
      for (const asset of PUBLIC_ASSETS) {
        const assetPath = join(publicDir, asset);
        if (existsSync(assetPath)) {
          cpSync(assetPath, join(dest, asset));
        }
      }
    }

    copied++;
    console.log(`  ✅ ${app}`);
  } else {
    skipped++;
    console.log(`  ⏭️  ${app} (no build found)`);
  }
}

console.log(`\n📊 Summary: ${copied} copied, ${skipped} skipped`);
console.log(`📁 Output: ${targetDir}`);
