#!/usr/bin/env node
/**
 * generate-gomoku-art.mjs — deterministic scene art for apps/gomoku.
 *
 * Composes layered SVG in code and rasterises it with sharp (2x supersample,
 * downscaled to the shipping size) through scripts/lib/svg-raster.mjs. No
 * network access, no model calls: running this twice on the same checkout
 * produces byte-identical webp files, so the assets are reviewable in diffs.
 *
 * Usage:
 *   node scripts/generate-gomoku-art.mjs [--out <dir>] [--quality <1-100>]
 *
 * Sizes are driven by the scene layout in apps/gomoku/src/scenes/GomokuScene.ts
 * (design canvas 420x620, board frame 388x388, cell pitch ~26.6px).
 */

import path from "node:path";
import process from "node:process";
import { createSeededRandom, fixed, writeSvgAsWebp } from "./lib/svg-raster.mjs";

// ── Palette (mirrors the `C` map in GomokuScene.ts) ───────────────────────────
const P = {
  linen: "#f5e6c8",
  linenShade: "#e6d2ad",
  linenDeep: "#d8c096",
  wood: "#dcb35c",
  woodLight: "#eecb84",
  woodDeep: "#c1953f",
  woodEdge: "#8b6914",
  woodEdgeDeep: "#6d5210",
  grain: "#b78b36",
  black: "#1a1a1a",
  blackRim: "#050505",
  blackSheen: "#7d7d7d",
  white: "#f8f8f0",
  whiteRim: "#b9a87d",
  whiteSheen: "#ffffff",
  lastMove: "#e63946",
  winLine: "#ff6b35",
  winLineHot: "#ffb066",
  gold: "#d4a843",
  goldLight: "#f0c866",
  card: "#fff8ea",
  text: "#2d2114",
  easy: "#6dbf7b",
  medium: "#dbab40",
  hard: "#dd6958",
};

const DIFFICULTIES = [
  { slug: "easy", color: P.easy, pips: 1 },
  { slug: "medium", color: P.medium, pips: 2 },
  { slug: "hard", color: P.hard, pips: 3 },
];

// ── SVG fragments ─────────────────────────────────────────────────────────────

function svgRoot(width, height, body) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`,
    ` viewBox="0 0 ${width} ${height}">`,
    body,
    "</svg>",
  ].join("");
}

/** Woven linen table cloth behind the board. */
function tableLinenSvg(width, height) {
  const rand = createSeededRandom(0x60_60_4b_11);
  const warp = [];
  for (let x = 0; x <= width; x += 4) {
    const alpha = fixed(0.05 + rand() * 0.05, 3);
    warp.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${P.linenShade}" stroke-opacity="${alpha}" stroke-width="2"/>`,
    );
  }
  for (let y = 0; y <= height; y += 4) {
    const alpha = fixed(0.04 + rand() * 0.05, 3);
    warp.push(
      `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${P.linenDeep}" stroke-opacity="${alpha}" stroke-width="2"/>`,
    );
  }
  const flecks = [];
  for (let i = 0; i < 220; i += 1) {
    const cx = fixed(rand() * width, 1);
    const cy = fixed(rand() * height, 1);
    const r = fixed(0.6 + rand() * 1.2, 2);
    flecks.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${P.linenDeep}" fill-opacity="${fixed(0.1 + rand() * 0.14, 3)}"/>`,
    );
  }
  return svgRoot(
    width,
    height,
    [
      "<defs>",
      `<radialGradient id="vig" cx="50%" cy="42%" r="78%">`,
      `<stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>`,
      `<stop offset="62%" stop-color="#ffffff" stop-opacity="0"/>`,
      `<stop offset="100%" stop-color="${P.woodEdge}" stop-opacity="0.22"/>`,
      "</radialGradient>",
      "</defs>",
      `<rect width="${width}" height="${height}" fill="${P.linen}"/>`,
      warp.join(""),
      flecks.join(""),
      `<rect width="${width}" height="${height}" fill="url(#vig)"/>`,
    ].join(""),
  );
}

