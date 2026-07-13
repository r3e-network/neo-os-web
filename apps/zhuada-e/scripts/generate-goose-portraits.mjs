#!/usr/bin/env node
/**
 * Procedurally render the Chapter 2 collection-goose portraits (ids 6/7/8)
 * from their GooseVariant specs in src/logic/scenes.ts.
 *
 * Why procedural: the first six geese ship as approved ImageGen masters
 * (art-src/goose-collection-0X.png → scripts/generate-art.mjs). The three new
 * chapter-2 geese (volcano / cloud / abyss) are defined ONLY by a GooseVariant
 * (body / scarf / hat / hatColor / hatAccent) — there is no painted master.
 * Rather than depend on an external raster generator, we build a clean,
 * theme-accurate SVG goose from that exact data and rasterize to the same
 * 512×512 transparent webp the collection book expects. This keeps the portraits
 * in lockstep with the in-game goose geometry and needs zero binary assets.
 *
 * The script reads scenes.ts as TEXT and regex-extracts the goose blocks, so it
 * tracks the source of truth without a TS import (same pattern as tune.mjs).
 *
 * Asset gate (scripts/verify-assets.mjs) requires, per goose webp:
 *   512×512, transparent alpha, 20–45% subject coverage, transparent corners,
 *   subject padded ≥8px on every side. The SVG below is sized to satisfy all of
 *   these; a post-write self-check logs the measured coverage and warns if it
 *   drifts out of band.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenesPath = path.join(appDir, "src", "logic", "scenes.ts");
const geeseDir = path.join(appDir, "public", "art", "geese");

/** Scene ids this script is responsible for (chapter 2). */
const TARGET_IDS = [6, 7, 8];

const hex = (n) => "#" + n.toString(16).padStart(6, "0");

function parseVariant(block) {
  const hexes = [...block.matchAll(/0x([0-9a-fA-F]{6})/g)].map((m) => parseInt(m[1], 16));
  const hat = (block.match(/hat:\s*"([a-z]+)"/) || [])[1];
  return {
    body: hexes[0],
    scarf: hexes[1],
    hat,
    hatColor: hexes[2],
    hatAccent: hexes[3],
  };
}

function hatSvg(v) {
  const stroke = 'stroke="#2b2b2b" stroke-width="6" stroke-linejoin="round"';
  if (v.hat === "party") {
    return `
      <path d="M196 112 L256 34 L316 112 Z" fill="${hex(v.hatColor)}" ${stroke}/>
      <circle cx="256" cy="30" r="10" fill="${hex(v.hatAccent)}" ${stroke}/>
      <circle cx="234" cy="82" r="7" fill="${hex(v.hatAccent)}"/>
      <circle cx="278" cy="82" r="7" fill="${hex(v.hatAccent)}"/>
      <circle cx="256" cy="60" r="7" fill="${hex(v.hatAccent)}"/>`;
  }
  if (v.hat === "beanie") {
    return `
      <path d="M184 122 Q184 40 256 40 Q328 40 328 122 Z" fill="${hex(v.hatColor)}" ${stroke}/>
      <rect x="178" y="114" width="156" height="20" rx="10" fill="${hex(v.hatAccent)}" ${stroke}/>
      <circle cx="256" cy="34" r="13" fill="${hex(v.hatAccent)}" ${stroke}/>`;
  }
  // cap (sailor / billed)
  return `
      <path d="M194 118 Q194 46 256 46 Q318 46 318 118 Z" fill="${hex(v.hatColor)}" ${stroke}/>
      <path d="M312 94 Q374 94 374 116 Q374 134 312 130 Z" fill="${hex(v.hatColor)}" ${stroke}/>
      <rect x="194" y="110" width="124" height="14" rx="7" fill="${hex(v.hatAccent)}" ${stroke}/>`;
}

function gooseSvg(v) {
  const body = hex(v.body);
  const scarf = hex(v.scarf);
  const beak = "#f5a623";
  const wing = "#e9e9e1";
  const stroke = 'stroke="#2b2b2b" stroke-width="6" stroke-linejoin="round"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <ellipse cx="256" cy="338" rx="108" ry="128" fill="${body}" ${stroke}/>
    <ellipse cx="196" cy="340" rx="44" ry="74" fill="${wing}" ${stroke} transform="rotate(-12 196 340)"/>
    <ellipse cx="228" cy="470" rx="22" ry="12" fill="${beak}" ${stroke}/>
    <ellipse cx="284" cy="470" rx="22" ry="12" fill="${beak}" ${stroke}/>
    <circle cx="256" cy="172" r="80" fill="${body}" ${stroke}/>
    <path d="M180 232 Q256 282 332 232 L332 258 Q256 308 180 258 Z" fill="${scarf}" ${stroke}/>
    <path d="M300 252 L322 322 L292 318 Z" fill="${scarf}" ${stroke}/>
    <path d="M330 168 L386 184 L330 200 Z" fill="${beak}" ${stroke}/>
    <circle cx="286" cy="158" r="11" fill="#2b2b2b"/>
    <circle cx="290" cy="154" r="3.5" fill="#ffffff"/>
    ${hatSvg(v)}
  </svg>`;
}

async function coverageOf(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visible = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= 16) visible += 1;
  }
  return visible / (info.width * info.height);
}

const src = await fs.readFile(scenesPath, "utf8");
const blocks = [...src.matchAll(/goose:\s*\{([^}]*)\}/g)].map((m) => m[1]);
const variants = TARGET_IDS.map((id) => {
  const block = blocks[id];
  if (!block) throw new Error(`scenes.ts has no goose block at index ${id}`);
  return { id, variant: parseVariant(block) };
});

await fs.mkdir(geeseDir, { recursive: true });

for (const { id, variant } of variants) {
  const svg = gooseSvg(variant);
  const out = path.join(geeseDir, `goose-${String(id).padStart(2, "0")}.webp`);
  await sharp(Buffer.from(svg)).webp({ quality: 92, alphaQuality: 100, effort: 6 }).toFile(out);
  const cov = await coverageOf(out);
  const ok = cov >= 0.2 && cov <= 0.45;
  const stat = await fs.stat(out);
  console.log(`goose-${String(id).padStart(2, "0")}.webp\t${stat.size} bytes\tcoverage ${(cov * 100).toFixed(1)}%${ok ? "" : "  ⚠ OUT OF BAND"}`);
}
console.log("Chapter 2 goose portraits rendered from GooseVariant specs.");
