#!/usr/bin/env node
/**
 * generate-art.mjs — renders the ORIGINAL Catch-the-Goose brand assets.
 *
 * Draws our own goose motif (the same primitive side-profile design as
 * src/GooseChip.tsx / scenes/models.ts buildGoose: round body, S-neck, orange
 * beak) as inline SVG and rasterizes it with sharp into the formats the shared
 * shell + host expect:
 *
 *   public/logo.png   512×512   (index.html favicon + overlay mascot)
 *   public/logo.webp  512×512   (MiniAppRoot appLogoUrl)
 *   public/logo.avif  512×512
 *   public/banner.png 1024×512  (index.html og:image)
 *   public/banner.webp 1024×512 (MiniAppRoot appBannerUrl)
 *   public/banner.avif 1024×512
 *
 * 100% generated art — no downloaded/copied assets, rerun to regenerate:
 *   node scripts/generate-art.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(appDir, "public");

// Palette — matches the app's design (pen green, beak orange, warm paper).
const GREEN = "#16c784";
const GREEN_DEEP = "#0ea371";
const ORANGE = "#f59e0b";
const BODY = "#f7f7f2";
const BODY_SHADE = "#e7e4da";
const INK = "#20242a";
const PAPER = "#f7f3ec";
const PAPER_EDGE = "#efe7d8";

/** Our goose (side profile, facing right), centered in a 100×100 box. */
function gooseMotif(x, y, s) {
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <!-- body + tail -->
    <ellipse cx="40" cy="66" rx="33" ry="24" fill="${BODY}"/>
    <path d="M10 57 L1 48 L15 51 Z" fill="${BODY_SHADE}"/>
    <!-- wing -->
    <ellipse cx="34" cy="65" rx="17" ry="11" fill="${BODY_SHADE}"/>
    <!-- neck + head -->
    <path d="M52 50 Q55 33 60 27 L74 33 Q68 43 67 56 Z" fill="${BODY}"/>
    <circle cx="65" cy="28" r="14.5" fill="${BODY}"/>
    <!-- beak -->
    <path d="M78 24 L95 28.5 L78.5 34 Z" fill="${ORANGE}"/>
    <!-- eye -->
    <circle cx="70" cy="24.5" r="3" fill="${INK}"/>
    <!-- green scarf: ties the mascot to the pen brand color -->
    <path d="M52.5 47 Q59 50.5 66.5 48 L66 55.5 Q58.5 58 52 54.5 Z" fill="${GREEN}"/>
    <!-- feet -->
    <path d="M30 88 L26 96 L36 94 Z" fill="${ORANGE}"/>
    <path d="M50 89 L48 97 L58 94 Z" fill="${ORANGE}"/>
  </g>`;
}

/** Pen rim arc + scattered produce dots (echoes the 3D pen + item pile). */
function penRing(cx, cy, r) {
  return `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GREEN}" stroke-width="${r * 0.075}" opacity="0.9"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.86}" fill="none" stroke="${GREEN_DEEP}" stroke-width="${r * 0.02}" opacity="0.35"/>`;
}

function produceDots(seed, cx, cy, spread, n) {
  // deterministic scatter (mulberry32) — same art every regeneration
  let a = seed >>> 0;
  const rng = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const colors = ["#ef4444", "#f59e0b", "#8b5cf6", "#22c55e", "#0ea371", "#38bdf8", "#fde68a"];
  let out = "";
  for (let i = 0; i < n; i += 1) {
    const ang = rng() * Math.PI * 2;
    const dist = spread * (0.55 + rng() * 0.45);
    const px = cx + Math.cos(ang) * dist;
    const py = cy + Math.sin(ang) * dist * 0.6;
    const pr = 6 + rng() * 9;
    out += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${pr.toFixed(1)}" fill="${colors[i % colors.length]}" opacity="0.85"/>`;
  }
  return out;
}

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PAPER}"/>
      <stop offset="1" stop-color="${PAPER_EDGE}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="104" fill="url(#bg)"/>
  ${penRing(256, 256, 216)}
  ${gooseMotif(106, 96, 3.1)}
</svg>`;

const bannerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512" viewBox="0 0 1024 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PAPER}"/>
      <stop offset="0.6" stop-color="${PAPER_EDGE}"/>
      <stop offset="1" stop-color="#e7f7f1"/>
    </linearGradient>
    <linearGradient id="pen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${GREEN}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${GREEN}" stop-opacity="0.04"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="512" fill="url(#bg)"/>
  <!-- pen floor -->
  <ellipse cx="512" cy="430" rx="470" ry="120" fill="url(#pen)"/>
  <ellipse cx="512" cy="430" rx="470" ry="120" fill="none" stroke="${GREEN}" stroke-width="10" opacity="0.65"/>
  <!-- scattered produce pile -->
  ${produceDots(20260710, 300, 400, 200, 9)}
  ${produceDots(424242, 760, 405, 170, 8)}
  <!-- the runaway goose, big and centered -->
  ${gooseMotif(350, 105, 3.4)}
  <!-- brand dots echoing the 7-slot tray -->
  <g opacity="0.9">
    ${Array.from({ length: 7 }, (_, i) =>
      `<circle cx="${400 + i * 36}" cy="62" r="11" fill="${i < 3 ? GREEN : "#ffffff"}" stroke="${GREEN_DEEP}" stroke-width="3"/>`,
    ).join("")}
  </g>
</svg>`;

async function emit(svg, base, width, height) {
  const src = sharp(Buffer.from(svg), { density: 144 }).resize(width, height);
  await src.clone().png().toFile(path.join(outDir, `${base}.png`));
  await src.clone().webp({ quality: 88 }).toFile(path.join(outDir, `${base}.webp`));
  await src.clone().avif({ quality: 60 }).toFile(path.join(outDir, `${base}.avif`));
}

fs.mkdirSync(outDir, { recursive: true });
await emit(logoSvg, "logo", 512, 512);
await emit(bannerSvg, "banner", 1024, 512);
for (const f of ["logo.png", "logo.webp", "logo.avif", "banner.png", "banner.webp", "banner.avif"]) {
  const st = fs.statSync(path.join(outDir, f));
  console.log(`${f}\t${st.size} bytes`);
}