/** Bevelled wooden board slab (grid lines stay vector in the scene). */
function boardWoodSvg(size) {
  const rand = createSeededRandom(0x62_6f_61_72);
  const bevel = 8;
  const inner = size - bevel * 2;
  const grain = [];
  for (let i = 0; i < 46; i += 1) {
    const y = fixed(bevel + rand() * inner, 1);
    const sway = fixed(4 + rand() * 10, 1);
    const width = fixed(0.6 + rand() * 1.9, 2);
    const alpha = fixed(0.06 + rand() * 0.16, 3);
    grain.push(
      `<path d="M${bevel} ${y} C ${fixed(size * 0.32, 1)} ${fixed(y - sway, 1)}, ${fixed(size * 0.68, 1)} ${fixed(y + sway, 1)}, ${size - bevel} ${y}"` +
        ` fill="none" stroke="${P.grain}" stroke-opacity="${alpha}" stroke-width="${width}"/>`,
    );
  }
  const knots = [];
  for (let i = 0; i < 5; i += 1) {
    const cx = fixed(bevel + 20 + rand() * (inner - 40), 1);
    const cy = fixed(bevel + 20 + rand() * (inner - 40), 1);
    knots.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${fixed(5 + rand() * 7, 1)}" ry="${fixed(2.5 + rand() * 3.5, 1)}"` +
        ` fill="none" stroke="${P.woodDeep}" stroke-opacity="0.18" stroke-width="1.2"/>`,
    );
  }
  return svgRoot(
    size,
    size,
    [
      "<defs>",
      `<linearGradient id="slab" x1="0%" y1="0%" x2="100%" y2="100%">`,
      `<stop offset="0%" stop-color="${P.woodLight}"/>`,
      `<stop offset="48%" stop-color="${P.wood}"/>`,
      `<stop offset="100%" stop-color="${P.woodDeep}"/>`,
      "</linearGradient>",
      `<linearGradient id="frame" x1="0%" y1="0%" x2="0%" y2="100%">`,
      `<stop offset="0%" stop-color="${P.woodEdge}"/>`,
      `<stop offset="100%" stop-color="${P.woodEdgeDeep}"/>`,
      "</linearGradient>",
      `<clipPath id="face"><rect x="${bevel}" y="${bevel}" width="${inner}" height="${inner}" rx="4"/></clipPath>`,
      "</defs>",
      `<rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="10" fill="url(#frame)"/>`,
      `<rect x="${bevel}" y="${bevel}" width="${inner}" height="${inner}" rx="4" fill="url(#slab)"/>`,
      `<g clip-path="url(#face)">${grain.join("")}${knots.join("")}</g>`,
      `<rect x="${bevel + 0.75}" y="${bevel + 0.75}" width="${inner - 1.5}" height="${inner - 1.5}" rx="4"`,
      ` fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1.5"/>`,
      `<rect x="${bevel - 1}" y="${bevel - 1}" width="${inner + 2}" height="${inner + 2}" rx="5"`,
      ` fill="none" stroke="${P.woodEdgeDeep}" stroke-opacity="0.45" stroke-width="2"/>`,
    ].join(""),
  );
}

/** Polished playing stone; `variant` is "black" or "white". */
function stoneSvg(size, variant) {
  const c = size / 2;
  const r = size * 0.42;
  const isBlack = variant === "black";
  const body = isBlack
    ? [
        `<radialGradient id="body" cx="34%" cy="28%" r="78%">`,
        `<stop offset="0%" stop-color="${P.blackSheen}"/>`,
        `<stop offset="34%" stop-color="#3a3a3a"/>`,
        `<stop offset="78%" stop-color="${P.black}"/>`,
        `<stop offset="100%" stop-color="${P.blackRim}"/>`,
        "</radialGradient>",
      ].join("")
    : [
        `<radialGradient id="body" cx="34%" cy="28%" r="80%">`,
        `<stop offset="0%" stop-color="${P.whiteSheen}"/>`,
        `<stop offset="46%" stop-color="${P.white}"/>`,
        `<stop offset="86%" stop-color="#e6dcc2"/>`,
        `<stop offset="100%" stop-color="${P.whiteRim}"/>`,
        "</radialGradient>",
      ].join("");
  return svgRoot(
    size,
    size,
    [
      "<defs>",
      body,
      `<radialGradient id="shadow" cx="50%" cy="50%" r="50%">`,
      `<stop offset="0%" stop-color="#3b2a10" stop-opacity="0.42"/>`,
      `<stop offset="70%" stop-color="#3b2a10" stop-opacity="0.16"/>`,
      `<stop offset="100%" stop-color="#3b2a10" stop-opacity="0"/>`,
      "</radialGradient>",
      `<radialGradient id="gloss" cx="50%" cy="50%" r="50%">`,
      `<stop offset="0%" stop-color="#ffffff" stop-opacity="${isBlack ? 0.5 : 0.92}"/>`,
      `<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>`,
      "</radialGradient>",
      "</defs>",
      `<ellipse cx="${c}" cy="${fixed(c + r * 0.18, 2)}" rx="${fixed(r * 1.02, 2)}" ry="${fixed(r * 0.9, 2)}" fill="url(#shadow)"/>`,
      `<circle cx="${c}" cy="${c}" r="${fixed(r, 2)}" fill="url(#body)"/>`,
      `<circle cx="${c}" cy="${c}" r="${fixed(r, 2)}" fill="none" stroke="${isBlack ? P.blackRim : P.whiteRim}"`,
      ` stroke-opacity="${isBlack ? 0.85 : 0.7}" stroke-width="${fixed(size * 0.012, 2)}"/>`,
      `<ellipse cx="${fixed(c - r * 0.3, 2)}" cy="${fixed(c - r * 0.34, 2)}" rx="${fixed(r * 0.36, 2)}" ry="${fixed(r * 0.26, 2)}"`,
      ` fill="url(#gloss)" transform="rotate(-28 ${fixed(c - r * 0.3, 2)} ${fixed(c - r * 0.34, 2)})"/>`,
      `<path d="M${fixed(c - r * 0.62, 2)} ${fixed(c + r * 0.5, 2)} A ${fixed(r * 0.8, 2)} ${fixed(r * 0.8, 2)} 0 0 0 ${fixed(c + r * 0.5, 2)} ${fixed(c + r * 0.62, 2)}"`,
      ` fill="none" stroke="#ffffff" stroke-opacity="${isBlack ? 0.12 : 0.34}" stroke-width="${fixed(size * 0.02, 2)}" stroke-linecap="round"/>`,
    ].join(""),
  );
}

