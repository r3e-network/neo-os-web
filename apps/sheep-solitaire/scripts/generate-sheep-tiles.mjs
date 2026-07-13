#!/usr/bin/env node
/**
 * generate-sheep-tiles.mjs
 *
 * Generates 15 sheep-themed tile SVGs (with shared card-frame template) and
 * rasterizes them to webp via sharp. Replaces the generic fruit/object grab-bag
 * with a cohesive "sheep's meadow farm" icon set.
 *
 * Usage:   cd apps/sheep-solitaire && node scripts/generate-sheep-tiles.mjs
 * Output:  public/art/tile-00-{name}.webp … tile-14-{name}.webp
 * Sources: public/art/src-svg/ (keeps original SVGs for future editing)
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Config ──────────────────────────────────────────────────────

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "../public/art/src-svg");
const WEBP_DIR = join(dirname(fileURLToPath(import.meta.url)), "../public/art");
const SIZE = 200; // output px (displayed at 54px → ~3.7× crisp)

// ─── Palette (cohesive warm meadow + Neo green brand) ─────────────

const C = {
  // Card frame (matches existing tile style)
  cardBg:      "#F5EDD9",
  cardBorder:  "#D4B88E",
  gemFill:     "#16C784", // Neo green — corner gems
  gemStroke:   "#0E9E68",
  // Icon ink & base tones
  ink:         "#3A3530",    // warm dark outline / fill
  wool:        "#F8F2E6",    // cream-white wool
  woolDark:    "#E5D7C1",    // wool shadow
  pink:        "#FFB5BA",    // inner ear / nose / cheek
  skin:        "#F4E1CE",    // face skin
  // Themed fills
  gold:        "#F6C453",
  goldDark:    "#D4A033",
  orange:      "#FF8A4C",
  orangeDark:  "#E06A28",
  leafGreen:   "#4CA86A",
  grassGreen:  "#7CC47F",
  sunYellow:   "#FFD36B",
  skyBlue:     "#C5E8F4",
  heartRed:    "#FF6F7D",
  woodBrown:   "#A67B5B",
  woodDark:    "#7D5A3E",
  milkWhite:   "#FFFFFF",
  milkCap:     "#16C784", // Neo green bottle cap
  wingTeal:    "#16C784",
  wingYellow:  "#FFD36B",
};

// ─── Shared card frame (cream bg + tan border + 4 green gems) ────
function cardFrame() {
  const r = 22; // corner radius (proportional to SIZE)
  const pad = 6;
  const g = 14; // gem size (diamond half-diagonal)
  const cx = SIZE;
  const cy = SIZE;

  return `
    <!-- Card background -->
    <rect x="${pad}" y="${pad}" width="${cx - 2*pad}" height="${cy - 2*pad}"
          rx="${r}" ry="${r}" fill="${C.cardBg}" stroke="${C.cardBorder}"
          stroke-width="${SIZE * 0.018}" />
    <!-- Corner gems – green diamonds -->
    <polygon points="${pad+g+2},${pad+4} ${pad+g+10},${pad-2} ${pad+g+18},${pad+4} ${pad+g+10},${pad+12}"
             fill="${C.gemFill}" stroke="${C.gemStroke}" stroke-width="1" />
    <polygon points="${cx-pad-g-18},${pad+4} ${cx-pad-g-10},${pad-2} ${cx-pad-g-2},${pad+4} ${cx-pad-g-10},${pad+12}"
             fill="${C.gemFill}" stroke="${C.gemStroke}" stroke-width="1" />
    <polygon points="${pad+g+2},${cy-pad-4} ${pad+g+10},${cy-pad+12} ${pad+g+18},${cy-pad-4} ${pad+g+10},${cy-pad-12}"
             fill="${C.gemFill}" stroke="${C.gemStroke}" stroke-width="1" />
    <polygon points="${cx-pad-g-18},${cy-pad-4} ${cx-pad-g-10},${cy-pad+12} ${cx-pad-g-2},${cy-pad-4} ${cx-pad-g-10},${cy-pad-12}"
             fill="${C.gemFill}" stroke="${C.gemStroke}" stroke-width="1" />
  `;
}

// ─── Helpers for icon drawing ────────────────────────────────────
const cx = SIZE / 2; // center X
const cy = SIZE / 2; // center Y

/** Simple circle */
function circ(x, y, r, fill, sw = 0, sc = null) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"
           ${sw ? `stroke="${sc || C.ink}" stroke-width="${sw}"` : ""} />`;
}

/** Ellipse */
function ell(x, y, rx, ry, fill, sw = 0, sc = null) {
  return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"
            ${sw ? `stroke="${sc || C.ink}" stroke-width="${sw}"` : ""} />`;
}

