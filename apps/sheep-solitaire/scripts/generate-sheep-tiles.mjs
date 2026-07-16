#!/usr/bin/env node
/**
 * generate-sheep-tiles.mjs
 *
 * Generates 15 sheep-themed tile SVGs (with shared card-frame template) plus
 * the mascot sticker, and rasterizes them to webp via sharp. Replaces the
 * generic fruit/object grab-bag with a cohesive "sheep's meadow farm" icon set.
 *
 * Usage:   cd apps/sheep-solitaire && node scripts/generate-sheep-tiles.mjs
 * Output:  public/art/tile-00-{name}.webp … tile-14-{name}.webp
 *          public/art/mascot-sheep.webp (die-cut sticker reframe of the
 *          in-house public/logo.webp character, 560×560, with alpha)
 * Sources: public/art/src-svg/ (keeps original SVGs for future editing)
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Config ──────────────────────────────────────────────────────

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "../public/art/src-svg");
const WEBP_DIR = join(dirname(fileURLToPath(import.meta.url)), "../public/art");
const SIZE = 200; // icon coordinate space (icons are authored in a 200×200 box)
// P2 mahjong-tile template — portrait card with a visible 3D bottom edge.
const TILE_W = 200;
const TILE_H = 232;

// ─── Palette (cohesive warm meadow + Neo green brand) ─────────────

const C = {
  // Card frame (matches existing tile style)
  cardBg:      "#F5EDD9",
  cardBorder:  "#D4B88E",
  // Icon ink & base tones — §9.4 v2 sticker language: near-black outlines
  ink:         "#26221E",    // near-black outline / fill (sticker style)
  wool:        "#F8F2E6",    // cream-white wool
  woolDark:    "#E5D7C1",    // wool shadow
  pink:        "#FFB5BA",    // inner ear / nose / cheek
  skin:        "#F4E1CE",    // face skin
  yarnRose:    "#D94F70",    // saturated rose — wool-ball yarn strands
  yarnAmber:   "#E8942A",    // amber — wool-ball cross strands
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

// ─── Shared card frame — §9.4 v2 sticker/papercraft template ──────
// Calibrated against the user's real screenshots of the original: cream face
// (≈#F8F6E8) rounded square, thin NEAR-BLACK outline, a gray-green "thickness"
// strip along the bottom edge, and a HARD offset black shadow (no blur, flat
// fills, zero gradients). Replaces the earlier mahjong-white template.
function cardFrame() {
  const r = 28;   // corner radius
  const pad = 10; // side padding
  const faceH = 192;      // cream face height
  const edgeDrop = 16;    // gray-green thickness strip below the face

  return `
    <!-- Hard offset sticker shadow (flat, no blur) -->
    <rect x="${pad + 7}" y="${pad + 10}" width="${TILE_W - 2 * pad}" height="${faceH + edgeDrop}"
          rx="${r}" ry="${r}" fill="#26221E" opacity="0.30" />
    <!-- Gray-green thickness strip (card stack edge) -->
    <rect x="${pad}" y="${pad + edgeDrop}" width="${TILE_W - 2 * pad}" height="${faceH}"
          rx="${r}" ry="${r}" fill="#97A886" stroke="#26221E" stroke-width="4.5" />
    <!-- Cream tile face -->
    <rect x="${pad}" y="${pad}" width="${TILE_W - 2 * pad}" height="${faceH}"
          rx="${r - 2}" ry="${r - 2}" fill="#F8F6E8" stroke="#26221E" stroke-width="4.5" />
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

// Sheep face + lamb — redrawn 2026-07-14 as flat sticker derivatives of the
// in-house logo character (public/logo.webp, July 2026 refresh): the old pink
// -dominant versions (pink teardrop ears, dot eyes, pink oval snout) read as
// PIG faces at board size (user verdict). New craft bar: cream scalloped wool
// crown framing a cream face, big GREEN eyes with white highlights, small pink
// INNER ears only, tiny pink nose + smile, soft blush — judged at 40px.
const FACE_CREAM = "#FBEEDC"; // warm cream face (NOT pink)
const WOOL_WHITE = "#FFFDF6"; // near-white wool (separates from cream card)

/** Shared cute-sheep head. cyOff shifts the whole head; k scales features. */
function sheepHead({ headY = cy - 6, faceY = cy + 8, k = 1 } = {}) {
  // Scallop ring around the top of the head (wool crown).
  const crownR = 39 * k;
  const crown = [
    { a: 150, r: 17 }, { a: 120, r: 18 }, { a: 90, r: 19 },
    { a: 60, r: 18 }, { a: 30, r: 17 }, { a: 172, r: 14 }, { a: 8, r: 14 },
  ].map(({ a, r }) => {
    const rad = (a * Math.PI) / 180;
    const px = cx + Math.cos(rad) * crownR;
    const py = headY - Math.sin(rad) * crownR * 0.92;
    return circ(px, py, r * k, WOOL_WHITE, 4.5, C.ink);
  }).join("\n    ");
  return `
    <!-- Soft ground shadow lifts the head off the cream card -->
    <ellipse cx="${cx}" cy="${faceY + 44 * k}" rx="${42 * k}" ry="7" fill="${C.ink}" opacity="0.14"/>
    <!-- Cream scalloped wool crown -->
    ${crown}
    <!-- Droopy ears (cream outer, pink inner) — NOT pink teardrops -->
    <ellipse cx="${cx - 45 * k}" cy="${faceY - 4}" rx="${12.5 * k}" ry="${21 * k}" fill="${WOOL_WHITE}"
             stroke="${C.ink}" stroke-width="4.5" transform="rotate(32,${cx - 45 * k},${faceY - 4})"/>
    <ellipse cx="${cx + 45 * k}" cy="${faceY - 4}" rx="${12.5 * k}" ry="${21 * k}" fill="${WOOL_WHITE}"
             stroke="${C.ink}" stroke-width="4.5" transform="rotate(-32,${cx + 45 * k},${faceY - 4})"/>
    <ellipse cx="${cx - 46 * k}" cy="${faceY - 2}" rx="${6 * k}" ry="${12 * k}" fill="${C.pink}"
             transform="rotate(32,${cx - 46 * k},${faceY - 2})"/>
    <ellipse cx="${cx + 46 * k}" cy="${faceY - 2}" rx="${6 * k}" ry="${12 * k}" fill="${C.pink}"
             transform="rotate(-32,${cx + 46 * k},${faceY - 2})"/>
    <!-- Face (covers the crown interior, hiding inner scallop strokes) -->
    <ellipse cx="${cx}" cy="${faceY}" rx="${34 * k}" ry="${32 * k}" fill="${FACE_CREAM}"
             stroke="${C.ink}" stroke-width="4.5"/>
    <!-- Wool fringe over the forehead (three bumps dipping into the face) -->
    ${circ(cx - 17 * k, faceY - 26 * k, 11 * k, WOOL_WHITE, 4, C.ink)}
    ${circ(cx + 17 * k, faceY - 26 * k, 11 * k, WOOL_WHITE, 4, C.ink)}
    ${circ(cx, faceY - 30 * k, 12.5 * k, WOOL_WHITE, 4, C.ink)}
    <!-- Big green eyes with white highlights -->
    ${circ(cx - 15 * k, faceY - 2, 10.5 * k, C.leafGreen, 3, C.ink)}
    ${circ(cx + 15 * k, faceY - 2, 10.5 * k, C.leafGreen, 3, C.ink)}
    ${circ(cx - 15 * k, faceY - 1, 5 * k, C.ink, 0)}
    ${circ(cx + 15 * k, faceY - 1, 5 * k, C.ink, 0)}
    ${circ(cx - 18 * k, faceY - 6, 3.4 * k, C.milkWhite, 0)}
    ${circ(cx + 12 * k, faceY - 6, 3.4 * k, C.milkWhite, 0)}
    ${circ(cx - 12 * k, faceY + 2, 1.6 * k, C.milkWhite, 0)}
    ${circ(cx + 18 * k, faceY + 2, 1.6 * k, C.milkWhite, 0)}
    <!-- Tiny pink nose + smile -->
    <ellipse cx="${cx}" cy="${faceY + 13 * k}" rx="${5 * k}" ry="${3.6 * k}" fill="${C.pink}"
             stroke="${C.ink}" stroke-width="2.5"/>
    <path d="M${cx - 8 * k},${faceY + 20 * k} Q${cx},${faceY + 26 * k} ${cx + 8 * k},${faceY + 20 * k}"
          fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>
    <!-- Soft blush dots -->
    <ellipse cx="${cx - 27 * k}" cy="${faceY + 10 * k}" rx="${7.5 * k}" ry="${5 * k}" fill="${C.pink}" opacity="0.5"/>
    <ellipse cx="${cx + 27 * k}" cy="${faceY + 10 * k}" rx="${7.5 * k}" ry="${5 * k}" fill="${C.pink}" opacity="0.5"/>
  `;
}