/** Ring marking the most recent move. */
function lastMoveSvg(size) {
  const c = size / 2;
  return svgRoot(
    size,
    size,
    [
      "<defs>",
      `<radialGradient id="halo" cx="50%" cy="50%" r="50%">`,
      `<stop offset="52%" stop-color="${P.lastMove}" stop-opacity="0"/>`,
      `<stop offset="72%" stop-color="${P.lastMove}" stop-opacity="0.42"/>`,
      `<stop offset="100%" stop-color="${P.lastMove}" stop-opacity="0"/>`,
      "</radialGradient>",
      "</defs>",
      `<circle cx="${c}" cy="${c}" r="${fixed(size * 0.46, 2)}" fill="url(#halo)"/>`,
      `<circle cx="${c}" cy="${c}" r="${fixed(size * 0.3, 2)}" fill="none" stroke="${P.lastMove}" stroke-width="${fixed(size * 0.075, 2)}"/>`,
      `<circle cx="${c}" cy="${c}" r="${fixed(size * 0.1, 2)}" fill="${P.lastMove}"/>`,
    ].join(""),
  );
}

/** Horizontal glow stretched across the winning five stones. */
function winGlowSvg(width, height) {
  const mid = height / 2;
  const inset = height * 0.5;
  return svgRoot(
    width,
    height,
    [
      "<defs>",
      `<linearGradient id="along" x1="0%" y1="0%" x2="100%" y2="0%">`,
      `<stop offset="0%" stop-color="${P.winLine}" stop-opacity="0"/>`,
      `<stop offset="12%" stop-color="${P.winLineHot}" stop-opacity="0.95"/>`,
      `<stop offset="50%" stop-color="${P.winLineHot}" stop-opacity="1"/>`,
      `<stop offset="88%" stop-color="${P.winLineHot}" stop-opacity="0.95"/>`,
      `<stop offset="100%" stop-color="${P.winLine}" stop-opacity="0"/>`,
      "</linearGradient>",
      `<linearGradient id="across" x1="0%" y1="0%" x2="0%" y2="100%">`,
      `<stop offset="0%" stop-color="${P.winLine}" stop-opacity="0"/>`,
      `<stop offset="38%" stop-color="${P.winLine}" stop-opacity="0.55"/>`,
      `<stop offset="50%" stop-color="#ffffff" stop-opacity="0.85"/>`,
      `<stop offset="62%" stop-color="${P.winLine}" stop-opacity="0.55"/>`,
      `<stop offset="100%" stop-color="${P.winLine}" stop-opacity="0"/>`,
      "</linearGradient>",
      "</defs>",
      `<rect x="0" y="${fixed(mid - height * 0.34, 2)}" width="${width}" height="${fixed(height * 0.68, 2)}" rx="${fixed(height * 0.34, 2)}" fill="url(#along)" opacity="0.55"/>`,
      `<rect x="${fixed(inset, 2)}" y="${fixed(mid - height * 0.16, 2)}" width="${fixed(width - inset * 2, 2)}" height="${fixed(height * 0.32, 2)}" rx="${fixed(height * 0.16, 2)}" fill="url(#across)"/>`,
      `<rect x="${fixed(inset, 2)}" y="${fixed(mid - height * 0.05, 2)}" width="${fixed(width - inset * 2, 2)}" height="${fixed(height * 0.1, 2)}" rx="${fixed(height * 0.05, 2)}" fill="#ffffff" opacity="0.7"/>`,
    ].join(""),
  );
}

