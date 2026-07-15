#!/usr/bin/env node
/**
 * generate-banner.mjs — launcher hero art (flappy-dash)
 *
 * Replaces a banner that was a raster reproduction of the original Flappy Bird
 * assets — the pixel bird sprite, the dark-outlined green pipes, the dotted
 * city skyline and the striped ground. Two problems with it:
 *
 *   1. Legibility. `MiniAppHomeShell` paints this file as a full-bleed
 *      `<img class="n3h-hero-banner">` (object-fit: cover) *behind* the live
 *      headline. The bird sat at x 340..540 of the 1440-wide art, which lands
 *      squarely inside the desktop copy column, and it is a hard-edged,
 *      high-contrast sprite at a low native resolution. The shell's 90deg white
 *      scrim only reaches ~0.6 there, so instead of dissolving into atmosphere
 *      the sprite survived as a pixelated smudge straight through "Tap, Dodge,
 *      Chase a New Best".
 *   2. Provenance. It was not original artwork.
 *
 * This replacement is drawn from scratch as vector primitives in the app's own
 * scene palette (FlappyScene's C.*: sky #8bd7ea, accent #16c784, primary
 * #ffa83d, stroke #ffd076, ink #173247), so it reads as this app rather than as
 * someone else's game.
 *
 * Crop windows this art is composed against (banner is 1440x640):
 *   - mobile  x 536..904  — the only slice a 390px viewport ever shows.
 *   - desktop x 295..1145 — of which the copy column covers x 295..595.
 *
 * Composition rules that follow from those windows:
 *   - x 295..600 (the desktop copy column) stays bare sky. Nothing with an edge
 *     goes there — that region exists to be written over.
 *   - The mobile band's lower half (x 536..904, y > 330) stays a calm gradient:
 *     the mobile cream ramp only reaches ~0.5 where the description starts, so
 *     anything with contrast there would ghost exactly as the old bird did.
 *   - The focal glider and its gate sit at x > 940 — outside the mobile crop and
 *     in the desktop zone where the white scrim has faded to ~0.
 *   - No typography, no logo, no lettering: the shell paints the real H1 over it.
 *
 * Original art. Deterministic: the cloud scatter uses a fixed seed, so
 * re-running reproduces the same file byte-for-byte.
 *
 * Usage:  cd apps/flappy-dash && node scripts/generate-banner.mjs
 * Output: public/banner.svg (source), public/banner.webp, public/banner.avif
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public");
mkdirSync(OUT, { recursive: true });

const W = 1440;
const H = 640;

// ── Palette (mirrors FlappyScene's C.*) ────────────────────────────────────
const P = {
  skyHigh:  "#d8f4fb",
  skyMid:   "#a8e2f1",
  skyLow:   "#8bd7ea",
  cloud:    "#ffffff",
  accent:   "#16c784",
  accentDim:"#0f9c66",
  primary:  "#ffa83d",
  stroke:   "#ffd076",
  ink:      "#173247",
  inkSoft:  "#42677c",
  panel:    "#fffff7",
};

const f = (n) => Number(n.toFixed(2));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A soft, edgeless cloud: overlapping blurred lobes, no outline. */
function cloud(cx, cy, s, opacity) {
  const o = (v) => f(v);
  const lobes = [
    [0, 0, 1],
    [-s * 0.62, s * 0.16, 0.72],
    [s * 0.66, s * 0.2, 0.66],
    [-s * 0.26, -s * 0.3, 0.6],
    [s * 0.3, -s * 0.26, 0.56],
  ];
  let g = `<g opacity="${f(opacity)}" filter="url(#soften)">`;
  for (const [dx, dy, r] of lobes) {
    g += `<ellipse cx="${o(cx + dx)}" cy="${o(cy + dy)}" rx="${o(s * r)}" ry="${o(s * r * 0.62)}" fill="${P.cloud}"/>`;
  }
  g += `</g>`;
  return g;
}

/**
 * A rounded flight gate — the app's own shape language (soft capsule pylons in
 * the accent green), deliberately NOT the outlined pipe of the original game.
 */
function gate(cx, gapTop, gapH, w) {
  const o = (v) => f(v);
  const r = w * 0.34;
  let g = `<g>`;
  // Upper pylon
  g += `<rect x="${o(cx - w / 2)}" y="${o(-20)}" width="${o(w)}" height="${o(gapTop + 20)}" rx="${o(r)}" fill="url(#pylon)"/>`;
  g += `<rect x="${o(cx - w / 2)}" y="${o(-20)}" width="${o(w * 0.3)}" height="${o(gapTop + 20)}" rx="${o(r * 0.7)}" fill="${P.cloud}" opacity="0.24"/>`;
  // Lower pylon
  const lowTop = gapTop + gapH;
  g += `<rect x="${o(cx - w / 2)}" y="${o(lowTop)}" width="${o(w)}" height="${o(H - lowTop + 20)}" rx="${o(r)}" fill="url(#pylon)"/>`;
  g += `<rect x="${o(cx - w / 2)}" y="${o(lowTop)}" width="${o(w * 0.3)}" height="${o(H - lowTop + 20)}" rx="${o(r * 0.7)}" fill="${P.cloud}" opacity="0.24"/>`;
  g += `</g>`;
  return g;
}

/**
 * The glider: an original rounded dart with a swept wing and a warm belly.
 * No pixel grid, no black outline, no beak — it is a flight mark, not a bird
 * sprite, and it is rendered large enough that nothing is upscaled.
 */