function iconSheepFace() {
  return sheepHead({ headY: cy - 8, faceY: cy + 8, k: 1 });
}

function iconLamb() {
  // Smaller head + green hair bow (a bell would clash with tile-03). The bow
  // rides ON TOP of the crown silhouette with only the knot overlapping the
  // wool — merged loops read as leaves at 40px (round-1 fail).
  const knotY = cy - 47;
  return `
    ${sheepHead({ headY: cy - 2, faceY: cy + 12, k: 0.88 })}
    <!-- Green hair bow — the lamb's differentiator -->
    <path d="M${cx - 5},${knotY} C${cx - 14},${knotY - 14} ${cx - 34},${knotY - 12} ${cx - 31},${knotY + 2}
             C${cx - 29},${knotY + 12} ${cx - 13},${knotY + 10} ${cx - 5},${knotY} Z"
          fill="${C.leafGreen}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M${cx + 5},${knotY} C${cx + 14},${knotY - 14} ${cx + 34},${knotY - 12} ${cx + 31},${knotY + 2}
             C${cx + 29},${knotY + 12} ${cx + 13},${knotY + 10} ${cx + 5},${knotY} Z"
          fill="${C.leafGreen}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>
    ${circ(cx, knotY, 7.5, C.grassGreen, 3.5, C.ink)}
  `;
}