/** Lobby difficulty badge: stone token on a card with pip count. */
function difficultyBadgeSvg(size, { color, pips }) {
  const c = size / 2;
  const pipY = size * 0.78;
  const pipGap = size * 0.115;
  const pipStart = c - ((pips - 1) * pipGap) / 2;
  const pipShapes = [];
  for (let i = 0; i < pips; i += 1) {
    const cx = fixed(pipStart + i * pipGap, 2);
    pipShapes.push(
      `<circle cx="${cx}" cy="${fixed(pipY, 2)}" r="${fixed(size * 0.035, 2)}" fill="${color}"/>`,
    );
  }
  return svgRoot(
    size,
    size,
    [
      "<defs>",
      `<linearGradient id="cardbg" x1="0%" y1="0%" x2="0%" y2="100%">`,
      `<stop offset="0%" stop-color="#ffffff"/>`,
      `<stop offset="100%" stop-color="${P.card}"/>`,
      "</linearGradient>",
      `<radialGradient id="token" cx="36%" cy="30%" r="78%">`,
      `<stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>`,
      `<stop offset="42%" stop-color="${color}"/>`,
      `<stop offset="100%" stop-color="${color}" stop-opacity="0.82"/>`,
      "</radialGradient>",
      "</defs>",
      `<rect x="4" y="4" width="${size - 8}" height="${size - 8}" rx="${fixed(size * 0.18, 2)}" fill="url(#cardbg)"`,
      ` stroke="${color}" stroke-width="${fixed(size * 0.035, 2)}"/>`,
      `<rect x="${fixed(size * 0.11, 2)}" y="${fixed(size * 0.11, 2)}" width="${fixed(size * 0.78, 2)}" height="${fixed(size * 0.78, 2)}"`,
      ` rx="${fixed(size * 0.13, 2)}" fill="none" stroke="${P.gold}" stroke-opacity="0.35" stroke-width="1.5"/>`,
      `<circle cx="${c}" cy="${fixed(size * 0.44, 2)}" r="${fixed(size * 0.2, 2)}" fill="url(#token)"/>`,
      `<ellipse cx="${fixed(c - size * 0.06, 2)}" cy="${fixed(size * 0.38, 2)}" rx="${fixed(size * 0.07, 2)}" ry="${fixed(size * 0.045, 2)}"`,
      ` fill="#ffffff" fill-opacity="0.55" transform="rotate(-24 ${fixed(c - size * 0.06, 2)} ${fixed(size * 0.38, 2)})"/>`,
      pipShapes.join(""),
    ].join(""),
  );
}

/**
 * Neutral result seal — five stones in a row inside a ring.
 * Kept near-white so the scene can tint it per outcome.
 */