/** Rounded rect */
function rect(x, y, w, h, r, fill, sw = 0, sc = null) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}"
            ${sw ? `stroke="${sc || C.ink}" stroke-width="${sw}"` : ""} />`;
}

/** Raw path */
function path(d, fill, sw = 0, sc = null) {
  return `<path d="${d}" fill="${fill}"
            ${sw ? `stroke="${sc || C.ink}" stroke-width="${sw}"` : ""} />`;
}

/** Polygon */
function poly(points, fill, sw = 0, sc = null) {
  return `<polygon points="${points}" fill="${fill}"
             ${sw ? `stroke="${sc || C.ink}" stroke-width="${sw}"` : ""} />`;
}

// ─── 15 ICON GENERATORS ──────────────────────────────────────────
// Each returns an SVG <g> string centered in a 200x200 viewBox.
// Icons should occupy roughly a 120×120–140×140 area centered at (100,100).

function iconSheepFace() {
  const s = 42; // head radius
  return `
    <!-- Wool fluff (head shape) -->
    ${circ(cx, cy + 2, s, C.wool, 3, C.ink)}
    <!-- Ears -->
    ${ell(cx - s + 6, cy - s + 10, 16, 24, C.wool, 2.5, C.ink)}
    ${ell(cx + s - 6, cy - s + 10, 16, 24, C.wool, 2.5, C.ink)}
    ${ell(cx - s + 6, cy - s + 11, 9, 16, C.pink, 0)}
    ${ell(cx + s - 6, cy - s + 11, 9, 16, C.pink, 0)}
    <!-- Face area -->
    ${ell(cx, cy + 6, 28, 26, C.skin, 2, C.ink)}
    <!-- Eyes -->
    ${circ(cx - 12, cy - 2, 4.5, C.ink, 0)}
    ${circ(cx + 12, cy - 2, 4.5, C.ink, 0)}
    ${circ(cx - 13, cy - 3, 1.5, C.milkWhite, 0)}
    ${circ(cx + 11, cy - 3, 1.5, C.milkWhite, 0)}
    <!-- Nose/mouth -->
    ${ell(cx, cy + 10, 8, 5.5, C.pink, 1.5, C.ink)}
    <!-- Wool tuft top -->
    ${circ(cx - 20, cy - 30, 13, C.wool, 2, C.ink)}
    ${circ(cx + 20, cy - 30, 13, C.wool, 2, C.ink)}
    ${circ(cx, cy - 38, 15, C.wool, 2, C.ink)}
    <!-- Cheek blush -->
    <ellipse cx="${cx - 28}" cy="${cy + 8}" rx="9" ry="6" fill="${C.pink}" opacity="0.45" />
    <ellipse cx="${cx + 28}" cy="${cy + 8}" rx="9" ry="6" fill="${C.pink}" opacity="0.45" />
  `;
}

function iconLamb() {
  const s = 38;
  return `
    <!-- Body/head (more rounded than sheep) -->
    ${ell(cx, cy + 6, s, s + 4, C.wool, 3, C.ink)}
    <!-- Ears (smaller, rounder) -->
    ${ell(cx - s + 2, cy - s + 16, 12, 18, C.wool, 2.5, C.ink)}
    ${ell(cx + s - 2, cy - s + 16, 12, 18, C.wool, 2.5, C.ink)}
    ${ell(cx - s + 2, cy - s + 17, 6.5, 13, C.pink, 0)}
    ${ell(cx + s - 2, cy - s + 17, 6.5, 13, C.pink, 0)}
    <!-- Face (larger relative to head = baby look) -->
    ${ell(cx, cy + 8, 30, 28, C.skin, 2, C.ink)}
    <!-- Big cute eyes -->
    ${circ(cx - 11, cy, 6, C.ink, 0)}
    ${circ(cx + 11, cy, 6, C.ink, 0)}
    ${circ(cx - 12, cy - 1, 2, C.milkWhite, 0)}
    ${circ(cx + 10, cy - 1, 2, C.milkWhite, 0)}
    <!-- Tiny nose -->
    ${circ(cx, cy + 12, 4, C.pink, 1.5, C.ink)}
    <!-- Small smile curve -->
    <path d="M${cx-6},${cy+17} Q${cx},${cy+23} ${cx+6},${cy+17}" fill="none"
          stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>
    <!-- Fluffy wool top tufts -->
    ${circ(cx - 18, cy - 32, 11, C.wool, 2, C.ink)}
    ${circ(cx + 18, cy - 32, 11, C.wool, 2, C.ink)}
    ${circ(cx, cy - 40, 13, C.wool, 2, C.ink)}
    ${circ(cx - 8, cy - 25, 9, C.wool, 1.5, C.ink)}
    ${circ(cx + 8, cy - 25, 9, C.wool, 1.5, C.ink)}
    <!-- Big blush -->
    <ellipse cx="${cx - 26}" cy="${cy + 12}" rx="10" ry="7" fill="${C.pink}" opacity="0.4" />
    <ellipse cx="${cx + 26}" cy="${cy + 12}" rx="10" ry="7" fill="${C.pink}" opacity="0.4" />
  `;
}

function iconWoolBall() {
  const r = 40;
  return `
    <!-- Yarn ball body -->
    ${circ(cx, cy + 2, r, C.wool, 3, C.ink)}
    <!-- Wrapped yarn lines (latitude curves) -->
    <ellipse cx="${cx}" cy="${cy - 18}" rx="${r - 4}" ry="10" fill="none"
              stroke="${C.woolDark}" stroke-width="2.5" opacity="0.55"/>
    <ellipse cx="${cx}" cy="${cy - 4}" rx="${r - 1}" ry="12" fill="none"
              stroke="${C.woolDark}" stroke-width="2.5" opacity="0.5"/>
    <ellipse cx="${cx}" cy="${cy + 14}" rx="${r - 4}" ry="9" fill="none"
              stroke="${C.woolDark}" stroke-width="2.5" opacity="0.45"/>
    <!-- Highlight -->
    <ellipse cx="${cx - 14}" cy="${cy - 14}" rx="12" ry="8" fill="#FFFFFF" opacity="0.35"/>
    <!-- Tail end sticking out -->
    <path d="M${cx + r - 4},${cy + 6} Q${cx + r + 18},${cy - 4} ${cx + r + 12},${cy + 18}"
          fill="none" stroke="${C.wool}" stroke-width="6" stroke-linecap="round"/>
    <path d="M${cx + r - 4},${cy + 6} Q${cx + r + 18},${cy - 4} ${cx + r + 12},${cy + 18}"
          fill="none" stroke="${C.ink}" stroke-width="2.5" stroke-linecap="round" opacity="0.4"/>
  `;
}

function iconBellCollar() {
  return `
    <!-- Bell dome -->
    <path d="M${cx - 34},${cy + 20}
             Q${cx - 34},${cy - 28} ${cx},${cy - 36}
             Q${cx + 34},${cy - 28} ${cx + 34},${cy + 20}
             Z"
          fill="${C.gold}" stroke="${C.ink}" stroke-width="2.5"/>
    <!-- Bell flare bottom -->
    <ellipse cx="${cx}" cy="${cy + 21}" rx="35" ry="9"
             fill="${C.gold}" stroke="${C.ink}" stroke-width="2.5"/>
    <!-- Bell rim line -->
    <ellipse cx="${cx}" cy="${cy + 19}" rx="33" ry="7" fill="none"
              stroke="${C.goldDark}" stroke-width="1.5"/>
    <!-- Clapper -->
    <circle cx="${cx}" cy="${cy + 28}" r="7" fill="${C.goldDark}" stroke="${C.ink}" stroke-width="1.5"/>
    <!-- Handle ring -->
    <circle cx="${cx}" cy="${cy - 40}" r="7" fill="none" stroke="${C.goldDark}" stroke-width="3"/>
    <!-- Collar band below bell -->
    <rect x="${cx - 28}" y="${cy + 38}" width="56" height="10" rx="3"
          fill="${C.leafGreen}" stroke="${C.ink}" stroke-width="2"/>
    <!-- Collar studs -->
    ${circ(cx - 14, cy + 43, 2.5, C.gold, 0)}
    ${circ(cx + 14, cy + 43, 2.5, C.gold, 0)}
    <!-- Highlight on bell -->
    <path d="M${cx - 24},${cy - 18} Q${cx - 14},${cy - 30} ${cx - 4},${cy - 18}"
          fill="none" stroke="#FFF8E0" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
  `;
}

function iconHoofPrint() {
  return `
    <!-- Main pad (bottom) -->
    <path d="M${cx - 22},${cy + 18}
             Q${cx - 26},${cy + 36} ${cx - 12},${cy + 38}
             L${cx + 12},${cy + 38}
             Q${cx + 26},${cy + 36} ${cx + 22},${cy + 18}
             Z"
          fill="${C.woodBrown}" stroke="${C.ink}" stroke-width="2.5"/>
    <!-- Left toe -->
    <ellipse cx="${cx - 16}" cy="${cy + 6}" rx="12" ry="18"
             fill="${C.woodBrown}" stroke="${C.ink}" stroke-width="2.5"
             transform="rotate(-12,${cx - 16},${cy + 6})"/>
    <!-- Right toe -->
    <ellipse cx="${cx + 16}" cy="${cy + 6}" rx="12" ry="18"
             fill="${C.woodBrown}" stroke="${C.ink}" stroke-width="2.5"
             transform="rotate(12,${cx + 16},${cy + 6})"/>
    <!-- Toe cleft line -->
    <line x1="${cx}" y1="${cy + 14}" x2="${cx}" y2="${cy + 34}"
          stroke="${C.woodDark}" stroke-width="2" stroke-linecap="round"/>
    <!-- Pad highlight -->
    <ellipse cx="${cx}" cy="${cy + 29}" rx="8" ry="4" fill="${C.woodDark}" opacity="0.3"/>
  `;
}

function iconCarrot() {
  return `
    <!-- Carrot body (diagonal) -->
    <path d="M${cx - 6},${cy + 34}
             Q${cx - 20},${cy + 10} ${cx + 4},${cy - 30}
             Q${cx + 14},${cy - 34} ${cx + 10},${cy - 24}
             Q${cx - 4},${cy + 18} ${cx + 6},${cy + 34}
             Z"
          fill="${C.orange}" stroke="${C.ink}" stroke-width="2.5"/>
    <!-- Carrot texture lines -->
    <line x1="${cx - 8}" y1="${cy + 18}" x2="${cx - 2}" y2="${cy + 22}"
          stroke="${C.orangeDark}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <line x1="${cx - 4}" y1="${cy + 6}" x2="${cx + 2}" y2="${cy + 10}"
          stroke="${C.orangeDark}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <line x1="${cx + 2}" y1="${cy - 8}" x2="${cx + 6}" y2="${cy - 4}"
          stroke="${C.orangeDark}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <!-- Leafy top -->
    <path d="M${cx + 4},${cy - 30} Q${cx - 8},${cy - 48} ${cx - 16},${cy - 44}"
          fill="${C.leafGreen}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M${cx + 6},${cy - 30} Q${cx + 4},${cy - 52} ${cx + 2},${cy - 50}"
          fill="${C.grassGreen}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M${cx + 8},${cy - 27} Q${cx + 20},${cy - 46} ${cx + 24},${cy - 38}"
          fill="${C.leafGreen}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>
    <!-- Highlight -->
    <path d="M${cx - 2},${cy + 20} Q${cx + 2},${cy + 8} ${cx + 6},${cy - 6}"
          fill="none" stroke="#FFAA70" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
  `;
}

function iconClover() {
  return `
    <!-- Four leaves (heart-shaped) -->
    <path d="M${cx},${cy - 6}
             C${cx - 2},${cy - 22} ${cx - 24},${cy - 20} ${cx - 20},${cy - 4}
             C${cx - 16},${cy + 4} ${cx - 6},${cy - 2} ${cx},${cy - 6}
             Z"
          fill="${C.leafGreen}" stroke="${C.ink}" stroke-width="2"/>
    <path d="M${cx},${cy - 6}
             C${cx + 2},${cy - 22} ${cx + 24},${cy - 20} ${cx + 20},${cy - 4}
             C${cx + 16},${cy + 4} ${cx + 6},${cy - 2} ${cx},${cy - 6}
             Z"
          fill="${C.grassGreen}" stroke="${C.ink}" stroke-width="2"/>
    <path d="M${cx - 6},${cy}
             C${cx - 22},${cy - 2} ${cx - 20},${cy + 20} ${cx - 4},${cy + 16}
             C${cx + 4},${cy + 12} ${cx - 2},${cy + 2} ${cx - 6},${cy}
             Z"
          fill="${C.grassGreen}" stroke="${C.ink}" stroke-width="2"/>
    <path d="M${cx + 6},${cy}
             C${cx + 22},${cy - 2} ${cx + 20},${cy + 20} ${cx + 4},${cy + 16}
             C${cx - 4},${cy + 12} ${cx + 2},${cy + 2} ${cx + 6},${cy}
             Z"
          fill="${C.leafGreen}" stroke="${C.ink}" stroke-width="2"/>
    <!-- Stem -->
    <line x1="${cx}" y1="${cy + 10}" x2="${cx}" y2="${cy + 36}"
          stroke="${C.leafGreen}" stroke-width="2.5" stroke-linecap="round"/>
  `;
}

function iconFlower() {
  return `
    <!-- Petals (8 around center) -->
    ${[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
      const rad = a * Math.PI / 180;
      const px = cx + Math.cos(rad) * 26;
      const py = cy + Math.sin(rad) * 26;
      return `<ellipse cx="${px}" cy="${py}" rx="14" ry="20"
                fill="${C.milkWhite}" stroke="${C.ink}" stroke-width="1.8"
                transform="rotate(${a},${px},${py})"/>`;
    }).join('\n    ')}
    <!-- Center disc -->
    ${circ(cx, cy, 14, C.sunYellow, 2, C.ink)}
    <!-- Center dots -->
    ${circ(cx - 4, cy - 3, 2, C.orange, 0)}
    ${circ(cx + 4, cy + 2, 2, C.orange, 0)}
    ${circ(cx - 1, cy + 5, 1.5, C.orange, 0)}
    <!-- Stem -->
    <line x1="${cx}" y1="${cy + 28}" x2="${cx}" y2="${cy + 44}"
          stroke="${C.leafGreen}" stroke-width="2.5" stroke-linecap="round"/>
    <!-- Small leaves -->
    <path d="M${cx},${cy + 36} Q${cx - 12},${cy + 32} ${cx - 10},${cy + 42}"
          fill="${C.leafGreen}" stroke="${C.ink}" stroke-width="1.2"/>
    <path d="M${cx},${cy + 38} Q${cx + 12},${cy + 34} ${cx + 10},${cy + 44}"
          fill="${C.leafGreen}" stroke="${C.ink}" stroke-width="1.2"/>
  `;
}

function iconMilkBottle() {
  return `
    <!-- Bottle body -->
    <rect x="${cx - 22}" y="${cy - 10}" width="44" height="48" rx="6"
          fill="${C.milkWhite}" stroke="${C.ink}" stroke-width="2.5"/>
    <!-- Bottle neck -->
    <rect x="${cx - 12}" y="${cy - 24}" width="24" height="16" rx="3"
          fill="${C.milkWhite}" stroke="${C.ink}" stroke-width="2.5"/>
    <!-- Bottle cap -->
    <rect x="${cx - 14}" y="${cy - 32}" width="28" height="10" rx="4"
          fill="${C.milkCap}" stroke="${C.ink}" stroke-width="2"/>
    <!-- Cap detail lines -->
    <line x1="${cx - 8}" y1="${cy - 27}" x2="${cx + 8}" y2="${cy - 27}"
          stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
    <!-- Milk label area -->
    <rect x="${cx - 16}" y="${cy}" width="32" height="24" rx="3"
          fill="#F0F6FF" stroke="${C.skyBlue}" stroke-width="1.2"/>
    <!-- Milk drop icon on label -->
    <path d="M${cx},${cy + 5} Q${cx - 7},${cy + 16} ${cx},${cy + 20} Q${cx + 7},${cy + 16} ${cx},${cy + 5} Z"
          fill="${C.skyBlue}" opacity="0.7"/>
    <!-- Bottle shine -->
    <rect x="${cx - 17}" y="${cy - 6}" width="5" height="40" rx="2.5"
          fill="#FFFFFF" opacity="0.35"/>
  `;
}

function iconFence() {
  return `
    <!-- Vertical slats -->
    ${rect(cx - 28, cy - 26, 10, 52, 2, C.woodBrown, 2, C.ink)}
    ${rect(cx - 9,  cy - 26, 10, 52, 2, C.woodBrown, 2, C.ink)}
    ${rect(cx + 9,  cy - 26, 10, 52, 2, C.woodBrown, 2, C.ink)}
    ${rect(cx + 28, cy - 26, 10, 52, 2, C.woodBrown, 2, C.ink)}
    <!-- Horizontal rails -->
    ${rect(cx - 32, cy - 10, 64, 7, 2, C.woodDark, 1.5, C.ink)}
    ${rect(cx - 32, cy + 16, 64, 7, 2, C.woodDark, 1.5, C.ink)}
    <!-- Nail heads -->
    ${circ(cx - 28, cy - 7, 2, C.goldDark, 0)}
    ${circ(cx - 28, cy + 19, 2, C.goldDark, 0)}
    ${circ(cx + 28, cy - 7, 2, C.goldDark, 0)}
    ${circ(cx + 28, cy + 19, 2, C.goldDark, 0)}
    <!-- Ground shadow -->
    <rect x="${cx - 32}" y="${cy + 28}" width="64" height="4" rx="2"
          fill="${C.woodDark}" opacity="0.2"/>
  `;
}

function iconSun() {
  return `
    <!-- Sun body -->
    ${circ(cx, cy, 32, C.sunYellow, 2.5, C.ink)}
    <!-- Rays (12 alternating lengths) -->
    ${Array.from({length: 12}, (_, i) => {
      const a = i * 30 * Math.PI / 180;
      const len = i % 2 === 0 ? 14 : 9;
      const r1 = 36, r2 = r1 + len;
      return `<line x1="${cx + Math.cos(a)*r1}" y1="${cy + Math.sin(a)*r1}"
                    x2="${cx + Math.cos(a)*r2}" y2="${cy + Math.sin(a)*r2}"
                    stroke="${C.sunYellow}" stroke-width="${i%2?3:4}"
                    stroke-linecap="round"/>`;
    }).join('\n    ')}
    <!-- Ray outer dots (on long rays) -->
    ${[0,2,4,6,8,10].map(i => {
      const a = i * 30 * Math.PI / 180;
      const r = 52;
      return `<circle cx="${cx + Math.cos(a)*r}" cy="${cy + Math.sin(a)*r}" r="2.5"
                fill="${C.sunYellow}" stroke="${C.ink}" stroke-width="1"/>`;
    }).join('\n    ')}
    <!-- Sun face (simple happy) -->
    <!-- Eyes -->
    ${circ(cx - 10, cy - 4, 3, C.ink, 0)}
    ${circ(cx + 10, cy - 4, 3, C.ink, 0)}
    <!-- Smile -->
    <path d="M${cx - 10},${cy + 8} Q${cx},${cy + 16} ${cx + 10},${cy + 8}"
          fill="none" stroke="${C.ink}" stroke-width="2.5" stroke-linecap="round"/>
    <!-- Blush -->
    <ellipse cx="${cx - 16}" cy="${cy + 5}" rx="5" ry="3.5" fill="${C.pink}" opacity="0.45"/>
    <ellipse cx="${cx + 16}" cy="${cy + 5}" rx="5" ry="3.5" fill="${C.pink}" opacity="0.45"/>
  `;
}

function iconCloud() {
  return `
    <!-- Cloud body (overlapping circles) -->
    ${circ(cx - 18, cy + 6, 28, C.milkWhite, 2, C.ink)}
    ${circ(cx + 18, cy + 6, 28, C.milkWhite, 2, C.ink)}
    ${circ(cx - 6,  cy - 8, 30, C.milkWhite, 2, C.ink)}
    ${circ(cx + 14, cy - 4, 22, C.milkWhite, 2, C.ink)}
    ${circ(cx,     cy + 10, 26, C.milkWhite, 2, C.ink)}
    <!-- Sky-blue tint overlay (bottom) -->
    <clipPath id="cloudClip">
      <use href="#cloudBody"/>
    </clipPath>
    <defs>
      <g id="cloudBody">
        ${circ(cx - 18, cy + 6, 28, C.milkWhite, 2, C.ink)}
        ${circ(cx + 18, cy + 6, 28, C.milkWhite, 2, C.ink)}
        ${circ(cx - 6,  cy - 8, 30, C.milkWhite, 2, C.ink)}
        ${circ(cx + 14, cy - 4, 22, C.milkWhite, 2, C.ink)}
        ${circ(cx,     cy + 10, 26, C.milkWhite, 2, C.ink)}
      </g>
    </defs>
    <rect x="${cx - 40}" y="${cy}" width="80" height="40"
          fill="${C.skyBlue}" opacity="0.25" clip-path="url(#cloudClip)"/>
    <!-- Cute face -->
    ${circ(cx - 10, cy - 2, 2.5, C.ink, 0)}
    ${circ(cx + 10, cy - 2, 2.5, C.ink, 0)}
    <path d="M${cx - 5},${cy + 4} Q${cx},${cy + 8} ${cx + 5},${cy + 4}"
          fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>
    <!-- Cheeks -->
    <ellipse cx="${cx - 18}" cy="${cy + 4}" rx="5" ry="3.5" fill="${C.pink}" opacity="0.35"/>
    <ellipse cx="${cx + 18}" cy="${cy + 4}" rx="5" ry="3.5" fill="${C.pink}" opacity="0.35"/>
  `;
}

function iconStar() {
  // 5-point star using path
  const pts = [];
  const or = 36; // outer radius
  const ir = 15; // inner radius
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? or : ir;
    const a = (i * 36 - 90) * Math.PI / 180;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `
    ${poly(pts.join(" "), C.sunYellow, 2.5, C.ink)}
    <!-- Star highlight (upper left facet) -->
    ${poly([
      `${cx},${cy - or}`,
      `${(cx + Math.cos(162*Math.PI/180)*ir).toFixed(1)},${(cy + Math.sin(162*Math.PI/180)*ir).toFixed(1)}`,
      `${(cx + Math.cos(234*Math.PI/180)*or).toFixed(1)},${(cy + Math.sin(234*Math.PI/180)*or).toFixed(1)}`,
      `${(cx + Math.cos(306*Math.PI/180)*ir).toFixed(1)},${(cy + Math.sin(306*Math.PI/180)*ir).toFixed(1)}`,
    ].join(" "), "#FFE580", 0)}
    <!-- Center dot -->
    ${circ(cx, cy, 4, C.goldDark, 0)}
  `;
}

function iconHeart() {
  return `
    <!-- Heart path -->
    <path d="M${cx},${cy + 24}
             C${cx},${cy + 24} ${cx - 34},${cy + 2} ${cx - 22},${cy - 14}
             C${cx - 16},${cy - 24} ${cx},${cy - 16} ${cx},${cy - 4}
             C${cx},${cy - 16} ${cx + 16},${cy - 24} ${cx + 22},${cy - 14}
             C${cx + 34},${cy + 2} ${cx},${cy + 24} ${cx},${cy + 24}
             Z"
          fill="${C.heartRed}" stroke="${C.ink}" stroke-width="2.5"/>
    <!-- Heart highlight (left lobe) -->
    <path d="M${cx - 18},${cy - 8}
             C${cx - 26},${cy - 16} ${cx - 18},${cy - 22} ${cx - 12},${cy - 16}
             C${cx - 8},${cy - 12} ${cx - 6},${cy - 6} ${cx - 4},${cy - 2}
             C${cx - 8},${cy - 8} ${cx - 14},${cy - 12} ${cx - 18},${cy - 8}
             Z"
          fill="#FF9AA5" opacity="0.5"/>
    <!-- Shine dot -->
    ${circ(cx - 16, cy - 14, 3, "#FFFFFF", 0)}
  `;
}

function iconButterfly() {
  return `
    <!-- Upper wings (larger) -->
    <path d="M${cx - 4},${cy + 4}
             C${cx - 8},${cy - 18} ${cx - 40},${cy - 28} ${cx - 38},${cy - 2}
             C${cx - 36},${cy + 14} ${cx - 14},${cy + 12} ${cx - 4},${cy + 4}
             Z"
          fill="${C.wingTeal}" stroke="${C.ink}" stroke-width="2"/>
    <path d="M${cx + 4},${cy + 4}
             C${cx + 8},${cy - 18} ${cx + 40},${cy - 28} ${cx + 38},${cy - 2}
             C${cx + 36},${cy + 14} ${cx + 14},${cy + 12} ${cx + 4},${cy + 4}
             Z"
          fill="${C.wingTeal}" stroke="${C.ink}" stroke-width="2"/>
    <!-- Lower wings (smaller) -->
    <path d="M${cx - 4},${cy + 6}
             C${cx - 6},${cy + 14} ${cx - 28},${cy + 28} ${cx - 24},${cy + 16}
             C${cx - 20},${cy + 8} ${cx - 10},${cy + 10} ${cx - 4},${cy + 6}
             Z"
          fill="${C.wingYellow}" stroke="${C.ink}" stroke-width="2"/>
    <path d="M${cx + 4},${cy + 6}
             C${cx + 6},${cy + 14} ${cx + 28},${cy + 28} ${cx + 24},${cy + 16}
             C${cx + 20},${cy + 8} ${cx + 10},${cy + 10} ${cx + 4},${cy + 6}
             Z"
          fill="${C.wingYellow}" stroke="${C.ink}" stroke-width="2"/>
    <!-- Wing patterns (dots) -->
    ${circ(cx - 22, cy - 8, 4, "#FFFFFF", 0)}
    ${circ(cx + 22, cy - 8, 4, "#FFFFFF", 0)}
    ${circ(cx - 16, cy + 14, 3, "#FFFFFF", 0)}
    ${circ(cx + 16, cy + 14, 3, "#FFFFFF", 0)}
    <!-- Body -->
    <ellipse cx="${cx}" cy="${cy + 6}" rx="3.5" ry="18"
             fill="${C.ink}" stroke="${C.ink}" stroke-width="1"/>
    <!-- Antennae -->
    <path d="M${cx - 1.5},${cy - 12} Q${cx - 10},${cy - 28} ${cx - 6},${cy - 32}"
          fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>
    <path d="M${cx + 1.5},${cy - 12} Q${cx + 10},${cy - 28} ${cx + 6},${cy - 32}"
          fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>
    <!-- Antenna tips -->
    ${circ(cx - 6, cy - 32, 2.5, C.wingTeal, 0)}
    ${circ(cx + 6, cy - 32, 2.5, C.wingTeal, 0)}
  `;
}

// ─── Symbol table (index → name + label + icon generator) ─────────

const SYMBOLS = [
  { name: "sheep-face", label: "sheep face",       icon: iconSheepFace },
  { name: "lamb",        label: "lamb",              icon: iconLamb },
  { name: "wool-ball",   label: "wool ball",         icon: iconWoolBall },
  { name: "bell-collar", label: "bell collar",       icon: iconBellCollar },
  { name: "hoof-print",  label: "hoof print",        icon: iconHoofPrint },
  { name: "carrot",      label: "carrot",            icon: iconCarrot },
  { name: "clover",      label: "clover",            icon: iconClover },
  { name: "flower",      label: "wild flower",       icon: iconFlower },
  { name: "milk-bottle", label: "milk bottle",       icon: iconMilkBottle },
  { name: "fence",       label: "fence",             icon: iconFence },
  { name: "sun",         label: "sun",               icon: iconSun },
  { name: "cloud",       label: "cloud",             icon: iconCloud },
  { name: "star",        label: "star charm",        icon: iconStar },
  { name: "heart",       label: "heart",             icon: iconHeart },
  { name: "butterfly",   label: "butterfly",         icon: iconButterfly },
];

// ─── Generate SVGs ────────────────────────────────────────────────

if (!existsSync(SRC_DIR)) mkdirSync(SRC_DIR, { recursive: true });

for (let i = 0; i < SYMBOLS.length; i++) {
  const sym = SYMBOLS[i];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
    ${cardFrame()}
    <!-- Icon: ${sym.name} -->
    <g transform="translate(0, 0)">
      ${sym.icon()}
    </g>
</svg>`;
  const fname = `tile-${String(i).padStart(2, "0")}-${sym.name}.svg`;
  writeFileSync(join(SRC_DIR, fname), svg);
  console.log(`  [SVG] ${fname}`);
}

