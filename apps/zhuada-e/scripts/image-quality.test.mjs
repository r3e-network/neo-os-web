import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const themes = ["fresh-market", "farm-kitchen", "night-market"];
const itemCount = 54;
const structuralAccentKinds = {
  "fresh-market": new Set([0, 1, 3, 7, 9, 10, 12, 13, 14, 16, 17]),
  "farm-kitchen": new Set([0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 13, 15, 16]),
  "night-market": new Set([0, 2, 4, 5, 8, 10, 11, 12, 13, 14, 15, 16, 17]),
};

async function readRgba(relative) {
  return sharp(path.join(publicDir, relative))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

function analyzeIcon(data, info) {
  let visible = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  const coarseColors = new Set();

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha < 16) continue;
      visible += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      coarseColors.add(`${data[offset] >> 4}:${data[offset + 1] >> 4}:${data[offset + 2] >> 4}`);
    }
  }

  return {
    coverage: visible / (info.width * info.height),
    padding: Math.min(minX, minY, info.width - 1 - maxX, info.height - 1 - maxY),
    boxWidth: maxX - minX + 1,
    boxHeight: maxY - minY + 1,
    coarseColorCount: coarseColors.size,
    cornerAlpha: [
      data[3],
      data[((info.width - 1) * 4) + 3],
      data[((info.height - 1) * info.width * 4) + 3],
      data[(((info.height - 1) * info.width + info.width - 1) * 4) + 3],
    ],
  };
}

function meanVisibleColor(data) {
  let count = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] < 32) continue;
    red += data[offset];
    green += data[offset + 1];
    blue += data[offset + 2];
    count += 1;
  }
  return [red / count, green / count, blue / count];
}

function colorDistance(left, right) {
  return Math.hypot(
    left[0] - right[0],
    left[1] - right[1],
    left[2] - right[2],
  );
}

function preservedDetailRatio(base, variant) {
  let visible = 0;
  let preserved = 0;
  for (let offset = 0; offset < base.length; offset += 4) {
    if (base[offset + 3] < 32 || variant[offset + 3] < 32) continue;
    visible += 1;
    if (colorDistance(
      [base[offset], base[offset + 1], base[offset + 2]],
      [variant[offset], variant[offset + 1], variant[offset + 2]],
    ) <= 18) {
      preserved += 1;
    }
  }
  return preserved / visible;
}

async function fingerprint(relative) {
  const bytes = await sharp(path.join(publicDir, relative))
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer();
  return createHash("sha256").update(bytes).digest("hex");
}

describe("generated item icon quality gate", () => {
  it("keeps every item icon visible, padded, transparent, and visually detailed", async () => {
    for (const theme of themes) {
      for (let index = 0; index < itemCount; index += 1) {
        const relative = `art/items/${theme}/item-${String(index).padStart(2, "0")}.webp`;
        const { data, info } = await readRgba(relative);
        const stats = analyzeIcon(data, info);

        assert.equal(info.width, 256, `${relative}: expected 256px width`);
        assert.equal(info.height, 256, `${relative}: expected 256px height`);
        assert.ok(stats.cornerAlpha.every((alpha) => alpha === 0),
          `${relative}: transparent item icons must keep all corners clear`);
        assert.ok(stats.coverage >= 0.25 && stats.coverage <= 0.68,
          `${relative}: expected 25-68% visible subject coverage, got ${(stats.coverage * 100).toFixed(1)}%`);
        assert.ok(stats.padding >= 8,
          `${relative}: expected at least 8px transparent padding, got ${stats.padding}px`);
        assert.ok(Math.min(stats.boxWidth, stats.boxHeight) >= 96,
          `${relative}: subject bounding box is too small (${stats.boxWidth}x${stats.boxHeight})`);
        // Clean silhouettes intentionally avoid tiny dots and line markers;
        // broad material gradients can therefore have fewer coarse buckets
        // than a decorated icon while still carrying real shading and depth.
        assert.ok(stats.coarseColorCount >= 80,
          `${relative}: icon lacks enough color/detail complexity (${stats.coarseColorCount} coarse colors)`);
      }
    }
  });

  it("keeps the 162 runtime item icons unique instead of reusing placeholders", async () => {
    const seen = new Map();
    for (const theme of themes) {
      for (let index = 0; index < itemCount; index += 1) {
        const relative = `art/items/${theme}/item-${String(index).padStart(2, "0")}.webp`;
        const hash = await fingerprint(relative);
        assert.equal(seen.has(hash), false,
          `${relative}: duplicates item icon fingerprint from ${seen.get(hash)}`);
        seen.set(hash, relative);
      }
    }
    assert.equal(seen.size, 162, "all three themes must ship 162 unique item icons");
  });

  it("keeps full-body color treatments on every near-match identity", async () => {
    for (const theme of themes) {
      for (let baseKind = 0; baseKind < 18; baseKind += 1) {
        const baseRead = await readRgba(`art/items/${theme}/item-${String(baseKind).padStart(2, "0")}.webp`);
        const warm = baseKind + 18;
        const cool = baseKind + 36;
        const warmRead = await readRgba(`art/items/${theme}/item-${String(warm).padStart(2, "0")}.webp`);
        const coolRead = await readRgba(`art/items/${theme}/item-${String(cool).padStart(2, "0")}.webp`);
        const baseColor = meanVisibleColor(baseRead.data);
        const warmColor = meanVisibleColor(warmRead.data);
        const coolColor = meanVisibleColor(coolRead.data);
        assert.ok(colorDistance(baseColor, warmColor) >= 35,
          `${theme}/item-${String(warm).padStart(2, "0")}.webp: full-body color treatment is too subtle`);
        assert.ok(colorDistance(baseColor, coolColor) >= 35,
          `${theme}/item-${String(cool).padStart(2, "0")}.webp: full-body color treatment is too subtle`);
        assert.ok(colorDistance(warmColor, coolColor) >= 35,
          `${theme}/${baseKind}: the two treatments are too similar`);
        if (structuralAccentKinds[theme].has(baseKind)) {
          assert.ok(preservedDetailRatio(baseRead.data, warmRead.data) >= 0.01,
            `${theme}/item-${String(warm).padStart(2, "0")}.webp: fixed material accents were recolored away`);
          assert.ok(preservedDetailRatio(baseRead.data, coolRead.data) >= 0.01,
            `${theme}/item-${String(cool).padStart(2, "0")}.webp: fixed material accents were recolored away`);
        }
      }
    }
  });
});
