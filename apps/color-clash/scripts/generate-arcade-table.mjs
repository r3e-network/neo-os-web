/**
 * Bake a vertical alpha ramp into the arcade-hall backdrop.
 *
 * ColorClashScene draws this image as a band across the middle of the board
 * (drawBackground: setDisplaySize(W * 1.18, min(156, H * 0.28))). The source is
 * an opaque photo, so the band ended in crisp horizontal edges against the flat
 * cream board — an unfinished art seam rather than a depth layer. Fading the
 * top and bottom rows to transparent in the asset itself lets the band dissolve
 * into the board at any display size, with no runtime mask.
 *
 * Horizontal edges are deliberately left alone: the band is drawn 1.18x wider
 * than the canvas, so its left/right edges sit outside the visible board.
 *
 * Run: node scripts/generate-arcade-table.mjs
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(root, "public/art/arcade-table-source.webp");
const output = resolve(root, "public/art/arcade-table.webp");

/** Fraction of the image height that dissolves at each edge. */
const FADE = 0.24;

/** Smoothstep — a linear ramp still shows a faint line where it meets full opacity. */
function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

const { data, info } = await sharp(input)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const alpha = Buffer.alloc(width * height);
const fadeRows = Math.max(1, Math.round(height * FADE));

for (let y = 0; y < height; y += 1) {
  const fromTop = y / fadeRows;
  const fromBottom = (height - 1 - y) / fadeRows;
  const value = Math.round(255 * smoothstep(Math.min(fromTop, fromBottom, 1)));
  alpha.fill(value, y * width, (y + 1) * width);
}

await sharp(data, { raw: { width, height, channels } })
  .ensureAlpha()
  .joinChannel(alpha, { raw: { width, height, channels: 1 } })
  .webp({ quality: 88, alphaQuality: 100 })
  .toFile(output);

console.log(`wrote ${output} (${width}x${height}, ${Math.round(FADE * 100)}% edge fade)`);
