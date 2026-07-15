#!/usr/bin/env node
/**
 * generate-banner.mjs — launcher hero art (merge-kingdom)
 *
 * Replaces a banner whose focal subject — a saturated cyan crystal castle —
 * sat dead-centre at x 640..880, y 260..520. `MiniAppHomeShell` paints this
 * file as a full-bleed `<img class="n3h-hero-banner">` with `object-fit: cover`
 * behind the live headline, so on a 390px viewport the 1440x640 banner cover-
 * fits to the hero height and crops to the centre ~26% of its width. That put
 * the busiest, most contrasty part of the art directly under the description
 * copy, which `GameHomePage` renders in rgba(26,26,25,0.82) at 14px. The
 * mobile scrim is a vertical cream ramp that only reaches ~0.5 where the
 * description starts, so mid-tone teal roofs and stone towers stayed visible
 * through it and the body copy lost its contrast. The title survived on weight
 * alone; the description did not.
 *
 * Crop windows this art is composed against (banner is 1440x640):
 *   - mobile  x 536..904  — the only slice a 390px viewport ever shows.
 *   - desktop x 295..1145 — of which the copy column covers x 295..595, and
 *     the shell's own 90deg white scrim (0.9 -> 0 left-to-right) already
 *     resolves that side.
 *
 * Composition rules that follow from those windows:
 *   - The mobile band's LOWER half (y > 330) is where the copy lands. It stays
 *     a calm, light parchment field: no buildings, no hard edges, nothing the
 *     0.5..0.83 cream ramp cannot dissolve into atmosphere.
 *   - The mobile band's upper area (y 70..300) carries one modest, low-contrast
 *     keep so the mobile hero is not an empty wash above the title.
 *   - The tall focal castle sits right-of-centre (x ~940..1180), clear of the
 *     mobile band entirely and in the desktop zone where the white scrim has
 *     faded to ~0 — so desktop still gets a real subject beside the copy.
 *   - No typography, no logo, no lettering: the shell paints the real H1 over
 *     this image.
 *   - Warm parchment/gold identity matching the app's own scene palette
 *     (bg #f5ead2, gold #d4a843, goldLight #f0c866, goldDim #a07030,
 *     boardBg #c9a96e) rather than the old cyan crystal theme.
 *
 * Original art, drawn as vector primitives here — no third-party assets.
 * Deterministic: the scatter uses a fixed seed, so re-running reproduces the
 * same file byte-for-byte.
 *
 * Usage:  cd apps/merge-kingdom && node scripts/generate-banner.mjs
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

// ── Palette (mirrors MergeKingdomScene's C.*) ──────────────────────────────
const P = {
  field:     "#f5ead2",
  fieldDeep: "#eaddb8",
  board:     "#c9a96e",
  boardDim:  "#9a7040",
  gold:      "#d4a843",
  goldLight: "#f0c866",
  goldDim:   "#a07030",
  cream:     "#fff8e6",
  stone:     "#e6d7b4",
  stoneDim:  "#c8b489",
  roof:      "#7fa87f",
  roofDim:   "#5f8760",
  grass:     "#9dbd76",
  grassDim:  "#7d9c5b",
};

const f = (n) => Number(n.toFixed(2));

// Deterministic PRNG (mulberry32) so the scatter is reproducible.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One isometric plot: a diamond of land with an optional keep on top.
 * `tone` scales the whole thing toward the field colour so pieces inside the
 * mobile band can be pushed back into the parchment.
 */
