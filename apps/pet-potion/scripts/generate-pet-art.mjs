#!/usr/bin/env node
/**
 * generate-pet-art.mjs — P3 asset pipeline (pet-potion)
 *
 * Renders the pet life-stage art (egg / baby / teen / adult) and a dedicated
 * potion-bottle asset, all cohesive Neo-mint critters. Overwrites the 4 pet
 * webps and adds potion-bottle.webp (wired into the scene via PET_ASSETS.potion).
 * SVG -> sharp -> webp (mirrors sheep-solitaire's pipeline).
 *
 * Usage:  cd apps/pet-potion && node scripts/generate-pet-art.mjs
 * Output: public/art/pet-egg.webp, pet-baby.webp, pet-teen.webp,
 *         pet-adult.webp, potion-bottle.webp  (256x256 each)
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public/art");
mkdirSync(OUT, { recursive: true });

const SIZE = 256;
const c = SIZE / 2;

const EYE = (x, y, r = 13) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#2a2117"/>
   <circle cx="${x - 4}" cy="${y - 4}" r="${r * 0.4}" fill="#ffffff"/>`;
const BLUSH = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="13" ry="8" fill="#ff9bb5" opacity="0.5"/>`;
const SMILE = (x, y, w = 22) =>
  `<path d="M${x - w / 2},${y} Q${x},${y + 12} ${x + w / 2},${y}" fill="none"
        stroke="#2a2117" stroke-width="3.5" stroke-linecap="round"/>`;

// ── Egg ───────────────────────────────────────────────────────────
const egg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <ellipse cx="${c}" cy="142" rx="80" ry="98" fill="#fff7e8" stroke="#e0c9a0" stroke-width="6"/>
  <ellipse cx="${c - 28}" cy="120" rx="14" ry="18" fill="#e7d2ad" opacity="0.7"/>
  <ellipse cx="${c + 34}" cy="150" rx="11" ry="15" fill="#e7d2ad" opacity="0.7"/>
  <ellipse cx="${c + 6}" cy="188" rx="9" ry="12" fill="#e7d2ad" opacity="0.7"/>
  <ellipse cx="${c - 20}" cy="170" rx="14" ry="9" fill="#ffffff" opacity="0.6"/>
</svg>`;

// ── Baby (small round mint blob) ──────────────────────────────────
const baby = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <ellipse cx="${c}" cy="${c + 10}" rx="78" ry="74" fill="#bff0d8" stroke="#16a86b" stroke-width="6"/>
  <ellipse cx="${c - 50}" cy="${c + 70}" rx="20" ry="14" fill="#bff0d8" stroke="#16a86b" stroke-width="4"/>
  <ellipse cx="${c + 50}" cy="${c + 70}" rx="20" ry="14" fill="#bff0d8" stroke="#16a86b" stroke-width="4"/>
  <ellipse cx="${c}" cy="${c + 4}" rx="60" ry="50" fill="#eafff4" opacity="0.5"/>
  ${EYE(c - 26, c - 6)}
  ${EYE(c + 26, c - 6)}
  ${BLUSH(c - 46, c + 18)}
  ${BLUSH(c + 46, c + 18)}
  ${SMILE(c, c + 24)}
  <ellipse cx="${c - 26}" cy="${c - 30}" rx="18" ry="11" fill="#ffffff" opacity="0.5"/>
</svg>`;

// ── Teen (bigger, with little ears) ───────────────────────────────
const teen = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <polygon points="${c - 64},${c - 52} ${c - 30},${c - 60} ${c - 40},${c - 14}" fill="#9fe6c6" stroke="#16a86b" stroke-width="4"/>
  <polygon points="${c + 64},${c - 52} ${c + 30},${c - 60} ${c + 40},${c - 14}" fill="#9fe6c6" stroke="#16a86b" stroke-width="4"/>
  <ellipse cx="${c}" cy="${c + 18}" rx="86" ry="80" fill="#9fe6c6" stroke="#16a86b" stroke-width="6"/>
  <ellipse cx="${c}" cy="${c + 14}" rx="66" ry="54" fill="#eafff4" opacity="0.45"/>
  ${EYE(c - 30, c + 4)}
  ${EYE(c + 30, c + 4)}
  ${BLUSH(c - 52, c + 30)}
  ${BLUSH(c + 52, c + 30)}
  ${SMILE(c, c + 36, 26)}
</svg>`;

// ── Adult (full critter + crown + gem) ────────────────────────────
const adult = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <polygon points="${c - 40},${c - 78} ${c - 40},${c - 104} ${c - 20},${c - 88} ${c},${c - 110}
               ${c + 20},${c - 88} ${c + 40},${c - 104} ${c + 40},${c - 78}"
           fill="#f5b640" stroke="#b77915" stroke-width="4"/>
  <ellipse cx="${c}" cy="${c + 26}" rx="92" ry="84" fill="#16C784" stroke="#0e9e68" stroke-width="6"/>
  <ellipse cx="${c}" cy="${c + 22}" rx="70" ry="56" fill="#d8ffe9" opacity="0.45"/>
  ${EYE(c - 32, c + 12, 15)}
  ${EYE(c + 32, c + 12, 15)}
  ${BLUSH(c - 56, c + 40)}
  ${BLUSH(c + 56, c + 40)}
  ${SMILE(c, c + 46, 28)}
  <polygon points="${c},${c + 64} ${c + 14},${c + 80} ${c},${c + 96} ${c - 14},${c + 80}"
           fill="#8b5cf6" stroke="#5a3aa6" stroke-width="3"/>
</svg>`;

// ── Potion bottle ─────────────────────────────────────────────────
const potion = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <defs>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c98bff"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <!-- cork -->
  <rect x="${c - 20}" y="40" width="40" height="26" rx="7" fill="#b07a45" stroke="#7a5230" stroke-width="3"/>
  <rect x="${c - 14}" y="60" width="28" height="16" rx="5" fill="#c98b45" stroke="#7a5230" stroke-width="2"/>
  <!-- neck -->
  <rect x="${c - 16}" y="74" width="32" height="40" rx="6" fill="#eafff4" stroke="#bfe9d6" stroke-width="3"/>
  <!-- flask body -->
  <circle cx="${c}" cy="168" r="74" fill="#eafff4" stroke="#bfe9d6" stroke-width="4"/>
  <circle cx="${c}" cy="168" r="66" fill="url(#liquid)"/>
  <!-- liquid highlights -->
  <ellipse cx="${c - 24}" cy="150" rx="16" ry="10" fill="#ffffff" opacity="0.45"/>
  <circle cx="${c + 30}" cy="186" r="7" fill="#ffffff" opacity="0.6"/>
  <circle cx="${c - 6}" cy="200" r="5" fill="#ffffff" opacity="0.5"/>
  <!-- rim shine -->
  <path d="M${c - 50},${c + 40} A74,74 0 0 1 ${c - 10},${c - 26}" fill="none"
        stroke="#ffffff" stroke-width="5" opacity="0.4" stroke-linecap="round"/>
  <!-- star badge -->
  <polygon points="${c},${c + 110} ${c + 7},${c + 121} ${c + 19},${c + 121} ${c + 9},${c + 129}
             ${c + 13},${c + 141} ${c},${c + 133} ${c - 13},${c + 141} ${c - 9},${c + 129}
             ${c - 19},${c + 121} ${c - 7},${c + 121}"
           fill="#f5b640" stroke="#b77915" stroke-width="2"/>
</svg>`;

const files = {
  "pet-egg.webp": egg,
  "pet-baby.webp": baby,
  "pet-teen.webp": teen,
  "pet-adult.webp": adult,
  "potion-bottle.webp": potion,
};

for (const [name, svg] of Object.entries(files)) {
  await sharp(Buffer.from(svg)).webp({ quality: 92, alphaQuality: 100 }).toFile(join(OUT, name));
  console.log(`  [WEBP] public/art/${name}`);
}
