import { resolve } from "node:path";
import sharp from "sharp";

/**
 * Stage-banner generator for Oracle VRF Workbench.
 *
 * The Oracle console family shares one repository-owned workspace render
 * (added in commit 488fa04ec; oracle-neodid-console keeps it verbatim as its
 * warm identity stage). audit:miniapps:media requires each app's banner
 * content to be unique, so the VRF console derives its own graded variant
 * instead of shipping the identical bytes:
 *   - a cool white-balance grade (randomness/VRF identity, vs NeoDID's warm
 *     original),
 *   - a violet corner vignette, and
 *   - a slim violet accent bar along the bottom edge.
 * The result is used both as the in-app hero scene and the catalog banner.
 */

const appRoot = resolve(import.meta.dirname, "..");
const baseStage = resolve(
  appRoot,
  "..",
  "oracle-neodid-console",
  "public",
  "oracle-workspace-stage.webp",
);
const output = resolve(appRoot, "public", "oracle-workspace-stage.webp");

const { width, height } = await sharp(baseStage).metadata();

const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="vignette" cx="50%" cy="42%" r="75%">
      <stop offset="58%" stop-color="#5B4FE0" stop-opacity="0"/>
      <stop offset="100%" stop-color="#4636B8" stop-opacity="0.30"/>
    </radialGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6C5CE7"/>
      <stop offset="0.5" stop-color="#8E7BFF"/>
      <stop offset="1" stop-color="#5B4FE0"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#vignette)"/>
  <rect x="0" y="${height - 14}" width="${width}" height="14" fill="url(#accent)"/>
</svg>`);

const graded = await sharp(baseStage)
  .linear([0.93, 0.99, 1.12], [0, 0, 6])
  .toBuffer();

const composed = await sharp(graded)
  .composite([{ input: overlay, top: 0, left: 0 }])
  .toBuffer();

await sharp(composed).webp({ quality: 86, effort: 6 }).toFile(output);
