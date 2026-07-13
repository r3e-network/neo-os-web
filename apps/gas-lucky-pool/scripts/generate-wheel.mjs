#!/usr/bin/env node
/**
 * generate-wheel.mjs — P3 asset pipeline (gas-lucky-pool)
 *
 * Renders a self-contained "lucky draw" wheel (12 vivid sectors + gold rim with
 * bulbs + center GAS hub + top pointer) as a transparent-background webp,
 * replacing the generic vault-stage photo as the hero so the game reads as a
 * real Lucky Draw. SVG -> sharp -> webp, mirroring sheep-solitaire's pipeline.
 *
 * Usage:  cd apps/gas-lucky-pool && node scripts/generate-wheel.mjs
 * Output: public/wheel.webp  (512x512, transparent bg)
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public");
mkdirSync(OUT, { recursive: true });

const SIZE = 512;
const cx = SIZE / 2;
const cy = SIZE / 2;
const R = 240; // wheel radius
const HUB = 46;
// 6-color cycle -> adjacent sectors always differ (classic lucky-wheel read)
// P3 polish pass: pushed ~20% brighter/more saturated so the draw reads as
// exciting rather than muted (was #f5b640/#d84d3f/#16a86b/#2bb6c4/#8b5cf6/#f5913a)
const SECTOR_COLORS = ["#ffc21a", "#ff3b2f", "#19d27a", "#16d0e0", "#a855f7", "#ff9d2e"];

const pt = (deg, r) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

// ── Sectors ───────────────────────────────────────────────────────
const N = 12;
let sectors = "";
for (let i = 0; i < N; i += 1) {
  const a0 = i * (360 / N);
  const a1 = (i + 1) * (360 / N);
  const [x0, y0] = pt(a0, R);
  const [x1, y1] = pt(a1, R);
  sectors += `<path d="M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 0 1 ${x1.toFixed(
    1,
  )},${y1.toFixed(1)} Z" fill="${SECTOR_COLORS[i % SECTOR_COLORS.length]}" stroke="#fff8e6" stroke-width="2.5"/>`;
  // tiny inner label pip for extra "prize slot" texture (brightened for small-size legibility)
  const [lx, ly] = pt(a0 + 15, R * 0.72);
  sectors += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="7.5" fill="#ffffff" opacity="0.72"/>`;
}

// ── Rim + bulbs ───────────────────────────────────────────────────
const rim = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#3a2a12" stroke-width="15"/>
             <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#b77915" stroke-width="6"/>`;

let bulbs = "";
for (let i = 0; i < 24; i += 1) {
  const [bx, by] = pt(i * 15, R + 9);
  bulbs += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="5.5" fill="${
    i % 2 ? "#fff3c4" : "#ffd36b"
  }" stroke="#b77915" stroke-width="1.5"/>`;
}

// ── Center hub ────────────────────────────────────────────────────
const hub = `<circle cx="${cx}" cy="${cy}" r="${HUB}" fill="#f5b640" stroke="#3a2a12" stroke-width="4"/>
             <circle cx="${cx}" cy="${cy}" r="${HUB - 8}" fill="#ffe9a8" stroke="#b77915" stroke-width="2"/>
             <text x="${cx}" y="${cy + 8}" font-family="Arial, Helvetica, sans-serif" font-size="27"
                   font-weight="700" fill="#7a4a12" text-anchor="middle">GAS</text>`;

// ── Pointer (top, points into wheel) ──────────────────────────────
const pointer = `<circle cx="${cx}" cy="15" r="10" fill="#d84d3f" stroke="#7a1f17" stroke-width="3"/>
                 <polygon points="${cx - 22},22 ${cx + 22},22 ${cx},62" fill="#d84d3f"
                          stroke="#7a1f17" stroke-width="3"/>`;

// ── Soft drop shadow ──────────────────────────────────────────────
const shadow = `<circle cx="${cx}" cy="${cy + 8}" r="${R}" fill="#000000" opacity="0.08"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  ${shadow}
  ${sectors}
  ${rim}
  ${bulbs}
  ${hub}
  ${pointer}
</svg>`;

await sharp(Buffer.from(svg)).webp({ quality: 92, alphaQuality: 100 }).toFile(join(OUT, "wheel.webp"));
console.log("  [WEBP] public/wheel.webp (lucky-draw wheel, 512x512, transparent)");