function glider(cx, cy, s, tilt) {
  const o = (v) => f(v);
  let g = `<g transform="translate(${o(cx)} ${o(cy)}) rotate(${f(tilt)})">`;
  // Soft drop shadow beneath, radial so it has no edge.
  g += `<ellipse cx="0" cy="${o(s * 1.5)}" rx="${o(s * 1.1)}" ry="${o(s * 0.26)}" fill="${P.inkSoft}" opacity="0.12"/>`;
  // Body
  g += `<ellipse cx="0" cy="0" rx="${o(s)}" ry="${o(s * 0.72)}" fill="url(#body)"/>`;
  // Belly highlight
  g += `<ellipse cx="${o(-s * 0.12)}" cy="${o(s * 0.2)}" rx="${o(s * 0.66)}" ry="${o(s * 0.4)}" fill="${P.stroke}" opacity="0.55"/>`;
  // Swept wing
  g += `<path d="M ${o(-s * 0.1)} ${o(-s * 0.1)} Q ${o(-s * 0.95)} ${o(-s * 0.85)} ${o(-s * 1.15)} ${o(-s * 0.05)} Q ${o(-s * 0.7)} ${o(s * 0.3)} ${o(-s * 0.1)} ${o(-s * 0.1)} Z" fill="${P.accent}"/>`;
  g += `<path d="M ${o(-s * 0.1)} ${o(-s * 0.1)} Q ${o(-s * 0.95)} ${o(-s * 0.85)} ${o(-s * 1.15)} ${o(-s * 0.05)} Q ${o(-s * 0.85)} ${o(-s * 0.3)} ${o(-s * 0.1)} ${o(-s * 0.1)} Z" fill="${P.accentDim}" opacity="0.45"/>`;
  // Tail
  g += `<path d="M ${o(s * 0.72)} ${o(-s * 0.1)} L ${o(s * 1.2)} ${o(-s * 0.42)} L ${o(s * 1.12)} ${o(s * 0.24)} Z" fill="${P.accent}" opacity="0.85"/>`;
  // Eye — a soft dot, no outline.
  g += `<circle cx="${o(s * 0.38)}" cy="${o(-s * 0.18)}" r="${o(s * 0.14)}" fill="${P.panel}"/>`;
  g += `<circle cx="${o(s * 0.42)}" cy="${o(-s * 0.18)}" r="${o(s * 0.07)}" fill="${P.ink}" opacity="0.8"/>`;
  g += `</g>`;
  return g;
}

const rand = rng(0x1f7a3c);

// ── Clouds: high only, and never inside the mobile copy zone ───────────────
let clouds = "";
for (let i = 0; i < 9; i++) {
  const x = rand() * W;
  const y = 40 + rand() * 250;
  // Skip the desktop copy column entirely — it is written over.
  if (x > 280 && x < 610) continue;
  clouds += cloud(x, y, 28 + rand() * 34, 0.3 + rand() * 0.26);
}

// A couple of deliberate, very soft clouds high inside the mobile band so the
// mobile hero has some sky interest above the title without touching the copy.
clouds += cloud(700, 150, 44, 0.4);
clouds += cloud(840, 232, 34, 0.3);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="">
  <defs>
    <linearGradient id="sky" x1="0.05" y1="0" x2="0.75" y2="1">
      <stop offset="0" stop-color="#f2fbfe"/>
      <stop offset="0.42" stop-color="${P.skyHigh}"/>
      <stop offset="1" stop-color="${P.skyMid}"/>
    </linearGradient>
    <radialGradient id="glowRight" cx="0.76" cy="0.46" r="0.5">
      <stop offset="0" stop-color="${P.skyLow}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${P.skyLow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowLeft" cx="0.14" cy="0.3" r="0.44">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.62"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="pylon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${P.accent}"/>
      <stop offset="0.55" stop-color="#3fd89b"/>
      <stop offset="1" stop-color="${P.accentDim}"/>
    </linearGradient>
    <radialGradient id="body" cx="0.38" cy="0.34" r="0.72">
      <stop offset="0" stop-color="${P.stroke}"/>
      <stop offset="1" stop-color="${P.primary}"/>
    </radialGradient>
    <filter id="soften" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7"/>
    </filter>
    <!-- Calms the lower band so the description copy always has a quiet bed. -->
    <linearGradient id="copyCalm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eaf8fd" stop-opacity="0"/>
      <stop offset="1" stop-color="#f4fbfe" stop-opacity="0.7"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#glowRight)"/>
  <rect width="${W}" height="${H}" fill="url(#glowLeft)"/>

  ${clouds}

  <!-- Flight gates, all right of the mobile crop (x 536..904) and right of the
       desktop copy column, so they never sit under any text. -->
  ${gate(1096, 96, 224, 74)}
  ${gate(1268, 210, 206, 74)}
  ${gate(1416, 140, 230, 74)}

  <!-- Focal glider: its widest point (wing tip) is x 978 - 46*1.15 = 925, which
       clears the mobile crop's right edge at x 904, so a 390px viewport never
       renders any part of it behind the copy. -->
  ${glider(978, 286, 46, -8)}

  <!-- Soft horizon wash instead of the old striped ground: no hard seam. -->
  <rect x="0" y="470" width="${W}" height="170" fill="url(#copyCalm)"/>
</svg>`;

writeFileSync(join(OUT, "banner.svg"), svg);

const png = await sharp(Buffer.from(svg), { density: 144 })
  .resize(W, H, { fit: "fill" })
  .png()
  .toBuffer();
await sharp(png).webp({ quality: 90 }).toFile(join(OUT, "banner.webp"));
await sharp(png).avif({ quality: 62 }).toFile(join(OUT, "banner.avif"));

console.log(`flappy-dash banner: ${W}x${H} -> banner.svg / banner.webp / banner.avif`);
