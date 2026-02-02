#!/usr/bin/env node
/**
 * Copy built miniapps to host-app/public/miniapps/
 * This script runs after miniapps are built with `pnpm build:miniapps`
 */

import { readdirSync, existsSync, cpSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const miniappsDir = join(projectRoot, "miniapps");
const targetDir = join(projectRoot, "platform/host-app/public/miniapp-assets");

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
