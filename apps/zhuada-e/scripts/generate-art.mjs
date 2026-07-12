#!/usr/bin/env node
/**
 * Optimize the approved, original ImageGen masters into production web assets.
 * Source PNGs live outside public/ so Vite does not ship the multi-megabyte
 * masters; every runtime file below is reproducible from art-src/.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(appDir, "art-src");
const publicDir = path.join(appDir, "public");
const artDir = path.join(publicDir, "art");
const geeseDir = path.join(artDir, "geese");

await fs.mkdir(artDir, { recursive: true });
await fs.mkdir(geeseDir, { recursive: true });

const themeAtlases = [
  ["fresh-market", "items-fresh-market-atlas.png"],
  ["farm-kitchen", "items-farm-kitchen-atlas.png"],
  ["night-market", "items-night-market-atlas.png"],
];

// Atlases are authoring sources only. Runtime uses the cleaned transparent
// per-item files below, so remove legacy public atlases instead of shipping
// three large unused sprite sheets.
for (const [themeId] of themeAtlases) {
  await fs.rm(path.join(artDir, `items-${themeId}-atlas.webp`), { force: true });
}

async function emitBrand(sourceName, base, width, height) {
  const source = sharp(path.join(sourceDir, sourceName)).resize(width, height, {
    fit: "cover",
    position: "centre",
  });
  await source.clone().png({ compressionLevel: 9, palette: true }).toFile(path.join(publicDir, `${base}.png`));
  await source.clone().webp({ quality: 86, smartSubsample: true }).toFile(path.join(publicDir, `${base}.webp`));
  await source.clone().avif({ quality: 58, effort: 6 }).toFile(path.join(publicDir, `${base}.avif`));
}

async function emitWebAsset(sourceName, outputName, width, height, quality = 80) {
  await sharp(path.join(sourceDir, sourceName))
    .resize(width, height, { fit: "cover", position: "centre" })
    .webp({ quality, smartSubsample: true, effort: 6 })
    .toFile(path.join(artDir, outputName));
}

async function emitCollectionGoose(sourceName, outputName) {
  await sharp(path.join(sourceDir, sourceName))
    .resize(512, 512, {
      fit: "contain",
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 6 })
    .toFile(path.join(geeseDir, outputName));
}

/** Remove only the pale atlas background connected to a tile's outer edge.
 * The dark cartoon outline protects cream/white objects (egg, cup, bun) from
 * being keyed out, unlike a global color-distance mask. */
function removeConnectedBackground(data, width, height) {
  const total = width * height;
  const corner = 12;
  let r = 0;
  let g = 0;
  let b = 0;
  let samples = 0;
  const sampleBlock = (x0, y0) => {
    for (let y = y0; y < y0 + corner; y += 1) {
      for (let x = x0; x < x0 + corner; x += 1) {
        const p = (y * width + x) * 4;
        r += data[p];
        g += data[p + 1];
        b += data[p + 2];
        samples += 1;
      }
    }
  };
  sampleBlock(0, 0);
  sampleBlock(width - corner, 0);
  sampleBlock(0, height - corner);
  sampleBlock(width - corner, height - corner);
  const bg = [r / samples, g / samples, b / samples];
  const toleranceSq = 44 * 44;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const canRemove = (index) => {
    const p = index * 4;
    const dr = data[p] - bg[0];
    const dg = data[p + 1] - bg[1];
    const db = data[p + 2] - bg[2];
    return dr * dr + dg * dg + db * db <= toleranceSq;
  };
  const enqueue = (index) => {
    if (visited[index] || !canRemove(index)) return;
    visited[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  for (let i = 0; i < total; i += 1) {
    if (visited[i]) data[i * 4 + 3] = 0;
  }
  return data;
}

/** Image generators can let a neighboring cell graze an atlas boundary. Keep
 * the dominant centered object (plus a nearby detached baked shadow) and drop
 * disconnected edge debris before the tile becomes a runtime texture. */
function removeDisconnectedDebris(data, width, height) {
  const total = width * height;
  const labels = new Int32Array(total).fill(-1);
  const queue = new Int32Array(total);
  const components = [];
  for (let seed = 0; seed < total; seed += 1) {
    if (labels[seed] !== -1 || data[seed * 4 + 3] < 12) continue;
    const id = components.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    labels[seed] = id;
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const visit = (next) => {
        if (labels[next] !== -1 || data[next * 4 + 3] < 12) return;
        labels[next] = id;
        queue[tail++] = next;
      };
      if (x > 0) visit(index - 1);
      if (x + 1 < width) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y + 1 < height) visit(index + width);
    }
    components.push({ count, minX, minY, maxX, maxY });
  }
  if (components.length <= 1) return data;
  let mainId = 0;
  for (let i = 1; i < components.length; i += 1) {
    if (components[i].count > components[mainId].count) mainId = i;
  }
  const main = components[mainId];
  const gap = (a0, a1, b0, b1) => Math.max(0, Math.max(a0, b0) - Math.min(a1, b1));
  const keep = new Uint8Array(components.length);
  keep[mainId] = 1;
  components.forEach((component, id) => {
    if (id === mainId || component.count < 36) return;
    const dx = gap(main.minX, main.maxX, component.minX, component.maxX);
    const dy = gap(main.minY, main.maxY, component.minY, component.maxY);
    const touchesEdge = component.minX <= 1 || component.minY <= 1
      || component.maxX >= width - 2 || component.maxY >= height - 2;
    if (!touchesEdge && Math.hypot(dx, dy) <= 24) keep[id] = 1;
  });
  for (let i = 0; i < total; i += 1) {
    if (labels[i] >= 0 && !keep[labels[i]]) data[i * 4 + 3] = 0;
  }
  return data;
}

