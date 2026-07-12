import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const themes = ["fresh-market", "farm-kitchen", "night-market"];

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
      for (let index = 0; index < 12; index += 1) {
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
        assert.ok(stats.coarseColorCount >= 90,
          `${relative}: icon lacks enough color/detail complexity (${stats.coarseColorCount} coarse colors)`);
      }
    }
  });

  it("keeps the 36 runtime item icons unique instead of reusing placeholders", async () => {
    const seen = new Map();
    for (const theme of themes) {
      for (let index = 0; index < 12; index += 1) {
        const relative = `art/items/${theme}/item-${String(index).padStart(2, "0")}.webp`;
        const hash = await fingerprint(relative);
        assert.equal(seen.has(hash), false,
          `${relative}: duplicates item icon fingerprint from ${seen.get(hash)}`);
        seen.set(hash, relative);
      }
    }
    assert.equal(seen.size, 36, "all three themes must ship 36 unique item icons");
  });
});
