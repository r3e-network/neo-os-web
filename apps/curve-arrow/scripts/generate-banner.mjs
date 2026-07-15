#!/usr/bin/env node
/**
 * generate-banner.mjs — launcher hero art (curve-arrow)
 *
 * Replaces the previous banner, which baked its own typography ("Curve Arrow"
 * at ~86px plus "Bend the shot. Split the gold.") straight into the top-left of
 * the artwork — exactly where the shell paints the real headline.
 *
 * `MiniAppHomeShell` renders this file as a full-bleed `<img class="n3h-hero-banner">`
 * (object-fit: cover, scale 1.02) *behind* the live HTML headline, covered only by
 * `.n3h-hero-scene::after`:
 *     linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.84))
 *   × linear-gradient(90deg,  rgba(255,255,255,.66), rgba(255,255,255,.12))
 * so the art survives at ~33% top-left and ~85% top-right. Baked lettering there
 * ghosted straight through the real headline: the desktop crop crossed the middle
 * of the word, printing "e Arrow" and "t. Split the gold." above the true H1, and
 * the tighter mobile crop landed on a single giant stray "W".
 *
 * Constraints this art is designed against:
 *   - No typography, no lettering of any kind. The shell owns the words.
 *   - Crop-safe. The hero shows only a horizontal band of the 1440x640 source:
 *       desktop  x 296..1144  (898x678 hero box; cover scale 1.0594)
 *       mobile   x 536..904   (tight centre band)
 *     Both bands must read as a deliberate composition on their own, so the
 *     signature curve + a wall sit inside the mobile band and the target sits at
 *     x~1060 — inside the desktop band, where the scrim is weakest and the art
 *     is meant to be the focal point.
 *   - The headline lands top-left, where the scrim only lifts the art to ~33%.
 *     That quadrant therefore stays low-detail sky so dark ink stays legible.
 *   - Warm dusk identity matching the app tokens (--mx2-brand #d7742f,
 *     --mx2-brand-hover #b9581f, --mx2-brand-subtle #ffd7a3,
 *     --mx2-brand-light #fff2dc) and the range art in public/art/.
 *
 * Original art, drawn as vector primitives here — no third-party asset packs.
 * Deterministic: the scatter uses a fixed seed, so re-running reproduces the
 * same file byte-for-byte.
 *
 * Usage:  cd apps/curve-arrow && node scripts/generate-banner.mjs
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

// Visible-crop landmarks (see header).
const DESKTOP_CROP = { x0: 296, x1: 1144 };
const MOBILE_CROP = { x0: 536, x1: 904 };

// Deterministic scatter — mulberry32.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(0x0cbe7a11);
const between = (lo, hi) => lo + rand() * (hi - lo);
const f = (n) => Number(n).toFixed(1);

const HORIZON = 404;

/* ── Pine forest band ──────────────────────────────────────────────
 * Mid-tone teal-greens, deliberately not near-black: under the weak
 * top-right scrim a near-black tree line reads as a hard cut-out, and
 * under the strong top-left scrim it turns to grey mud. Three depth
 * layers, back-to-front, each a little darker and a little taller.
 */
function pines(count, baseY, minH, maxH, fill, opacity) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = between(-40, W + 40);
    const h = between(minH, maxH);
    const w = h * between(0.5, 0.68);
    const tiers = 3;
    let body = "";
    for (let t = 0; t < tiers; t++) {
      const ty = baseY - h + (h / tiers) * t * 0.82;
      const tw = (w / 2) * (0.55 + (t / (tiers - 1)) * 0.45);
      const th = h / tiers + h * 0.16;
      body += `<path d="M${f(x)} ${f(ty)} L${f(x + tw)} ${f(ty + th)} L${f(x - tw)} ${f(ty + th)} Z"/>`;
    }
    body += `<rect x="${f(x - w * 0.035)}" y="${f(baseY - h * 0.06)}" width="${f(w * 0.07)}" height="${f(h * 0.08)}"/>`;
    out += `<g fill="${fill}">${body}</g>`;
  }
  return `<g opacity="${opacity}">${out}</g>`;
}

/* ── Stone wall ────────────────────────────────────────────────────
 * The obstacle the shot bends over. Warm grey so it sits with the dusk
 * palette instead of punching a cold hole in it.
 */
function wall(x, topY, cols, rows) {
  const bw = 46;
  const bh = 44;
  const gap = 3;
  let out = "";
  const width = cols * bw;
  // Soft ground shadow at the wall's own base (the wall is built upward from
  // the horizon), keeping it seated on the field instead of floating.
  out += `<ellipse cx="${f(x + width / 2)}" cy="${f(topY + rows * bh + 4)}" rx="${f(width * 0.72)}" ry="9" fill="#2f5b34" opacity="0.34"/>`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bx = x + c * bw;
      const by = topY + r * bh;
      const tone = 0.5 + rand() * 0.5;
      const light = `rgba(214, 214, 208, ${f(0.5 + tone * 0.5)})`;
      out += `<rect x="${f(bx + gap / 2)}" y="${f(by + gap / 2)}" width="${f(bw - gap)}" height="${f(bh - gap)}" rx="5" fill="url(#stone)"/>`;
      out += `<rect x="${f(bx + gap / 2)}" y="${f(by + gap / 2)}" width="${f(bw - gap)}" height="${f((bh - gap) * 0.34)}" rx="5" fill="${light}" opacity="0.34"/>`;
    }
  }
  return `<g>${out}</g>`;
}

/* ── Archery target ────────────────────────────────────────────────
 * Sits at x~1060: inside the desktop crop (296..1144) and out of the
 * mobile band, so each viewport gets one clear subject rather than a
 * half-cropped one.
 */
