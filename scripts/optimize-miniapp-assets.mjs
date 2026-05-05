#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const assetRoot = path.join(repoRoot, "platform/host-app/public/miniapp-assets");
const appsRoot = path.join(repoRoot, "apps");

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const replaceLarger = args.has("--replace-larger");

const JPG_NAMES = new Set(["logo.jpg", "banner.jpg"]);

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listHostAssetMasters(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const masters = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const dir = path.join(root, entry.name);
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !JPG_NAMES.has(file.name)) continue;
      masters.push(path.join(dir, file.name));
    }
  }

  return masters.sort();
}

async function listAppAssetMasters(root) {
  if (!(await pathExists(root))) return [];

  const entries = await fs.readdir(root, { withFileTypes: true });
  const masters = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "shared") continue;
    const publicDir = path.join(root, entry.name, "public");
    if (!(await pathExists(publicDir))) continue;

    for (const fileName of JPG_NAMES) {
      const filePath = path.join(publicDir, fileName);
      if (await pathExists(filePath)) masters.push(filePath);
    }
  }

  return masters.sort();
}

async function shouldWrite(source, output) {
  if (force) return true;
  try {
    const [srcStat, outStat] = await Promise.all([fs.stat(source), fs.stat(output)]);
    return outStat.mtimeMs < srcStat.mtimeMs;
  } catch {
    return true;
  }
}

async function writeVariant(source, ext) {
  const output = source.replace(/\.jpg$/i, `.${ext}`);
  if (!(await shouldWrite(source, output))) {
    const stat = await fs.stat(output);
    return { output, bytes: stat.size, skipped: true };
  }

  const tempOutput = `${output}.tmp-${process.pid}-${Date.now()}`;
  const pipeline = sharp(source).rotate();
  if (ext === "webp") {
    await pipeline
      .webp({
        quality: 88,
        effort: 5,
        smartSubsample: true,
      })
      .toFile(tempOutput);
  } else {
    await pipeline
      .avif({
        quality: 68,
        effort: 6,
        chromaSubsampling: "4:4:4",
      })
      .toFile(tempOutput);
  }

  const tempStat = await fs.stat(tempOutput);
  const existingStat = await fs.stat(output).catch(() => null);
  if (!replaceLarger && existingStat && existingStat.size <= tempStat.size) {
    await fs.rm(tempOutput, { force: true });
    return {
      output,
      bytes: existingStat.size,
      skipped: true,
      keptExisting: true,
      candidateBytes: tempStat.size,
    };
  }

  await fs.rename(tempOutput, output);
  return { output, bytes: tempStat.size, skipped: false };
}

const masters = [
  ...(await listHostAssetMasters(assetRoot)),
  ...(await listAppAssetMasters(appsRoot)),
];
const outputs = [];
let originalBytes = 0;
let modernBytes = 0;

for (const source of masters) {
  const sourceStat = await fs.stat(source);
  originalBytes += sourceStat.size;
  const [webp, avif] = await Promise.all([
    writeVariant(source, "webp"),
    writeVariant(source, "avif"),
  ]);
  outputs.push({ source, originalBytes: sourceStat.size, webp, avif });
  modernBytes += Math.min(webp.bytes, avif.bytes);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      masters: masters.length,
      written: outputs.flatMap((item) => [item.webp, item.avif]).filter((item) => !item.skipped).length,
      skipped: outputs.flatMap((item) => [item.webp, item.avif]).filter((item) => item.skipped).length,
      keptExisting: outputs.flatMap((item) => [item.webp, item.avif]).filter((item) => item.keptExisting).length,
      originalBytes,
      bestModernBytes: modernBytes,
      estimatedSavingsPct:
        originalBytes > 0
          ? Number((((originalBytes - modernBytes) / originalBytes) * 100).toFixed(2))
          : 0,
    },
    null,
    2,
  ),
);