// Redesigned for contrast: the first version was cream-on-cream with hairline
// wraps and read as a BLANK card at board/tray size (~40-54px). Now: warm-gray
// ball, thick ink outline, bold saturated rose/amber yarn strands, soft shadow.
function iconWoolBall() {
  const r = 41;
  return `
    <!-- Soft ground shadow so the ball reads as an object, not a blank face -->
    <ellipse cx="${cx}" cy="${cy + r + 11}" rx="${r - 8}" ry="6.5" fill="${C.ink}" opacity="0.16"/>
    <!-- Yarn ball body — warm gray so it separates from the cream card face -->
    ${circ(cx, cy + 2, r, C.woolDark, 4.5, C.ink)}
    <!-- Wound yarn strands, clipped to the ball -->
    <defs>
      <clipPath id="woolBallClip"><circle cx="${cx}" cy="${cy + 2}" r="${r - 2}"/></clipPath>
    </defs>
    <g clip-path="url(#woolBallClip)">
      <!-- Bold rose latitude strands -->
      <ellipse cx="${cx}" cy="${cy - 16}" rx="${r}" ry="13" fill="none"
               stroke="${C.yarnRose}" stroke-width="7"/>
      <ellipse cx="${cx}" cy="${cy + 2}" rx="${r + 2}" ry="15" fill="none"
               stroke="${C.yarnRose}" stroke-width="7"/>
      <ellipse cx="${cx}" cy="${cy + 20}" rx="${r}" ry="12" fill="none"
               stroke="${C.yarnRose}" stroke-width="7"/>
      <!-- Amber cross strands (wound diagonals) -->
      <ellipse cx="${cx}" cy="${cy + 2}" rx="15" ry="${r + 2}" fill="none"
               stroke="${C.yarnAmber}" stroke-width="6" transform="rotate(30,${cx},${cy + 2})"/>
      <ellipse cx="${cx}" cy="${cy + 2}" rx="15" ry="${r + 2}" fill="none"
               stroke="${C.yarnAmber}" stroke-width="6" transform="rotate(-26,${cx},${cy + 2})"/>
    </g>
    <!-- Re-assert the ball outline over the clipped strands -->
    <circle cx="${cx}" cy="${cy + 2}" r="${r}" fill="none" stroke="${C.ink}" stroke-width="4.5"/>
    <!-- Highlight -->
    <ellipse cx="${cx - 15}" cy="${cy - 15}" rx="12" ry="8" fill="#FFFFFF" opacity="0.5"/>
    <!-- Loose tail strand with a curl -->
    <path d="M${cx + r - 8},${cy + 10} Q${cx + r + 16},${cy - 2} ${cx + r + 8},${cy + 20} Q${cx + r + 2},${cy + 34} ${cx + r + 18},${cy + 30}"
          fill="none" stroke="${C.yarnRose}" stroke-width="6.5" stroke-linecap="round"/>
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
  // Icons are authored around (100,100) in a 200×200 box; the portrait tile's
  // white face is centred at (100,107), and the icon group is scaled up ~1.08
  // so glyphs stay chunky/readable at 40px board size (§9.4 "图案加粗").
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 ${TILE_W} ${TILE_H}" width="${TILE_W}" height="${TILE_H}">
    ${cardFrame()}
    <!-- Icon: ${sym.name} -->
    <g transform="translate(100, 107) scale(1.16) translate(-100, -100)">
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

  // Saturation bump on the raster (§9.4 "提饱和") — white face/gray edge are
  // saturation-invariant, so only the icon inks get punchier.
  await sharp(svgPath)
    .resize(TILE_W, TILE_H)
    .modulate({ saturation: 1.2 })
    .webp({ quality: 92 })
    .toFile(webpPath);

  console.log(`  [WEBP] tile-${String(i).padStart(2, "0")}-${sym.name}.webp`);
}

// ─── Mascot sprite (reframed in-house logo character) ────────────
// The previous mascot was a circle-composite SVG sheep drawn in this script;
// the 2026-07-14 user verdict retired it ("羊太吓人了…居然是一堆圆圈拼的").
// The platform already owns a genuinely cute PAINTED sheep character from the
// July 2026 visual refresh (public/logo.webp — sticker-card framing with a
// gold border). The mascot is now that logo REFRAMED as a die-cut sticker:
// rounded-corner mask + near-black ink outline + hard offset shadow (§9.4
// sticker tokens), exported with true alpha. Extracting the banner's
// full-body pose was attempted and rejected: the painterly meadow occludes
// the hooves with grass blades and shares hue ranges with the wool/scarf, so
// no clean matte exists (details in ATTRIBUTION.md).

const LOGO_SRC = join(dirname(fileURLToPath(import.meta.url)), "../public/logo.webp");
const M_CANVAS = 560;   // output canvas (card + shadow overhang)
const M_CARD = 500;     // die-cut card size
const M_R = 92;         // die-cut corner radius
const M_X = 14, M_Y = 10;
const M_SHADOW_DX = 16, M_SHADOW_DY = 20;

console.log("\nGenerating mascot (die-cut sticker from public/logo.webp)...");

const mascotMaskSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${M_CARD}" height="${M_CARD}">
     <rect x="0" y="0" width="${M_CARD}" height="${M_CARD}" rx="${M_R}" ry="${M_R}" fill="#ffffff"/>
   </svg>`,
);
const mascotCardPng = await sharp(LOGO_SRC)
  .resize(M_CARD, M_CARD)
  .composite([{ input: mascotMaskSvg, blend: "dest-in" }])
  .png()
  .toBuffer();
const mascotShadowSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${M_CANVAS}" height="${M_CANVAS}">
     <rect x="${M_X + M_SHADOW_DX}" y="${M_Y + M_SHADOW_DY}" width="${M_CARD}" height="${M_CARD}"
           rx="${M_R}" ry="${M_R}" fill="#26221E" opacity="0.30"/>
   </svg>`,
);
const mascotOutlineSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${M_CANVAS}" height="${M_CANVAS}">
     <rect x="${M_X + 4.5}" y="${M_Y + 4.5}" width="${M_CARD - 9}" height="${M_CARD - 9}"
           rx="${M_R - 4.5}" ry="${M_R - 4.5}" fill="none" stroke="#26221E" stroke-width="9"/>
   </svg>`,
);
await sharp({
  create: { width: M_CANVAS, height: M_CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: mascotShadowSvg, left: 0, top: 0 },
    { input: mascotCardPng, left: M_X, top: M_Y },
    { input: mascotOutlineSvg, left: 0, top: 0 },
  ])
  .webp({ quality: 92 }) // alpha preserved — no flatten()
  .toFile(join(WEBP_DIR, "mascot-sheep.webp"));
console.log("  [WEBP] mascot-sheep.webp (die-cut logo sticker, with alpha)");

// ═══════════════════════════════════════════════════════════════════
// P2 scene art (§9.4 style tokens) — ALL ORIGINAL, drawn here.
//   field-meadow.webp  full-screen saturated grass field (tree shadows, flowers)
//   tray-wood.webp     brown wooden 7-slot tray
//   logo-sign.webp     wooden home-screen signboard (logo text drawn in-scene)
//   prop-{undo,remove,shuffle}.webp   prop-button glyphs
// ═══════════════════════════════════════════════════════════════════

