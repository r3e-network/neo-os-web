#!/usr/bin/env node
/**
 * generate-banner.mjs — launcher hero art (gas-lucky-pool)
 *
 * Replaces the legacy "OneGate Vault" marketing banner, which baked its own
 * typography ("OneGate Vault", "Official OneGate entry for Neo reward claims",
 * ONEGATE / NEP-21 chips) plus a near-black logo card straight into the image.
 *
 * `MiniAppHomeShell` paints this file as a full-bleed `<img class="n3h-hero-banner">`
 * (object-fit: cover) *behind* the live headline, covered only by a soft white
 * scrim. Any baked-in copy therefore ghosts through the real headline — badly on
 * mobile, where the hero crops to the centre ~26% of the artwork and the old
 * 86px "Vault" glyphs landed dead-centre behind the title.
 *
 * Constraints this art is designed against:
 *   - No typography, no logo, no lettering of any kind. The shell owns the words.
 *   - No near-black / high-contrast hard edges: the scrim only ranges 0.9 -> 0
 *     white, so dark marks survive it as legible ghosts. Everything here stays
 *     mid-tone warm so the scrim resolves it into atmosphere.
 *   - Crop-safe: reads as intentional at the desktop crop (x 295..1145) and at
 *     the much tighter mobile crop (x 536..904), so the centre band stays calm
 *     and the prize wheel sits right-of-centre where the scrim has faded out.
 *   - Warm amber/gold identity matching the app tokens (--mx2-brand #b77915,
 *     --mx2-accent #d97706, --mx2-brand-light #fbeccb, --mx2-accent-soft #fdf1e0)
 *     and the festive sector palette already used by generate-wheel.mjs.
 *
 * Original art, drawn as vector primitives here. Deterministic: the scatter uses
 * a fixed seed, so re-running reproduces the same file byte-for-byte.
 *
 * Usage:  cd apps/gas-lucky-pool && node scripts/generate-banner.mjs
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

// Visible-crop landmarks (see header). Used to keep the mobile band calm.
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
const rand = rng(0x9a17c0de);
const between = (lo, hi) => lo + rand() * (hi - lo);
const f = (n) => Number(n).toFixed(1);

// ── Wheel geometry (right-of-centre, bleeds off the right edge) ────
const WHEEL = { cx: 1040, cy: 340, r: 240 };
const wpt = (deg, r) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [WHEEL.cx + r * Math.cos(a), WHEEL.cy + r * Math.sin(a)];
};

// Tonal amber sectors — festive read without any dark rim.
const SECTOR_A = "#f7c85c";
const SECTOR_B = "#fcdf9b";

let wheel = "";
{
  const N = 12;
  for (let i = 0; i < N; i += 1) {
    const a0 = i * (360 / N);
    const a1 = (i + 1) * (360 / N);
    const [x0, y0] = wpt(a0, WHEEL.r);
    const [x1, y1] = wpt(a1, WHEEL.r);
    wheel +=
      `<path d="M${WHEEL.cx},${WHEEL.cy} L${f(x0)},${f(y0)} ` +
      `A${WHEEL.r},${WHEEL.r} 0 0 1 ${f(x1)},${f(y1)} Z" ` +
      `fill="${i % 2 ? SECTOR_A : SECTOR_B}" stroke="#fffaf0" stroke-width="3"/>`;
  }
  // Soft gold rim + evenly spaced bulbs (mid-tone only).
  wheel += `<circle cx="${WHEEL.cx}" cy="${WHEEL.cy}" r="${WHEEL.r}" fill="none" stroke="#e0a93f" stroke-width="10"/>`;
  wheel += `<circle cx="${WHEEL.cx}" cy="${WHEEL.cy}" r="${WHEEL.r}" fill="none" stroke="#fff1cd" stroke-width="3"/>`;
  for (let i = 0; i < 24; i += 1) {
    const [bx, by] = wpt(i * 15, WHEEL.r + 11);
    wheel += `<circle cx="${f(bx)}" cy="${f(by)}" r="6" fill="${i % 2 ? "#fff3c4" : "#ffd36b"}" opacity="0.9"/>`;
  }
  // Hub — concentric warm discs, no lettering.
  wheel += `<circle cx="${WHEEL.cx}" cy="${WHEEL.cy}" r="52" fill="#f3b94e"/>`;
  wheel += `<circle cx="${WHEEL.cx}" cy="${WHEEL.cy}" r="40" fill="#fff1cd"/>`;
  wheel += `<circle cx="${WHEEL.cx}" cy="${WHEEL.cy}" r="19" fill="#f0ad3c"/>`;
}

// ── Bokeh: broad warm discs, full-bleed so every crop keeps depth ──
let bokeh = "";
for (let i = 0; i < 26; i += 1) {
  const x = between(-40, W + 40);
  const y = between(-30, H + 30);
  const r = between(26, 104);
  // Fade the scatter through the mobile band so the title keeps a calm ground.
  const inBand = x > MOBILE_CROP.x0 - 60 && x < MOBILE_CROP.x1 + 60;
  const op = (inBand ? between(0.05, 0.1) : between(0.09, 0.19)).toFixed(3);
  const fill = i % 3 === 0 ? "#f5b640" : i % 3 === 1 ? "#e9a13a" : "#ffd88a";
  bokeh += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" opacity="${op}"/>`;
}

// ── Confetti: festive mid-tone flecks, denser away from the title band ──
const CONFETTI = ["#ffc21a", "#ff9d2e", "#19d27a", "#16d0e0", "#a855f7", "#ff6b4f"];
let confetti = "";
for (let i = 0; i < 64; i += 1) {
  const x = between(-20, W + 20);
  const y = between(-20, H + 20);
  const inBand = x > MOBILE_CROP.x0 - 40 && x < MOBILE_CROP.x1 + 40;
  // Keep a light sprinkle in the band (life without noise behind the headline).
  if (inBand && rand() > 0.32) continue;
  const c = CONFETTI[i % CONFETTI.length];
  const op = (inBand ? between(0.2, 0.34) : between(0.42, 0.72)).toFixed(3);
  const rot = f(between(0, 360));
  if (i % 4 === 0) {
    confetti += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(between(3.5, 7))}" fill="${c}" opacity="${op}"/>`;
  } else {
    const w = between(7, 16);
    const h = between(3.5, 7);
    confetti +=
      `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" ` +
      `fill="${c}" opacity="${op}" transform="rotate(${rot} ${f(x)} ${f(y)})"/>`;
  }
}

// ── Coins: warm gold discs drifting out of the wheel ───────────────
const COINS = [
  { x: 812, y: 545, r: 34 },
  { x: 905, y: 592, r: 24 },
  { x: 1188, y: 556, r: 30 },
  { x: 1298, y: 470, r: 22 },
  { x: 1252, y: 148, r: 26 },
  { x: 742, y: 168, r: 20 },
];
let coins = "";
for (const c of COINS) {
  coins += `<circle cx="${c.x}" cy="${c.y + 4}" r="${c.r}" fill="#c98c22" opacity="0.14"/>`;
  coins += `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="#f5c95e"/>`;
  coins += `<circle cx="${c.x}" cy="${c.y}" r="${(c.r * 0.66).toFixed(1)}" fill="#fde8ad"/>`;
  coins += `<circle cx="${c.x}" cy="${c.y}" r="${(c.r * 0.34).toFixed(1)}" fill="#f0b842"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="">
  <defs>
    <linearGradient id="warmField" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fffdf7"/>
      <stop offset="0.54" stop-color="#fdf1e0"/>
      <stop offset="1" stop-color="#fbeccb"/>
    </linearGradient>
    <radialGradient id="glowRight" cx="0.74" cy="0.46" r="0.62">
      <stop offset="0" stop-color="#f7c85c" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#f7c85c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowLeft" cx="0.1" cy="0.86" r="0.5">
      <stop offset="0" stop-color="#e9a13a" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#e9a13a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="wheelHalo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="0.62" stop-color="#ffe6ab" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#ffe6ab" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#warmField)"/>
  <rect width="${W}" height="${H}" fill="url(#glowRight)"/>
  <rect width="${W}" height="${H}" fill="url(#glowLeft)"/>

  ${bokeh}

  <circle cx="${WHEEL.cx}" cy="${WHEEL.cy}" r="${WHEEL.r + 150}" fill="url(#wheelHalo)"/>
  <g opacity="0.55">
    ${wheel}
  </g>

  <g opacity="0.72">
    ${coins}
  </g>

  ${confetti}
</svg>`;

writeFileSync(join(OUT, "banner.svg"), `${svg}\n`);
console.log("  [SVG ] public/banner.svg  (clean hero art source, no typography)");

const png = await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
await sharp(png).webp({ quality: 90 }).toFile(join(OUT, "banner.webp"));
console.log("  [WEBP] public/banner.webp (1440x640 launcher hero)");
await sharp(png).avif({ quality: 62 }).toFile(join(OUT, "banner.avif"));
console.log("  [AVIF] public/banner.avif (1440x640 launcher hero)");