function target(cx, cy, r) {
  const rings = [
    ["#f3ece0", 1.0],
    ["#1f2d3a", 0.8],
    ["#2f6fb5", 0.6],
    ["#d0503f", 0.4],
    ["#e9a73a", 0.2],
  ];
  let out = "";
  // Legs first so they read behind the board.
  out += `<g stroke="#8a5a34" stroke-width="9" stroke-linecap="round">
      <line x1="${f(cx - r * 0.42)}" y1="${f(cy + r * 0.7)}" x2="${f(cx - r * 0.72)}" y2="${f(cy + r * 1.5)}"/>
      <line x1="${f(cx + r * 0.42)}" y1="${f(cy + r * 0.7)}" x2="${f(cx + r * 0.72)}" y2="${f(cy + r * 1.5)}"/>
    </g>`;
  out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 1.1)}" fill="#8a5a34"/>`;
  for (const [fill, scale] of rings) {
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * scale)}" fill="${fill}"/>`;
  }
  out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 1.1)}" fill="none" stroke="#6f4526" stroke-width="3" opacity="0.7"/>`;
  return out;
}

/* ── The signature curved shot ─────────────────────────────────────
 * Rises from the lower left, bends over both walls, loops, then dives
 * into the target. Drawn as one path so the glow, the core and the
 * dashes stay in register.
 */
const TRAIL =
  "M 318 588 C 372 470, 452 392, 560 356 C 668 320, 742 356, 806 330 " +
  "C 866 306, 878 236, 934 226 C 986 217, 1006 268, 968 292 " +
  "C 930 316, 900 268, 940 240 C 986 208, 1046 300, 1060 404";

const bokeh = (() => {
  let out = "";
  for (let i = 0; i < 26; i++) {
    const x = between(0, W);
    const y = between(40, HORIZON - 20);
    const r = between(3, 13);
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#ffd9a0" opacity="${f(between(0.05, 0.16))}"/>`;
  }
  return out;
})();

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.18" y2="1">
      <stop offset="0" stop-color="#2c5150"/>
      <stop offset="0.34" stop-color="#3f6b62"/>
      <stop offset="0.62" stop-color="#b98a52"/>
      <stop offset="0.82" stop-color="#e6a75c"/>
      <stop offset="1" stop-color="#f6d9a4"/>
    </linearGradient>
    <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#579349"/>
      <stop offset="1" stop-color="#3c7038"/>
    </linearGradient>
    <linearGradient id="stone" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#b9b7ae"/>
      <stop offset="1" stop-color="#8f8d86"/>
    </linearGradient>
    <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffe9bd" stop-opacity="0.85"/>
      <stop offset="0.55" stop-color="#f0b063" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#f0b063" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="trailInk" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffe9bd"/>
      <stop offset="0.55" stop-color="#ffd08a"/>
      <stop offset="1" stop-color="#f2a24e"/>
    </linearGradient>
    <filter id="soften" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>

  <!-- Low sun, right-of-centre: the scrim is weakest there, so the warm
       core of the image lands where it will actually be seen. -->
  <circle cx="1004" cy="366" r="250" fill="url(#sunGlow)"/>

  ${bokeh}

  ${pines(30, HORIZON + 6, 78, 128, "#4b7a63", 0.42)}
  ${pines(24, HORIZON + 12, 104, 170, "#356053", 0.66)}
  ${pines(18, HORIZON + 18, 132, 214, "#254a44", 0.88)}

  <rect x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#field)"/>
  <ellipse cx="720" cy="${HORIZON + 30}" rx="900" ry="46" fill="#6aa457" opacity="0.34"/>

  ${wall(560, HORIZON - 176, 2, 4)}
  ${wall(840, HORIZON - 264, 2, 6)}

  <g>
    ${target(1060, 404, 78)}
  </g>

  <!-- Trail: blurred glow, solid core, dashed tracer. -->
  <path d="${TRAIL}" fill="none" stroke="#ffd9a0" stroke-width="26" opacity="0.5" filter="url(#soften)" stroke-linecap="round"/>
  <path d="${TRAIL}" fill="none" stroke="url(#trailInk)" stroke-width="7.5" stroke-linecap="round"/>
  <path d="${TRAIL}" fill="none" stroke="#fff6e2" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="13 17" opacity="0.9"/>

  <!-- Arrowhead, buried in the gold. -->
  <g transform="translate(1060 404) rotate(74)">
    <path d="M0 -34 L11 -6 L0 2 L-11 -6 Z" fill="#f0a94e" stroke="#b9581f" stroke-width="2" stroke-linejoin="round"/>
  </g>
  <circle cx="1060" cy="404" r="7" fill="#ffe9bd" opacity="0.95"/>
</svg>`;

writeFileSync(join(OUT, "banner.svg"), `${svg}\n`);
console.log("  [SVG ] public/banner.svg  (clean hero art source, no typography)");
console.log(`         desktop crop x ${DESKTOP_CROP.x0}..${DESKTOP_CROP.x1} | mobile crop x ${MOBILE_CROP.x0}..${MOBILE_CROP.x1}`);

const png = await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
await sharp(png).resize(W, H).webp({ quality: 90 }).toFile(join(OUT, "banner.webp"));
console.log("  [WEBP] public/banner.webp (1440x640 launcher hero)");
await sharp(png).resize(W, H).avif({ quality: 62 }).toFile(join(OUT, "banner.avif"));
console.log("  [AVIF] public/banner.avif (1440x640 launcher hero)");
