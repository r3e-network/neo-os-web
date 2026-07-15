#!/usr/bin/env node
/**
 * generate-machine.mjs — P3 asset pipeline (gasbox)
 *
 * Renders the two gachapon cutouts the React layer imports:
 *   1. gasbox-capsule-machine-cutout.webp — transparent dome machine w/ capsules
 *   2. gasbox-prize-capsule-cutout.webp   — a few colorful gachapon capsules
 * Replaces the generic cutouts so the game reads as a real Gachapon machine.
 * SVG -> sharp -> webp (mirrors sheep-solitaire's pipeline).
 *
 * Usage:  cd apps/gasbox && node scripts/generate-machine.mjs
 * Output: src/gasbox-capsule-machine-cutout.webp, src/gasbox-prize-capsule-cutout.webp
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../src"); // scripts/ is sibling of src/
mkdirSync(OUT, { recursive: true });

const CAP_COLORS = ["#16C784", "#2bb6c4", "#f5913a", "#d84d3f", "#8b5cf6", "#3b82f6", "#f5b640", "#ef6f9b"];
const rnd = (seed) => {
  // tiny deterministic PRNG so the layout is stable across runs
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
};

function capsule(cx, cy, r, color) {
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="#00000022" stroke-width="2"/>
    <path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy} Z" fill="#ffffff" opacity="0.82"/>
    <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="#00000022" stroke-width="2.5"/>
    <ellipse cx="${cx - r * 0.32}" cy="${cy - r * 0.34}" rx="${r * 0.26}" ry="${r * 0.18}"
             fill="#ffffff" opacity="0.65"/>`;
}

// Long (two-tone) capsule used for the prize cutout — reads as a real gachapon
// capsule rather than a round candy ball.
function pillCapsule(cx, cy, rx, ry, color) {
  return `
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" stroke="#00000022" stroke-width="2.5"/>
    <path d="M${cx - rx},${cy} A${rx},${ry} 0 0 1 ${cx + rx},${cy} Z" fill="#ffffff" opacity="0.8"/>
    <line x1="${cx - rx}" y1="${cy}" x2="${cx + rx}" y2="${cy}" stroke="#00000022" stroke-width="3"/>
    <ellipse cx="${cx - rx * 0.3}" cy="${cy - ry * 0.45}" rx="${rx * 0.28}" ry="${ry * 0.18}"
             fill="#ffffff" opacity="0.7"/>`;
}

// ── Machine cutout (480 x 560, transparent) ───────────────────────
const MW = 480;
const MH = 560;
const domeCx = 240;
const domeCy = 168;
const domeR = 132;
const rand = rnd(7);
let domeCapsules = "";
for (let i = 0; i < 13; i += 1) {
  const ang = rand() * Math.PI * 2;
  const rad = 24 + rand() * (domeR - 46);
  const ccx = domeCx + Math.cos(ang) * rad;
  const ccy = domeCy + Math.sin(ang) * rad;
  const col = CAP_COLORS[Math.floor(rand() * CAP_COLORS.length)];
  domeCapsules += capsule(ccx.toFixed(1), ccy.toFixed(1), 17, col);
}

const machineSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MW} ${MH}" width="${MW}" height="${MH}">
  <defs>
    <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f2fff9"/>
      <stop offset="1" stop-color="#cdeed8"/>
    </linearGradient>
  </defs>
  <ellipse cx="240" cy="544" rx="150" ry="16" fill="#000000" opacity="0.14"/>
  <!-- depth shadow behind body (offset down-right, green-tinted) -->
  <rect x="80" y="182" width="340" height="352" rx="30" fill="#0e9e68" opacity="0.3"/>
  <!-- body -->
  <rect x="70" y="172" width="340" height="352" rx="30" fill="url(#bodyGrad)" stroke="#16C784" stroke-width="6"/>
  <!-- soft left highlight for a glassy edge -->
  <rect x="84" y="186" width="34" height="324" rx="17" fill="#ffffff" opacity="0.4"/>
  <rect x="94" y="306" width="292" height="196" rx="18" fill="#f5fffa" stroke="#bfe9d6" stroke-width="3"/>
  <!-- glass dome -->
  <circle cx="${domeCx}" cy="${domeCy}" r="${domeR}" fill="#cdeef7" opacity="0.5" stroke="#9fd6e6" stroke-width="5"/>
  ${domeCapsules}
  <circle cx="${domeCx}" cy="${domeCy}" r="${domeR}" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.5"/>
  <!-- dome top cap -->
  <rect x="208" y="28" width="64" height="22" rx="10" fill="#16C784"/>
  <!-- coin slot -->
  <rect x="210" y="326" width="60" height="11" rx="5" fill="#16C784"/>
  <!-- turn knob -->
  <circle cx="240" cy="372" r="28" fill="#16C784" stroke="#0e9e68" stroke-width="4"/>
  <circle cx="240" cy="372" r="11" fill="#0e9e68"/>
  <!-- dispenser tray -->
  <rect x="168" y="500" width="144" height="42" rx="13" fill="#0e9e68"/>
  <rect x="186" y="509" width="108" height="24" rx="9" fill="#063d2a"/>
</svg>`;

// ── Prize capsule cutout (220 x 220, transparent) ─────────────────
const CW = 220;
let prizeCapsules = "";
// long two-tone capsules (real gachapon look), not round candy balls
prizeCapsules += pillCapsule(74, 96, 62, 44, CAP_COLORS[0]);
prizeCapsules += pillCapsule(150, 86, 54, 38, CAP_COLORS[3]);
prizeCapsules += pillCapsule(112, 154, 66, 46, CAP_COLORS[4]);

const prizeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CW}" width="${CW}" height="${CW}">
  ${prizeCapsules}
</svg>`;

await sharp(Buffer.from(machineSvg)).resize(MW, MH).webp({ quality: 92, alphaQuality: 100 }).toFile(
  join(OUT, "gasbox-capsule-machine-cutout.webp"),
);
await sharp(Buffer.from(prizeSvg)).resize(CW, CW).webp({ quality: 92, alphaQuality: 100 }).toFile(
  join(OUT, "gasbox-prize-capsule-cutout.webp"),
);
console.log("  [WEBP] src/gasbox-capsule-machine-cutout.webp");
console.log("  [WEBP] src/gasbox-prize-capsule-cutout.webp");
