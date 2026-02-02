#!/usr/bin/env node
/**
 * Optimize miniapp images (logo.jpg, banner.jpg)
 * - Resize logos to 256x256
 * - Resize banners to 800x400
 * - Compress with quality 80
 */

import sharp from "sharp";
import { readdirSync, existsSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "../platform/host-app/public/miniapp-assets");

const CONFIG = {
  logo: { width: 256, height: 256, quality: 80 },
  banner: { width: 800, height: 400, quality: 80 },
};

async function optimizeImage(filePath, type) {
  const config = CONFIG[type];
  if (!config) return;

  const originalSize = statSync(filePath).size;
  const tempPath = filePath + ".tmp";

  try {
    await sharp(filePath)
      .resize(config.width, config.height, { fit: "cover" })
      .jpeg({ quality: config.quality, progressive: true })
      .toFile(tempPath);

    // Replace original with optimized
    const { rename } = await import("fs/promises");
    await rename(tempPath, filePath);

    const newSize = statSync(filePath).size;
    const saved = ((originalSize - newSize) / originalSize * 100).toFixed(1);

    return { originalSize, newSize, saved };
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("🖼️  Optimizing miniapp images...\n");

  const apps = readdirSync(assetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let totalOriginal = 0;
  let totalNew = 0;
  let processed = 0;

  for (const app of apps) {
    const appDir = join(assetsDir, app);

    // Optimize logo
    const logoPath = join(appDir, "logo.jpg");
    if (existsSync(logoPath)) {
      const result = await optimizeImage(logoPath, "logo");
      if (result) {
        totalOriginal += result.originalSize;
        totalNew += result.newSize;
        processed++;
        console.log(`  ✅ ${app}/logo.jpg: ${(result.originalSize/1024).toFixed(0)}KB → ${(result.newSize/1024).toFixed(0)}KB (-${result.saved}%)`);
      }
    }

    // Optimize banner
    const bannerPath = join(appDir, "banner.jpg");
    if (existsSync(bannerPath)) {
      const result = await optimizeImage(bannerPath, "banner");
      if (result) {
        totalOriginal += result.originalSize;
        totalNew += result.newSize;
        processed++;
        console.log(`  ✅ ${app}/banner.jpg: ${(result.originalSize/1024).toFixed(0)}KB → ${(result.newSize/1024).toFixed(0)}KB (-${result.saved}%)`);
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Processed: ${processed} images`);
  console.log(`   Original:  ${(totalOriginal/1024/1024).toFixed(2)} MB`);
  console.log(`   Optimized: ${(totalNew/1024/1024).toFixed(2)} MB`);
  console.log(`   Saved:     ${((totalOriginal-totalNew)/1024/1024).toFixed(2)} MB (${((totalOriginal-totalNew)/totalOriginal*100).toFixed(1)}%)`);
}

main().catch(console.error);