function plot(cx, cy, size, opts = {}) {
  const { tower = 0, tone = 1, roofed = true } = opts;
  const hw = size;          // half width of the diamond
  const hh = size * 0.5;    // half height (2:1 isometric)
  const depth = size * 0.26;
  const o = (v) => f(v);

  const top = `${o(cx)},${o(cy - hh)} ${o(cx + hw)},${o(cy)} ${o(cx)},${o(cy + hh)} ${o(cx - hw)},${o(cy)}`;
  const left = `${o(cx - hw)},${o(cy)} ${o(cx)},${o(cy + hh)} ${o(cx)},${o(cy + hh + depth)} ${o(cx - hw)},${o(cy + depth)}`;
  const right = `${o(cx + hw)},${o(cy)} ${o(cx)},${o(cy + hh)} ${o(cx)},${o(cy + hh + depth)} ${o(cx + hw)},${o(cy + depth)}`;

  let g = `<g opacity="${f(tone)}">`;
  // Soft contact shadow — radial, no hard edge.
  g += `<ellipse cx="${o(cx)}" cy="${o(cy + hh + depth * 0.7)}" rx="${o(hw * 0.96)}" ry="${o(hh * 0.5)}" fill="url(#plotShadow)"/>`;
  g += `<polygon points="${left}" fill="${P.boardDim}" opacity="0.5"/>`;
  g += `<polygon points="${right}" fill="${P.board}" opacity="0.55"/>`;
  g += `<polygon points="${top}" fill="${P.grass}"/>`;
  g += `<polygon points="${top}" fill="url(#grassSheen)" opacity="0.5"/>`;

  if (tower > 0) {
    // A simple keep: body + roof, all mid-tone so the scrim can absorb it.
    const bw = size * 0.5;
    const bh = size * tower;
    const by = cy - hh * 0.15;
    g += `<rect x="${o(cx - bw / 2)}" y="${o(by - bh)}" width="${o(bw)}" height="${o(bh)}" rx="${o(bw * 0.08)}" fill="${P.stone}"/>`;
    g += `<rect x="${o(cx - bw / 2)}" y="${o(by - bh)}" width="${o(bw * 0.42)}" height="${o(bh)}" fill="${P.stoneDim}" opacity="0.5"/>`;
    if (roofed) {
      g += `<polygon points="${o(cx)},${o(by - bh - bw * 0.62)} ${o(cx + bw * 0.66)},${o(by - bh)} ${o(cx - bw * 0.66)},${o(by - bh)}" fill="${P.roof}"/>`;
      g += `<polygon points="${o(cx)},${o(by - bh - bw * 0.62)} ${o(cx + bw * 0.66)},${o(by - bh)} ${o(cx)},${o(by - bh)}" fill="${P.roofDim}" opacity="0.55"/>`;
    }
  }
  g += `</g>`;
  return g;
}

/** The focal castle: a stepped keep cluster, right-of-centre, desktop-only. */
function castle(cx, cy, s) {
  const o = (v) => f(v);
  let g = `<g>`;
  g += `<ellipse cx="${o(cx)}" cy="${o(cy + s * 0.62)}" rx="${o(s * 1.5)}" ry="${o(s * 0.4)}" fill="url(#plotShadow)"/>`;
  // Base plot
  g += plot(cx, cy + s * 0.3, s * 1.25);
  // Three stepped towers — tallest centre, gold-capped.
  const towers = [
    { dx: -s * 0.62, h: s * 0.9,  w: s * 0.34 },
    { dx: s * 0.60,  h: s * 1.05, w: s * 0.36 },
    { dx: 0,         h: s * 1.5,  w: s * 0.46 },
  ];
  for (const t of towers) {
    const x = cx + t.dx;
    const top = cy + s * 0.18 - t.h;
    g += `<rect x="${o(x - t.w / 2)}" y="${o(top)}" width="${o(t.w)}" height="${o(t.h)}" rx="${o(t.w * 0.1)}" fill="${P.stone}"/>`;
    g += `<rect x="${o(x - t.w / 2)}" y="${o(top)}" width="${o(t.w * 0.4)}" height="${o(t.h)}" fill="${P.stoneDim}" opacity="0.45"/>`;
    // Crenellation band
    g += `<rect x="${o(x - t.w * 0.58)}" y="${o(top - t.w * 0.14)}" width="${o(t.w * 1.16)}" height="${o(t.w * 0.18)}" fill="${P.stoneDim}"/>`;
    // Conical roof, warm gold instead of the old cyan crystal.
    g += `<polygon points="${o(x)},${o(top - t.w * 0.98)} ${o(x + t.w * 0.6)},${o(top - t.w * 0.14)} ${o(x - t.w * 0.6)},${o(top - t.w * 0.14)}" fill="${P.gold}"/>`;
    g += `<polygon points="${o(x)},${o(top - t.w * 0.98)} ${o(x + t.w * 0.6)},${o(top - t.w * 0.14)} ${o(x)},${o(top - t.w * 0.14)}" fill="${P.goldDim}" opacity="0.5"/>`;
    g += `<circle cx="${o(x)}" cy="${o(top - t.w * 1.06)}" r="${o(t.w * 0.09)}" fill="${P.goldLight}"/>`;
  }
  g += `</g>`;
  return g;
}

