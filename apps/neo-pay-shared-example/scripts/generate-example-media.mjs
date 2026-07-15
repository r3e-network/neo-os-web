import { resolve } from "node:path";
import sharp from "sharp";

/**
 * Store-media generator for NeoPay Stream Studio (the shared-runtime
 * developer example of NeoPay).
 *
 * The example app deliberately stays in the NeoPay product family, but its
 * catalog media must not be byte-identical to NeoPay's own media
 * (audit:miniapps:media enforces unique banner/icon content per app).
 *
 * This script derives the example's banner and icon from the repository-owned
 * NeoPay family renders with a distinct treatment:
 *   - the family accent is re-graded from teal-green to indigo, and
 *   - a developer-example label strip / badge is composited on top,
 * so the store card reads unmistakably as the developer example while keeping
 * the family visual identity described in ASSET_PROVENANCE.md.
 */

const appRoot = resolve(import.meta.dirname, "..");
const familyPublicDir = resolve(appRoot, "..", "neo-pay", "public");
const publicDir = resolve(appRoot, "public");

const EXAMPLE_HUE_ROTATION = 150; // teal-green family accent -> indigo example accent
const STRIP_COLOR = "#443CBF";
const STRIP_TEXT = "#FFFFFF";

function bannerOverlay(width, height) {
  const stripHeight = 56;
  const stripTop = height - stripHeight;
  const textY = stripTop + 36;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0" y="${stripTop}" width="${width}" height="${stripHeight}" fill="${STRIP_COLOR}"/>
  <text x="48" y="${textY}" fill="${STRIP_TEXT}" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="4">DEVELOPER EXAMPLE</text>
  <text x="${width - 48}" y="${textY}" text-anchor="end" fill="${STRIP_TEXT}" opacity="0.88" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="600" letter-spacing="3">NEOPAY SHARED RUNTIME</text>
</svg>`);
}

function logoBadge(size) {
  const badge = Math.round(size * 0.34);
  const margin = Math.round(size * 0.045);
  const x = size - badge - margin;
  const y = size - badge - margin;
  const radius = Math.round(badge * 0.3);
  const fontSize = Math.round(badge * 0.44);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect x="${x}" y="${y}" width="${badge}" height="${badge}" rx="${radius}" fill="${STRIP_COLOR}"/>
  <text x="${x + badge / 2}" y="${y + badge * 0.62}" text-anchor="middle" fill="${STRIP_TEXT}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700">&lt;/&gt;</text>
</svg>`);
}

async function buildBanner() {
  const source = resolve(familyPublicDir, "banner.webp");
  const { width, height } = await sharp(source).metadata();
  const graded = await sharp(source)
    .modulate({ hue: EXAMPLE_HUE_ROTATION })
    .toBuffer();
  const banner = sharp(graded).composite([
    { input: bannerOverlay(width, height), top: 0, left: 0 },
  ]);
  await banner
    .clone()
    .webp({ quality: 86, effort: 6 })
    .toFile(resolve(publicDir, "banner.webp"));
  await sharp(resolve(publicDir, "banner.webp"))
    .avif({ quality: 72, effort: 6 })
    .toFile(resolve(publicDir, "banner.avif"));
}

async function buildLogo() {
  const source = resolve(familyPublicDir, "logo.webp");
  const { width } = await sharp(source).metadata();
  const graded = await sharp(source)
    .modulate({ hue: EXAMPLE_HUE_ROTATION })
    .toBuffer();
  const logo = sharp(graded).composite([
    { input: logoBadge(width), top: 0, left: 0 },
  ]);
  await logo
    .clone()
    .webp({ quality: 91, effort: 6 })
    .toFile(resolve(publicDir, "logo.webp"));
  await sharp(resolve(publicDir, "logo.webp"))
    .avif({ quality: 80, effort: 6 })
    .toFile(resolve(publicDir, "logo.avif"));
}

await buildBanner();
await buildLogo();
