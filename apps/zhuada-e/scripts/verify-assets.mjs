import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const sourceDir = path.join(root, "art-src");
const themes = ["fresh-market", "farm-kitchen", "night-market"];
const itemCount = 54;
const cues = [
  "land", "pick", "match", "combo", "comboBreak", "traySlot",
  "win", "fail", "powerup", "shuffle", "click", "tick", "unlock", "shake",
];
const ambiences = ["ambient-garden", "ambient-kitchen", "ambient-night"];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function verifySourceManifest() {
  const manifestText = await fs.readFile(path.join(sourceDir, "SOURCE_MANIFEST.md"), "utf8");
  // SOURCE_MANIFEST.md is sha256sum output: 64 hex digits, exactly two spaces,
  // then the file name. The {2} quantifier states that count explicitly so it
  // cannot be miscounted when the line is edited.
  const entries = [...manifestText.matchAll(/^([a-f0-9]{64}) {2}([^/\n]+\.png)$/gm)];
  invariant(entries.length === 23, `source manifest: expected 23 PNG entries, got ${entries.length}`);
  for (const [, expected, name] of entries) {
    const bytes = await fs.readFile(path.join(sourceDir, name));
    const actual = createHash("sha256").update(bytes).digest("hex");
    invariant(actual === expected, `source manifest mismatch: ${name}`);
  }
}

async function verifyTransparentPortrait(relative) {
  await verifyImage(relative, 512, 512, { alpha: true });
  const { data, info } = await sharp(path.join(publicDir, relative))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => data[(y * info.width + x) * 4 + 3];
  for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) {
    invariant(alphaAt(x, y) === 0, `${relative}: every corner must be fully transparent`);
  }
  let visible = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (alphaAt(x, y) < 16) continue;
      visible += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const coverage = visible / (info.width * info.height);
  invariant(coverage >= 0.2 && coverage <= 0.45,
    `${relative}: expected 20-45% subject coverage, got ${(coverage * 100).toFixed(1)}%`);
  invariant(minX >= 8 && minY >= 8 && maxX <= 503 && maxY <= 503,
    `${relative}: subject must retain transparent padding on every side`);
}

async function verifyImage(relative, width, height, { alpha = false } = {}) {
  const absolute = path.join(publicDir, relative);
  const metadata = await sharp(absolute).metadata();
  invariant(metadata.width === width && metadata.height === height,
    `${relative}: expected ${width}x${height}, got ${metadata.width}x${metadata.height}`);
  if (alpha) invariant(metadata.hasAlpha === true, `${relative}: transparent alpha channel is required`);
  const stat = await fs.stat(absolute);
  invariant(stat.size > 256, `${relative}: output is unexpectedly small (${stat.size} bytes)`);
}

async function verifyWav(relative, minimumSeconds) {
  const absolute = path.join(publicDir, relative);
  const bytes = await fs.readFile(absolute);
  invariant(bytes.length >= 44, `${relative}: truncated WAV header`);
  invariant(bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE",
    `${relative}: expected RIFF/WAVE PCM`);
  invariant(bytes.toString("ascii", 12, 16) === "fmt " && bytes.toString("ascii", 36, 40) === "data",
    `${relative}: unsupported WAV chunk layout`);
  const format = bytes.readUInt16LE(20);
  const channels = bytes.readUInt16LE(22);
  const sampleRate = bytes.readUInt32LE(24);
  const byteRate = bytes.readUInt32LE(28);
  const bitsPerSample = bytes.readUInt16LE(34);
  const dataBytes = bytes.readUInt32LE(40);
  invariant(format === 1 && channels === 2 && sampleRate === 44100 && bitsPerSample === 16,
    `${relative}: expected stereo 44.1kHz 16-bit PCM`);
  invariant(byteRate > 0 && dataBytes <= bytes.length - 44, `${relative}: invalid data length`);
  const duration = dataBytes / byteRate;
  invariant(duration >= minimumSeconds,
    `${relative}: expected at least ${minimumSeconds}s, got ${duration.toFixed(3)}s`);
}

const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(await fs.readFile(path.join(root, "neo-manifest.json"), "utf8"));
const appVersionSource = await fs.readFile(path.join(root, "src", "app-version.ts"), "utf8");
const appVersion = appVersionSource.match(/APP_VERSION\s*=\s*["']([^"']+)["']/)?.[1];
invariant(packageJson.version === manifest.version,
  `package/manifest version mismatch (${packageJson.version} vs ${manifest.version})`);
invariant(packageJson.version === appVersion,
  `package/app-version mismatch (${packageJson.version} vs ${appVersion ?? "missing"})`);
invariant(manifest.id === "miniapp-zhuada-e", `unexpected manifest id: ${manifest.id}`);
invariant(manifest.urls?.entry === "/miniapps/zhuada-e/index.html", "manifest entry URL drifted");
await verifySourceManifest();
const publicNotices = await fs.readFile(path.join(publicDir, "THIRD_PARTY_NOTICES.txt"), "utf8");
for (const requiredNotice of [
  "React", "Lucide", "ISC License", "@noble/hashes", "@noble/curves",
  "three.js", "cannon-es", "MIT License",
]) {
  invariant(publicNotices.includes(requiredNotice), `public notices missing ${requiredNotice}`);
}
const referenceCompliance = await fs.readFile(path.join(root, "REFERENCE-IMPLEMENTATION-COMPLIANCE.md"), "utf8");
for (const requiredBoundary of [
  "does not specify a license",
  "CC 4.0 BY-SA",
  "Do not copy article code or assets",
  "Do not extract or reproduce art",
  "ASSET_PROVENANCE.md",
  "THIRD_PARTY_NOTICES.md",
]) {
  invariant(referenceCompliance.includes(requiredBoundary),
    `reference compliance missing boundary: ${requiredBoundary}`);
}

for (const format of ["png", "webp", "avif"]) {
  await verifyImage(`logo.${format}`, 512, 512);
  await verifyImage(`banner.${format}`, 1024, 512);
}

for (const theme of themes) {
  await verifyImage(`art/theme-${theme}.webp`, 768, 1152);
  await verifyImage(`art/mascot-${theme}.webp`, 512, 512);
  await verifyImage(`art/container-${theme}.webp`, 1024, 1024);
  for (let index = 0; index < itemCount; index += 1) {
    await verifyImage(
      `art/items/${theme}/item-${String(index).padStart(2, "0")}.webp`,
      256,
      256,
      { alpha: true },
    );
  }
}

for (let index = 0; index < 9; index += 1) {
  await verifyTransparentPortrait(`art/geese/goose-${String(index).padStart(2, "0")}.webp`);
}

for (const cue of cues) await verifyWav(`audio/${cue}.wav`, 0.05);
for (const ambience of ambiences) await verifyWav(`audio/${ambience}.wav`, 5.5);

console.log(`Asset gate passed: 186 images + ${cues.length + ambiences.length} PCM audio files · v${packageJson.version}`);
