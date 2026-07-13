#!/usr/bin/env node
/**
 * generate-card-back.mjs — P3 asset pipeline (on-chain-tarot)
 *
 * Renders a mystical purple-gold tarot card back (matching the existing
 * 825x1425 portrait aspect of public/cards/back.webp) and overwrites it.
 * NOTE: running the repo's generate-neo-tarot-deck.mjs would re-stamp the
 * back from scripts/assets/neo-tarot-card-back.png and clobber this file —
 * re-run THIS script after any deck regeneration.
 * SVG -> sharp -> webp (mirrors sheep-solitaire's pipeline).
 *
 * Usage:  cd apps/on-chain-tarot && node scripts/generate-card-back.mjs
 * Output: public/cards/back.webp (825x1425)
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public/cards");
mkdirSync(OUT, { recursive: true });

const W = 825;
const H = 1425;
const cx = W / 2;
const cy = H / 2;

// corner diamond ornaments
let corners = "";
const cornerPts = [
  [70, 70],
  [W - 70, 70],
  [70, H - 70],
  [W - 70, H - 70],
];
for (const [x, y] of cornerPts) {
  corners += `<polygon points="${x},${y - 26} ${x + 26},${y} ${x},${y + 26} ${x - 26},${y}"
                fill="#dca84a" stroke="#7a5a1e" stroke-width="2"/>
             <circle cx="${x}" cy="${y}" r="6" fill="#2a1a4a"/>`;
}

// scattered small stars in the field
let stars = "";
const starPts = [
  [200, 360],
  [625, 340],
  [170, 760],
  [655, 780],
  [210, 1140],
  [615, 1160],
  [cx, 250],
];
for (const [x, y] of starPts) {
  stars += `<polygon points="${x},${y - 13} ${x + 4},${y - 4} ${x + 13},${y} ${x + 4},${y + 4}
             ${x},${y + 13} ${x - 4},${y + 4} ${x - 13},${y} ${x - 4},${y - 4}"
             fill="#dca84a" opacity="0.55"/>`;
}

// central 8-point star emblem
function star8(x, y, rOut, rIn, color) {
  const pts = [];
  for (let i = 0; i < 16; i += 1) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (i * 22.5 - 90) * (Math.PI / 180);
    pts.push(`${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${color}" stroke="#7a5a1e" stroke-width="3"/>`;
}

const emblem = `
  <circle cx="${cx}" cy="${cy}" r="150" fill="none" stroke="#dca84a" stroke-width="4" opacity="0.85"/>
  <circle cx="${cx}" cy="${cy}" r="128" fill="#1d1138" stroke="#dca84a" stroke-width="2"/>
  ${star8(cx, cy, 120, 52, "#dca84a")}
  ${star8(cx, cy, 64, 28, "#f3d98a")}
  <circle cx="${cx}" cy="${cy}" r="16" fill="#2a1a4a" stroke="#dca84a" stroke-width="2"/>
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a2566"/>
      <stop offset="0.5" stop-color="#2a1a4a"/>
      <stop offset="1" stop-color="#1d1138"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- double gold frame -->
  <rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="30" fill="none"
        stroke="#dca84a" stroke-width="11"/>
  <rect x="52" y="52" width="${W - 104}" height="${H - 104}" rx="22" fill="none"
        stroke="#dca84a" stroke-width="3" opacity="0.7"/>
  ${corners}
  ${stars}
  ${emblem}
  <text x="${cx}" y="${H - 120}" font-family="Georgia, 'Times New Roman', serif" font-size="34"
        letter-spacing="8" fill="#dca84a" text-anchor="middle" opacity="0.85">NEO TAROT</text>
</svg>`;

await sharp(Buffer.from(svg)).webp({ quality: 92, alphaQuality: 100 }).toFile(join(OUT, "back.webp"));
console.log("  [WEBP] public/cards/back.webp (mystical purple-gold tarot back, 825x1425)");