async function emitItemSprites(themeId, sourceName) {
  const normalized = await sharp(path.join(sourceDir, sourceName))
    .resize(1200, 900, { fit: "fill" })
    .png()
    .toBuffer();
  const targetDir = path.join(artDir, "items", themeId);
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
  for (let kind = 0; kind < 12; kind += 1) {
    const col = kind % 4;
    const row = Math.floor(kind / 4);
    const { data, info } = await sharp(normalized)
      .extract({ left: col * 300, top: row * 300, width: 300, height: 300 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    removeConnectedBackground(data, info.width, info.height);
    removeDisconnectedDebris(data, info.width, info.height);
    await sharp(data, { raw: info })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(224, 224, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100, effort: 6 })
      .toFile(path.join(targetDir, `item-${String(kind).padStart(2, "0")}.webp`));
  }
}

await emitBrand("logo-master.png", "logo", 512, 512);
await emitBrand("banner-master.png", "banner", 1024, 512);

const assets = [
  ["theme-fresh-market.png", "theme-fresh-market.webp", 768, 1152, 78],
  ["theme-farm-kitchen.png", "theme-farm-kitchen.webp", 768, 1152, 78],
  ["theme-night-market.png", "theme-night-market.webp", 768, 1152, 80],
  ["mascot-fresh-market.png", "mascot-fresh-market.webp", 512, 512, 86],
  ["mascot-farm-kitchen.png", "mascot-farm-kitchen.webp", 512, 512, 86],
  ["mascot-night-market.png", "mascot-night-market.webp", 512, 512, 88],
  ["container-fresh-market.png", "container-fresh-market.webp", 1024, 1024, 86],
  ["container-farm-kitchen.png", "container-farm-kitchen.webp", 1024, 1024, 86],
  ["container-night-market.png", "container-night-market.webp", 1024, 1024, 88],
];

const collectionGeese = Array.from({ length: 6 }, (_, index) => {
  const id = String(index).padStart(2, "0");
  return [`goose-collection-${id}.png`, `goose-${id}.webp`];
});

for (const [source, output, width, height, quality] of assets) {
  await emitWebAsset(source, output, width, height, quality);
}

for (const [source, output] of collectionGeese) {
  await emitCollectionGoose(source, output);
}

for (const [themeId, source] of themeAtlases) {
  await emitItemSprites(themeId, source);
}

for (const file of [
  "logo.png", "logo.webp", "logo.avif",
  "banner.png", "banner.webp", "banner.avif",
  ...assets.map(([, output]) => path.join("art", output)),
  ...collectionGeese.map(([, output]) => path.join("art", "geese", output)),
  ...themeAtlases.flatMap(([themeId]) => Array.from(
    { length: 12 },
    (_, kind) => path.join("art", "items", themeId, `item-${String(kind).padStart(2, "0")}.webp`),
  )),
]) {
  const stat = await fs.stat(path.join(publicDir, file));
  console.log(`${file}\t${stat.size} bytes`);
}