function resultSealSvg(size) {
  const c = size / 2;
  const stoneR = size * 0.055;
  const gap = size * 0.135;
  const stones = [];
  for (let i = 0; i < 5; i += 1) {
    const cx = fixed(c + (i - 2) * gap, 2);
    stones.push(
      `<circle cx="${cx}" cy="${c}" r="${fixed(stoneR, 2)}" fill="#3d3226"/>`,
      `<circle cx="${fixed(cx - stoneR * 0.28, 2)}" cy="${fixed(c - stoneR * 0.3, 2)}" r="${fixed(stoneR * 0.36, 2)}" fill="#ffffff" fill-opacity="0.55"/>`,
    );
  }
  const laurel = [];
  for (let i = 0; i < 14; i += 1) {
    const angle = 150 + i * 4.6;
    laurel.push(
      `<ellipse cx="${fixed(c + Math.cos((angle * Math.PI) / 180) * size * 0.4, 2)}"` +
        ` cy="${fixed(c + Math.sin((angle * Math.PI) / 180) * size * 0.4, 2)}"` +
        ` rx="${fixed(size * 0.045, 2)}" ry="${fixed(size * 0.018, 2)}" fill="#ffffff" fill-opacity="0.9"` +
        ` transform="rotate(${fixed(angle + 90, 1)} ${fixed(c + Math.cos((angle * Math.PI) / 180) * size * 0.4, 2)} ${fixed(c + Math.sin((angle * Math.PI) / 180) * size * 0.4, 2)})"/>`,
      `<ellipse cx="${fixed(c - Math.cos((angle * Math.PI) / 180) * size * 0.4, 2)}"` +
        ` cy="${fixed(c + Math.sin((angle * Math.PI) / 180) * size * 0.4, 2)}"` +
        ` rx="${fixed(size * 0.045, 2)}" ry="${fixed(size * 0.018, 2)}" fill="#ffffff" fill-opacity="0.9"` +
        ` transform="rotate(${fixed(-angle - 90, 1)} ${fixed(c - Math.cos((angle * Math.PI) / 180) * size * 0.4, 2)} ${fixed(c + Math.sin((angle * Math.PI) / 180) * size * 0.4, 2)})"/>`,
    );
  }
  return svgRoot(
    size,
    size,
    [
      "<defs>",
      `<radialGradient id="disc" cx="50%" cy="38%" r="70%">`,
      `<stop offset="0%" stop-color="#ffffff"/>`,
      `<stop offset="100%" stop-color="#e8e2d4"/>`,
      "</radialGradient>",
      "</defs>",
      `<circle cx="${c}" cy="${c}" r="${fixed(size * 0.36, 2)}" fill="url(#disc)"/>`,
      `<circle cx="${c}" cy="${c}" r="${fixed(size * 0.36, 2)}" fill="none" stroke="#ffffff" stroke-width="${fixed(size * 0.045, 2)}"/>`,
      `<circle cx="${c}" cy="${c}" r="${fixed(size * 0.3, 2)}" fill="none" stroke="#cfc6b2" stroke-width="1.5"/>`,
      laurel.join(""),
      stones.join(""),
    ].join(""),
  );
}

// ── Asset table ───────────────────────────────────────────────────────────────

function buildAssets() {
  const assets = [
    { name: "table-linen.webp", width: 420, height: 620, svg: () => tableLinenSvg(420, 620), quality: 82 },
    { name: "board-wood.webp", width: 388, height: 388, svg: () => boardWoodSvg(388), quality: 86 },
    { name: "stone-black.webp", width: 128, height: 128, svg: () => stoneSvg(128, "black") },
    { name: "stone-white.webp", width: 128, height: 128, svg: () => stoneSvg(128, "white") },
    { name: "last-move.webp", width: 72, height: 72, svg: () => lastMoveSvg(72) },
    { name: "win-glow.webp", width: 320, height: 64, svg: () => winGlowSvg(320, 64) },
    { name: "result-seal.webp", width: 176, height: 176, svg: () => resultSealSvg(176) },
  ];
  for (const diff of DIFFICULTIES) {
    assets.push({
      name: `badge-${diff.slug}.webp`,
      width: 160,
      height: 160,
      svg: () => difficultyBadgeSvg(160, diff),
    });
  }
  return assets;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const options = { out: path.resolve("apps/gomoku/public/art"), quality: 88 };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--out") {
      const value = argv[i + 1];
      if (!value) throw new Error("--out requires a directory path");
      options.out = path.resolve(value);
      i += 1;
    } else if (flag === "--quality") {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        throw new Error("--quality requires an integer between 1 and 100");
      }
      options.quality = value;
      i += 1;
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const assets = buildAssets();
  const results = [];
  for (const asset of assets) {
    const result = await writeSvgAsWebp(asset.svg(), path.join(options.out, asset.name), {
      width: asset.width,
      height: asset.height,
      supersample: 2,
      quality: asset.quality ?? options.quality,
    });
    results.push({ name: asset.name, ...result });
  }
  const total = results.reduce((sum, r) => sum + r.bytes, 0);
  for (const r of results) {
    process.stdout.write(
      `${r.name.padEnd(20)} ${String(r.width).padStart(4)}x${String(r.height).padEnd(4)} ${String(r.bytes).padStart(7)} B\n`,
    );
  }
  process.stdout.write(`${results.length} files, ${total} B total → ${options.out}\n`);
}

main().catch((error) => {
  process.stderr.write(`generate-gomoku-art failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
