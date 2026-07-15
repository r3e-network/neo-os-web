#!/usr/bin/env node
/**
 * generate-logo.mjs — launcher app icon (fogplay)
 *
 * The shipped logo.webp was pale gold/green coins floating on a near-white
 * (#FFF8E7-ish) tile. The launcher renders app icons inside a white rounded
 * chrome frame, so a near-white icon on a near-white frame has almost no edge:
 * at the rendered launcher size fogplay read as a blank tile next to
 * high-contrast neighbours. The icon needs to carry its own ground.
 *
 * (The old public/logo.svg had also drifted out of sync with the shipped
 * raster entirely — it was a separate gold/teal design with baked-in "FP"
 * lettering that nothing rendered. This script makes the SVG the real source
 * again, so source and raster cannot disagree.)
 *
 * Design constraints:
 *   - Tinted, self-contained ground. The tile is deep felt green, which is what
 *     separates the icon from the white launcher chrome.
 *   - Reads at small sizes: one silhouette (two fanned cards), no fine detail,
 *     no lettering. Icons are seen at ~40-90px.
 *   - Uses the app's own scene palette (FogplayScene C.*: felt #0b6b3a,
 *     feltDeep #095a31, gold #e8b94f, cream #fffff3, teal #16c784) so the icon
 *     matches the game behind it.
 *   - The "fog" half of the name is the veil drawn across the cards.
 *
 * Original art, drawn as vector primitives here. Deterministic.
 *
 * Usage:  cd apps/fogplay && node scripts/generate-logo.mjs
 * Output: public/logo.svg (source), public/logo.webp, public/logo.avif
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public");
mkdirSync(OUT, { recursive: true });

const S = 512;

// ── Palette (mirrors FogplayScene's C.*) ───────────────────────────────────
const P = {
  felt:      "#0b6b3a",
  feltDeep:  "#095a31",
  feltLight: "#128a4c",
  gold:      "#e8b94f",
  goldDeep:  "#9f6a1e",
  cream:     "#fffff3",
  teal:      "#16c784",
  ink:       "#253428",
};

const f = (n) => Number(n.toFixed(2));

/** One playing card: cream face, gold rim, rotated about the fan's pivot. */
function card(cx, cy, w, h, angle, pip) {
  const o = (v) => f(v);
  let g = `<g transform="rotate(${f(angle)} ${o(cx)} ${o(cy)})">`;
  g += `<rect x="${o(cx - w / 2)}" y="${o(cy - h / 2)}" width="${o(w)}" height="${o(h)}" rx="${o(w * 0.14)}" fill="${P.ink}" opacity="0.22" transform="translate(0 6)"/>`;
  g += `<rect x="${o(cx - w / 2)}" y="${o(cy - h / 2)}" width="${o(w)}" height="${o(h)}" rx="${o(w * 0.14)}" fill="${P.cream}"/>`;
  g += `<rect x="${o(cx - w / 2 + 5)}" y="${o(cy - h / 2 + 5)}" width="${o(w - 10)}" height="${o(h - 10)}" rx="${o(w * 0.11)}" fill="none" stroke="${P.gold}" stroke-width="4"/>`;
  if (pip) {
    // A single bold diamond pip — legible at 40px, unlike a rank/suit glyph.
    g += `<path d="M ${o(cx)} ${o(cy - h * 0.17)} L ${o(cx + w * 0.19)} ${o(cy)} L ${o(cx)} ${o(cy + h * 0.17)} L ${o(cx - w * 0.19)} ${o(cy)} Z" fill="${pip}"/>`;
  }
  g += `</g>`;
  return g;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="FogPlay">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0.7" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="${P.feltLight}"/>
      <stop offset="0.55" stop-color="${P.felt}"/>
      <stop offset="1" stop-color="${P.feltDeep}"/>
    </linearGradient>
    <radialGradient id="tableGlow" cx="0.5" cy="0.34" r="0.62">
      <stop offset="0" stop-color="${P.teal}" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${P.teal}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#eafff4" stop-opacity="0.62"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="fogBlur" x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <clipPath id="tileClip">
      <rect x="0" y="0" width="${S}" height="${S}" rx="112"/>
    </clipPath>
  </defs>

  <g clip-path="url(#tileClip)">
    <!-- The tinted ground: this is what gives the icon an edge against the
         launcher's white chrome frame. -->
    <rect width="${S}" height="${S}" fill="url(#tile)"/>
    <rect width="${S}" height="${S}" fill="url(#tableGlow)"/>

    <!-- Fanned hand, centred on the tile and sized to fill it: at ~40px the
         silhouette is all that survives, so it has to own the frame. -->
    ${card(198, 268, 168, 234, -17, P.teal)}
    ${card(322, 258, 168, 234, 14, P.gold)}

    <!-- The fog: a soft veil drawn across the hand, the app's namesake. -->
    <rect x="-40" y="286" width="${S + 80}" height="132" fill="url(#fog)" filter="url(#fogBlur)"/>
    <rect x="-40" y="170" width="${S + 80}" height="76" fill="url(#fog)" filter="url(#fogBlur)" opacity="0.5"/>

    <!-- Inner rim keeps the silhouette crisp when the tile is downscaled. -->
    <rect x="3" y="3" width="${S - 6}" height="${S - 6}" rx="110" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="6"/>
  </g>
</svg>`;

writeFileSync(join(OUT, "logo.svg"), svg);

const png = await sharp(Buffer.from(svg), { density: 288 })
  .resize(S, S, { fit: "fill" })
  .png()
  .toBuffer();
await sharp(png).webp({ quality: 92 }).toFile(join(OUT, "logo.webp"));
await sharp(png).avif({ quality: 65 }).toFile(join(OUT, "logo.avif"));

console.log(`fogplay logo: ${S}x${S} -> logo.svg / logo.webp / logo.avif`);