console.log(`\n  Generated ${SYMBOLS.length} SVGs in ${SRC_DIR}`);

// ─── Rasterize to webp via sharp ─────────────────────────────────

console.log("\nRasterizing to webp...");
for (let i = 0; i < SYMBOLS.length; i++) {
  const sym = SYMBOLS[i];
  const svgPath = join(SRC_DIR, `tile-${String(i).padStart(2, "0")}-${sym.name}.svg`);
  const webpPath = join(WEBP_DIR, `tile-${String(i).padStart(2, "0")}-${sym.name}.webp`);

  await sharp(svgPath)
    .resize(SIZE, SIZE)
    .webp({ quality: 92 })
    .toFile(webpPath);

  console.log(`  [WEBP] tile-${String(i).padStart(2, "0")}-${sym.name}.webp`);
}

// ─── Delete old tile webps (the replaced generic set) ────────────

const OLD_TILES = [
  "tile-00-wool-flower.webp","tile-01-apple.webp","tile-02-orange.webp",
  "tile-03-lemon.webp","tile-04-grape.webp","tile-05-strawberry.webp",
  "tile-06-peach.webp","tile-07-cherry.webp","tile-08-star.webp",
  "tile-09-bell.webp","tile-10-target.webp","tile-11-ribbon.webp",
  "tile-12-crystal.webp","tile-13-tent.webp","tile-14-carousel.webp",
];
for (const old of OLD_TILES) {
  const p = join(WEBP_DIR, old);
  if (existsSync(p)) {
    unlinkSync(p);
    console.log(`  [DEL] ${old}`);
  }
}

console.log(`\n  Done! ${SYMBOLS.length} sheep-themed tiles ready.`);
