#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist/assets");

const MAX_SCENE_GZIP_BYTES = 125 * 1024;
// The colorway identity and opening-palette guardrails add a small deterministic
// HSL resolver to the entry. Keep the budget tight while allowing that runtime
// fidelity code (the 0.25 KiB step is still below one compressed texture tile).
const MAX_ENTRY_GZIP_BYTES = 106.5 * 1024;
const MAX_THREE_GZIP_BYTES = 145 * 1024;
const MAX_PHYSICS_GZIP_BYTES = 35 * 1024;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function gzipBytes(file) {
  return gzipSync(fs.readFileSync(file)).length;
}

invariant(fs.existsSync(dist), "dist/assets does not exist; run npm run build before checking bundle budgets.");

const files = fs.readdirSync(dist).filter((file) => file.endsWith(".js"));
const findChunk = (prefix) => files.find((file) => file.startsWith(prefix) && file.endsWith(".js"));

const scene = findChunk("ZhuaDaScene-");
const entry = findChunk("index-");
const three = findChunk("three-render-");
const physics = findChunk("physics-engine-");

invariant(scene, "Production bundle must contain a ZhuaDaScene chunk.");
invariant(entry, "Production bundle must contain an entry index chunk.");
invariant(three, "Production bundle must split Three.js into a three-render chunk.");
invariant(physics, "Production bundle must split cannon-es into a physics-engine chunk.");

const sceneGzip = gzipBytes(path.join(dist, scene));
const entryGzip = gzipBytes(path.join(dist, entry));
const threeGzip = gzipBytes(path.join(dist, three));
const physicsGzip = gzipBytes(path.join(dist, physics));

invariant(
  sceneGzip <= MAX_SCENE_GZIP_BYTES,
  `ZhuaDaScene gzip budget exceeded: ${(sceneGzip / 1024).toFixed(1)} KiB > ${(MAX_SCENE_GZIP_BYTES / 1024).toFixed(1)} KiB.`,
);
invariant(
  entryGzip <= MAX_ENTRY_GZIP_BYTES,
  `Entry gzip budget exceeded: ${(entryGzip / 1024).toFixed(1)} KiB > ${(MAX_ENTRY_GZIP_BYTES / 1024).toFixed(1)} KiB.`,
);
invariant(
  threeGzip <= MAX_THREE_GZIP_BYTES,
  `Three.js vendor gzip budget exceeded: ${(threeGzip / 1024).toFixed(1)} KiB > ${(MAX_THREE_GZIP_BYTES / 1024).toFixed(1)} KiB.`,
);
invariant(
  physicsGzip <= MAX_PHYSICS_GZIP_BYTES,
  `Physics vendor gzip budget exceeded: ${(physicsGzip / 1024).toFixed(1)} KiB > ${(MAX_PHYSICS_GZIP_BYTES / 1024).toFixed(1)} KiB.`,
);

console.log(`Bundle budget gate passed: ${scene} ${(sceneGzip / 1024).toFixed(1)} KiB gzip, ${entry} ${(entryGzip / 1024).toFixed(1)} KiB gzip, ${three} ${(threeGzip / 1024).toFixed(1)} KiB gzip, ${physics} ${(physicsGzip / 1024).toFixed(1)} KiB gzip.`);