/** Deterministic PRNG so re-running the generator is byte-stable. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// §9.4 v2 (calibrated against the user's real screenshots of the original):
// FLAT light lime-green field with sparse two-stroke hand-drawn grass
// squiggles ONLY — no texture, no tree shadows, no flowers. Very plain.
const FIELD_W = 780;   // 2× of the 390×844 logical scene
const FIELD_H = 1688;

function fieldMeadowSvg() {
  const rng = mulberry32(20260714);
  const parts = [];
  parts.push(`<rect x="0" y="0" width="${FIELD_W}" height="${FIELD_H}" fill="#B7E389"/>`);

  // Sparse hand-drawn grass squiggles: a pair of short curved strokes.
  const tufts = [];
  for (let i = 0; i < 26; i++) {
    const gx = 40 + rng() * (FIELD_W - 80);
    const gy = 40 + rng() * (FIELD_H - 80);
    const s = 0.8 + rng() * 0.6;
    const lean = (rng() - 0.5) * 8;
    tufts.push(`
      <g stroke="#7FBF5A" stroke-width="${(5 * s).toFixed(1)}" fill="none" stroke-linecap="round" opacity="0.9">
        <path d="M${(gx - 8 * s).toFixed(0)},${gy.toFixed(0)} q${(2 + lean).toFixed(0)},-${(16 * s).toFixed(0)} ${(8 + lean).toFixed(0)},-${(22 * s).toFixed(0)}"/>
        <path d="M${(gx + 6 * s).toFixed(0)},${(gy + 2).toFixed(0)} q${(-2 + lean).toFixed(0)},-${(14 * s).toFixed(0)} ${(-7 + lean).toFixed(0)},-${(19 * s).toFixed(0)}"/>
      </g>`);
  }
  parts.push(tufts.join("\n"));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FIELD_W} ${FIELD_H}" width="${FIELD_W}" height="${FIELD_H}">${parts.join("\n")}</svg>`;
}

// §9.4 v2 tray: brown wooden trough — rounded, dark-brown + black border, a
// row of FENCE POSTS along the front edge (signature detail), NO slot
// dividers, hard offset black shadow. 760×240 → 380×120 logical.
const TRAY_ART_W = 760;
const TRAY_ART_H = 240;

function trayWoodSvg() {
  const posts = [];
  const postCount = 9;
  const postW = 34;
  const span = TRAY_ART_W - 90;
  for (let i = 0; i < postCount; i++) {
    const px = 45 + (span / (postCount - 1)) * i - postW / 2;
    const wobble = i % 2 === 0 ? 0 : 6;
    posts.push(`
      <rect x="${px.toFixed(0)}" y="${142 + wobble}" width="${postW}" height="${86 - wobble}" rx="14"
            fill="#B98A50" stroke="#26221E" stroke-width="6"/>
      <rect x="${(px + 7).toFixed(0)}" y="${150 + wobble}" width="8" height="${66 - wobble}" rx="4"
            fill="#8A5A2E" opacity="0.6"/>
    `);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TRAY_ART_W} ${TRAY_ART_H}" width="${TRAY_ART_W}" height="${TRAY_ART_H}">
    <!-- Hard sticker shadow -->
    <rect x="16" y="20" width="${TRAY_ART_W - 24}" height="156" rx="34" fill="#26221E" opacity="0.30"/>
    <!-- Trough body -->
    <rect x="8" y="8" width="${TRAY_ART_W - 24}" height="156" rx="34"
          fill="#A9743E" stroke="#26221E" stroke-width="9"/>
    <!-- Plain darker interior (no slot dividers) -->
    <rect x="26" y="26" width="${TRAY_ART_W - 60}" height="120" rx="22" fill="#7C512A" stroke="#54320F" stroke-width="5"/>
    <!-- Fence posts along the front edge -->
    ${posts.join("\n")}
  </svg>`;
}

// §9.4 v2 prop buttons: SKY-BLUE rounded squares, black outline, hard offset
// black shadow, YELLOW icons. Full button baked per prop (140×150).
const PROP_W = 140;
const PROP_H = 150;

function propButtonSvg(glyph) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PROP_W} ${PROP_H}" width="${PROP_W}" height="${PROP_H}">
    <rect x="16" y="18" width="116" height="116" rx="28" fill="#26221E" opacity="0.32"/>
    <rect x="8" y="8" width="116" height="116" rx="28" fill="#5BC2F0" stroke="#26221E" stroke-width="7"/>
    <g transform="translate(-4, -4)">${glyph}</g>
  </svg>`;
}

// Yellow glyph helper: black under-stroke, yellow over-stroke.
function duoPath(d, wOuter = 24, wInner = 13) {
  return `
    <path d="${d}" fill="none" stroke="#26221E" stroke-width="${wOuter}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#FFD23E" stroke-width="${wInner}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function duoPoly(points) {
  return `
    <polygon points="${points}" fill="#FFD23E" stroke="#26221E" stroke-width="9" stroke-linejoin="round"/>`;
}

// Undo — counter-clockwise curved arrow.
const propUndo = propButtonSvg(`
  ${duoPath("M100,54 A34,34 0 1 0 104,84")}
  ${duoPoly("114,32 118,66 86,52")}
`);

// Remove-3 — out-of-tray arrow.
const propRemove = propButtonSvg(`
  ${duoPath("M38,80 v18 a12,12 0 0 0 12,12 h40 a12,12 0 0 0 12,-12 v-18", 22, 12)}
  ${duoPath("M70,88 v-42", 22, 12)}
  ${duoPoly("70,20 90,50 50,50")}
`);

// Shuffle — two crossing arrows.
const propShuffle = propButtonSvg(`
  ${duoPath("M34,52 h18 q14,0 22,12 l10,14 q8,12 22,12 h6", 20, 11)}
  ${duoPath("M34,90 h18 q14,0 22,-12 l10,-14 q8,-12 22,-12 h6", 20, 11)}
  ${duoPoly("124,52 102,38 102,66")}
  ${duoPoly("124,90 102,76 102,104")}
`);

// §9.4 v2 home CTA: WHITE sticker button with a hand-drawn wobbly black
// border + hard offset shadow (text is drawn in-scene). 560×170.
const STICKER_W = 560;
const STICKER_H = 170;

function stickerButtonSvg() {
  const rng = mulberry32(88);
  // Sample a rounded-rect perimeter and perturb it for the hand-drawn read.
  const w = 508, h = 118, r = 44;
  const ox = 18, oy = 14;
  const pts = [];
  const seg = (x0, y0, x1, y1, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  };
  const arc = (cx, cy, a0, a1, n) => {
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  seg(ox + r, oy, ox + w - r, oy, 14);
  arc(ox + w - r, oy + r, -Math.PI / 2, 0, 6);
  seg(ox + w, oy + r, ox + w, oy + h - r, 4);
  arc(ox + w - r, oy + h - r, 0, Math.PI / 2, 6);
  seg(ox + w - r, oy + h, ox + r, oy + h, 14);
  arc(ox + r, oy + h - r, Math.PI / 2, Math.PI, 6);
  seg(ox, oy + h - r, ox, oy + r, 4);
  arc(ox + r, oy + r, Math.PI, Math.PI * 1.5, 6);
  const wobbly = pts
    .map(([x, y], i) => {
      const jx = (rng() - 0.5) * 5;
      const jy = (rng() - 0.5) * 5;
      return `${i === 0 ? "M" : "L"}${(x + jx).toFixed(1)},${(y + jy).toFixed(1)}`;
    })
    .join(" ") + " Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STICKER_W} ${STICKER_H}" width="${STICKER_W}" height="${STICKER_H}">
    <path d="${wobbly}" transform="translate(11, 13)" fill="#26221E" opacity="0.32"/>
    <path d="${wobbly}" fill="#FFFFFF" stroke="#26221E" stroke-width="8" stroke-linejoin="round"/>
  </svg>`;
}

const P2_ART = [
  { name: "field-meadow", svg: fieldMeadowSvg(), w: FIELD_W, h: FIELD_H, quality: 84 },
  { name: "tray-wood", svg: trayWoodSvg(), w: TRAY_ART_W, h: TRAY_ART_H, quality: 92 },
  { name: "btn-sticker", svg: stickerButtonSvg(), w: STICKER_W, h: STICKER_H, quality: 92 },
  { name: "prop-undo", svg: propUndo, w: PROP_W, h: PROP_H, quality: 92 },
  { name: "prop-remove", svg: propRemove, w: PROP_W, h: PROP_H, quality: 92 },
  { name: "prop-shuffle", svg: propShuffle, w: PROP_W, h: PROP_H, quality: 92 },
];

console.log("\nGenerating P2 scene art...");
for (const art of P2_ART) {
  const svgPath = join(SRC_DIR, `${art.name}.svg`);
  writeFileSync(svgPath, art.svg);
  await sharp(svgPath)
    .resize(art.w, art.h)
    .webp({ quality: art.quality }) // alpha preserved for button/prop/sheep art
    .toFile(join(WEBP_DIR, `${art.name}.webp`));
  console.log(`  [WEBP] ${art.name}.webp`);
}

// Retired art:
//   logo-sign.webp     pre-§9.4-v2 wooden-sign draft (never shipped)
//   sheep-grazing.webp circle-composite grazing pose — retired with the home
//                      flock in the 2026-07-14 mascot verdict (the home now
//                      shows the single logo-derived hero medallion)
//   mascot-sheep.svg   circle-composite mascot source — the webp of the same
//                      name is now generated from public/logo.webp above
for (const stale of ["logo-sign.webp", "sheep-grazing.webp"]) {
  const p = join(WEBP_DIR, stale);
  if (existsSync(p)) {
    unlinkSync(p);
    console.log(`  [DEL] ${stale}`);
  }
  const s = join(SRC_DIR, stale.replace(".webp", ".svg"));
  if (existsSync(s)) unlinkSync(s);
}
for (const staleSvg of ["mascot-sheep.svg"]) {
  const s = join(SRC_DIR, staleSvg);
  if (existsSync(s)) {
    unlinkSync(s);
    console.log(`  [DEL] src-svg/${staleSvg}`);
  }
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
