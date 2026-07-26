/**
 * Shared SVG → raster helpers for the in-repo asset generators.
 *
 * Every generator that composes vector art in code and needs a deterministic
 * webp/png on disk goes through here, so supersampling, quality settings and
 * directory creation stay identical across scripts instead of being re-derived
 * (and drifting) in each one.
 *
 * Supersampling: librsvg rasterises at `density` DPI where 96 DPI == 1 CSS px.
 * Rendering at `96 * supersample` and letting sharp downscale to the declared
 * SVG size gives clean edges without shipping oversized files.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BASE_DENSITY = 96;

/** Deterministic mulberry32 PRNG so generated grain/noise is reproducible. */
export function createSeededRandom(seed) {
  let state = Number(seed) >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Round to a fixed precision so emitted SVG text is byte-stable. */
export function fixed(value, digits = 2) {
  return Number.parseFloat(Number(value).toFixed(digits));
}

function assertPositiveInt(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer, received ${String(value)}`);
  }
}

function toPipeline(svg, { width, height, supersample }) {
  if (typeof svg !== "string" || svg.trim() === "") {
    throw new TypeError("svg must be a non-empty string");
  }
  assertPositiveInt("width", width);
  assertPositiveInt("height", height);
  if (!Number.isFinite(supersample) || supersample < 1) {
    throw new TypeError(`supersample must be >= 1, received ${String(supersample)}`);
  }
  return sharp(Buffer.from(svg), { density: Math.round(BASE_DENSITY * supersample) }).resize(
    width,
    height,
    { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } },
  );
}

/**
 * Rasterise an SVG string to a webp buffer.
 * @param {string} svg inline SVG markup with explicit width/height in px
 * @param {{width:number,height:number,supersample?:number,quality?:number,lossless?:boolean}} options
 * @returns {Promise<Buffer>}
 */
export async function svgToWebpBuffer(svg, options) {
  const { width, height, supersample = 2, quality = 88, lossless = false } = options ?? {};
  return toPipeline(svg, { width, height, supersample })
    .webp({ quality, lossless, effort: 6 })
    .toBuffer();
}

/**
 * Rasterise an SVG string to a webp file, creating parent directories.
 * @returns {Promise<{file:string,bytes:number,width:number,height:number}>}
 */
export async function writeSvgAsWebp(svg, outFile, options) {
  const { width, height } = options ?? {};
  const buffer = await svgToWebpBuffer(svg, options);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, buffer);
  return { file: outFile, bytes: buffer.length, width, height };
}

/** Rasterise an SVG string to a png buffer (icons, contact sheets). */
export async function svgToPngBuffer(svg, options) {
  const { width, height, supersample = 2, compressionLevel = 9 } = options ?? {};
  return toPipeline(svg, { width, height, supersample })
    .png({ compressionLevel })
    .toBuffer();
}

/** Rasterise an SVG string to a png file, creating parent directories. */
export async function writeSvgAsPng(svg, outFile, options) {
  const buffer = await svgToPngBuffer(svg, options);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, buffer);
  return { file: outFile, bytes: buffer.length };
}
