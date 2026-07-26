#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const forbiddenFileNameParts = [
  "DeviceQaPanel",
];

const forbiddenRuntimeNeedles = [
  "Device QA",
  "DeviceQaPanel",
  "deviceQa=1",
  "debugWin",
  "debugLose",
  "debugShake",
  "DEBUG · ?debug=1",
  "强制胜利",
  "败·超时",
  "败·卡满",
];

const themes = ["fresh-market", "farm-kitchen", "night-market"];
const cues = [
  "land", "pick", "match", "combo", "win", "fail", "powerup", "shuffle",
  "click", "tick", "unlock", "shake",
];
const ambiences = ["ambient-garden", "ambient-kitchen", "ambient-night"];

export const requiredProductionFiles = Object.freeze([
  "index.html",
  "neo-manifest.json",
  "THIRD_PARTY_NOTICES.txt",
  ...["png", "webp", "avif"].flatMap((format) => [`logo.${format}`, `banner.${format}`]),
  ...themes.flatMap((theme) => [
    `art/theme-${theme}.webp`,
    `art/mascot-${theme}.webp`,
    `art/container-${theme}.webp`,
    ...Array.from({ length: 54 }, (_, index) => (
      `art/items/${theme}/item-${String(index).padStart(2, "0")}.webp`
    )),
  ]),
  ...Array.from({ length: 9 }, (_, index) => `art/geese/goose-${String(index).padStart(2, "0")}.webp`),
  ...cues.map((cue) => `audio/${cue}.wav`),
  ...ambiences.map((ambience) => `audio/${ambience}.wav`),
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(absolute));
    else out.push(absolute);
  }
  return out;
}

export function verifyProductionBundle({ root = defaultRoot } = {}) {
  const dist = path.join(root, "dist");
  invariant(fs.existsSync(dist), "dist/ does not exist; run npm run build before verifying the production bundle.");

  const files = walk(dist);
  const relativeFiles = new Set(files.map((file) => path.relative(dist, file).split(path.sep).join("/")));
  for (const required of requiredProductionFiles) {
    invariant(relativeFiles.has(required), `production bundle missing required asset: ${required}`);
    invariant(fs.statSync(path.join(dist, required)).size > 0, `production bundle required asset is empty: ${required}`);
  }

  for (const file of files) {
    const relative = path.relative(dist, file);
    for (const part of forbiddenFileNameParts) {
      invariant(!relative.includes(part), `production bundle contains QA/debug chunk: ${relative}`);
    }
  }

  const runtimeFiles = files.filter((file) => /\.(html|js|css|json)$/i.test(file));
  for (const file of runtimeFiles) {
    const relative = path.relative(dist, file);
    const text = fs.readFileSync(file, "utf8");
    for (const needle of forbiddenRuntimeNeedles) {
      invariant(!text.includes(needle), `production runtime leak in ${relative}: ${needle}`);
    }
  }
  return { runtimeFiles: runtimeFiles.length, requiredFiles: requiredProductionFiles.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = verifyProductionBundle();
  console.log(`Production bundle gate passed: ${result.requiredFiles} required files present; ${result.runtimeFiles} runtime files scanned; no Device QA or playtest debug runtime leaked.`);
}