const rand = rng(0x4d4b21);

// ── Motes: faint drifting sparks, kept out of the copy zone ────────────────
let motes = "";
for (let i = 0; i < 26; i++) {
  const x = rand() * W;
  const y = rand() * H;
  // Never place a mote in the mobile band's copy zone (x 536..904, y > 320):
  // even a 2px dot is a hard edge the cream ramp renders as speckle.
  if (x > 520 && x < 920 && y > 320) continue;
  const r = 1.6 + rand() * 2.6;
  motes += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${P.cream}" opacity="${f(0.28 + rand() * 0.3)}"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="">
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#fdf6e6"/>
      <stop offset="0.52" stop-color="${P.field}"/>
      <stop offset="1" stop-color="${P.fieldDeep}"/>
    </linearGradient>
    <radialGradient id="glowRight" cx="0.78" cy="0.42" r="0.52">
      <stop offset="0" stop-color="${P.goldLight}" stop-opacity="0.38"/>
      <stop offset="1" stop-color="${P.goldLight}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowLeft" cx="0.16" cy="0.34" r="0.46">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="plotShadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${P.boardDim}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${P.boardDim}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="grassSheen" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${P.grassDim}" stop-opacity="0.3"/>
    </linearGradient>
    <!-- Calms the lower-centre so the description copy always has a quiet bed,
         independent of whatever sits behind it. -->
    <linearGradient id="copyCalm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.field}" stop-opacity="0"/>
      <stop offset="1" stop-color="#fdf7ea" stop-opacity="0.72"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#field)"/>
  <rect width="${W}" height="${H}" fill="url(#glowLeft)"/>
  <rect width="${W}" height="${H}" fill="url(#glowRight)"/>

  <!-- Distant, heavily receded plots: texture without contrast. Positioned so
       nothing lands in the mobile band below y=330. -->
  ${plot(232, 214, 44, { tower: 0.72, tone: 0.4 })}
  ${plot(404, 168, 38, { tower: 0.5, tone: 0.34 })}
  ${plot(1268, 196, 42, { tower: 0.62, tone: 0.42 })}

  <!-- The one keep inside the mobile band, held high (y ~150..300) and pushed
       back toward the parchment so it reads as depth, not as clutter. -->
  ${plot(720, 236, 62, { tower: 0.78, tone: 0.55 })}

  <!-- Foreground plots, left and right of the mobile band. -->
  ${plot(300, 470, 74, { tower: 0.62, tone: 0.9 })}
  ${plot(478, 402, 58, { tower: 0.46, tone: 0.72 })}
  ${plot(1150, 486, 70, { tower: 0.54, tone: 0.86 })}

  <!-- Focal castle: right-of-centre, outside the mobile crop (x 536..904),
       inside the desktop zone where the shell's white scrim has faded out. -->
  ${castle(1010, 336, 104)}

  ${motes}

  <!-- Keeps the copy bed calm across the full width, strongest at the base. -->
  <rect x="0" y="300" width="${W}" height="${H - 300}" fill="url(#copyCalm)"/>
</svg>`;

writeFileSync(join(OUT, "banner.svg"), svg);

const png = await sharp(Buffer.from(svg), { density: 144 })
  .resize(W, H, { fit: "fill" })
  .png()
  .toBuffer();
await sharp(png).webp({ quality: 90 }).toFile(join(OUT, "banner.webp"));
await sharp(png).avif({ quality: 62 }).toFile(join(OUT, "banner.avif"));

console.log(`merge-kingdom banner: ${W}x${H} -> banner.svg / banner.webp / banner.avif`);
