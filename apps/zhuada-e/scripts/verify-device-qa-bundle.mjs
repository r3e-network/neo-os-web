#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { requiredProductionFiles } from "./verify-production-bundle.mjs";

export const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MAX_QA_SCENE_GZIP_BYTES = 130 * 1024;
const MAX_QA_ENTRY_GZIP_BYTES = 110 * 1024;
const MAX_QA_THREE_GZIP_BYTES = 145 * 1024;
const MAX_QA_PHYSICS_GZIP_BYTES = 35 * 1024;
const MAX_DEVICE_QA_PANEL_GZIP_BYTES = 12 * 1024;

const requiredFileNameParts = [
  "DeviceQaPanel",
];

const requiredRuntimeNeedles = [
  "Device QA",
  "zhuada-e-device-qa-v1",
  "zhuada-e:device-qa-render",
  "zhuada-e:device-qa-frame",
  "zhuada-e:device-qa-shake",
  "fresh-market",
  "farm-kitchen",
  "night-market",
];

const forbiddenRuntimeNeedles = [
  "debugWin",
  "debugLose",
  "debugShake",
  "DEBUG · ?debug=1",
  "强制胜利",
  "败·超时",
  "败·卡满",
];

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

function gzipBytes(file) {
  return gzipSync(fs.readFileSync(file)).length;
}

function findRuntimeChunk(files, prefix) {
  return files.find((file) => path.basename(file).startsWith(prefix) && file.endsWith(".js"));
}

export function verifyDeviceQaBundle({ root = defaultRoot } = {}) {
  const dist = path.join(root, "dist-device-qa");
  invariant(fs.existsSync(dist), "dist-device-qa/ does not exist; run npm run build:device-qa before verifying the Device QA bundle.");

  const files = walk(dist);
  const runtimeFiles = files.filter((file) => /\.(html|js|css|json)$/i.test(file));
  const relativeNames = files.map((file) => path.relative(dist, file).split(path.sep).join("/"));
  const relativeSet = new Set(relativeNames);
  const runtimeText = runtimeFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const jsFiles = files.filter((file) => file.endsWith(".js"));

  for (const required of requiredProductionFiles) {
    invariant(relativeSet.has(required), `Device QA bundle missing required asset: ${required}`);
    invariant(fs.statSync(path.join(dist, required)).size > 0, `Device QA bundle required asset is empty: ${required}`);
  }

  for (const part of requiredFileNameParts) {
    invariant(
      relativeNames.some((relative) => relative.includes(part)),
      `Device QA bundle is missing required QA chunk/file: ${part}`,
    );
  }

  for (const needle of requiredRuntimeNeedles) {
    invariant(runtimeText.includes(needle), `Device QA runtime is missing required instrumentation marker: ${needle}`);
  }

  for (const file of runtimeFiles) {
    const relative = path.relative(dist, file);
    const text = fs.readFileSync(file, "utf8");
    for (const needle of forbiddenRuntimeNeedles) {
      invariant(!text.includes(needle), `Device QA runtime leaked playtest shortcut in ${relative}: ${needle}`);
    }
  }

  const scene = findRuntimeChunk(jsFiles, "ZhuaDaScene-");
  const entry = findRuntimeChunk(jsFiles, "index-");
  const three = findRuntimeChunk(jsFiles, "three-render-");
  const physics = findRuntimeChunk(jsFiles, "physics-engine-");
  const panel = findRuntimeChunk(jsFiles, "DeviceQaPanel-");

  invariant(scene, "Device QA bundle must contain a ZhuaDaScene chunk.");
  invariant(entry, "Device QA bundle must contain an entry index chunk.");
  invariant(three, "Device QA bundle must split Three.js into a three-render chunk.");
  invariant(physics, "Device QA bundle must split cannon-es into a physics-engine chunk.");
  invariant(panel, "Device QA bundle must contain a DeviceQaPanel chunk.");

  const sceneGzip = gzipBytes(scene);
  const entryGzip = gzipBytes(entry);
  const threeGzip = gzipBytes(three);
  const physicsGzip = gzipBytes(physics);
  const panelGzip = gzipBytes(panel);

  invariant(
    sceneGzip <= MAX_QA_SCENE_GZIP_BYTES,
    `Device QA scene gzip budget exceeded: ${(sceneGzip / 1024).toFixed(1)} KiB > ${(MAX_QA_SCENE_GZIP_BYTES / 1024).toFixed(1)} KiB.`,
  );
  invariant(
    entryGzip <= MAX_QA_ENTRY_GZIP_BYTES,
    `Device QA entry gzip budget exceeded: ${(entryGzip / 1024).toFixed(1)} KiB > ${(MAX_QA_ENTRY_GZIP_BYTES / 1024).toFixed(1)} KiB.`,
  );
  invariant(
    threeGzip <= MAX_QA_THREE_GZIP_BYTES,
    `Device QA Three.js vendor gzip budget exceeded: ${(threeGzip / 1024).toFixed(1)} KiB > ${(MAX_QA_THREE_GZIP_BYTES / 1024).toFixed(1)} KiB.`,
  );
  invariant(
    physicsGzip <= MAX_QA_PHYSICS_GZIP_BYTES,
    `Device QA physics vendor gzip budget exceeded: ${(physicsGzip / 1024).toFixed(1)} KiB > ${(MAX_QA_PHYSICS_GZIP_BYTES / 1024).toFixed(1)} KiB.`,
  );
  invariant(
    panelGzip <= MAX_DEVICE_QA_PANEL_GZIP_BYTES,
    `Device QA panel gzip budget exceeded: ${(panelGzip / 1024).toFixed(1)} KiB > ${(MAX_DEVICE_QA_PANEL_GZIP_BYTES / 1024).toFixed(1)} KiB.`,
  );

  return {
    runtimeFiles: runtimeFiles.length,
    requiredFiles: requiredProductionFiles.length,
    scene: path.basename(scene),
    panel: path.basename(panel),
    sceneGzip,
    panelGzip,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = verifyDeviceQaBundle();
  console.log(`Device QA bundle gate passed: ${result.requiredFiles} required files present; ${result.runtimeFiles} runtime files scanned; QA instrumentation present, shortcuts absent, budgets OK (${result.scene} ${(result.sceneGzip / 1024).toFixed(1)} KiB gzip, ${result.panel} ${(result.panelGzip / 1024).toFixed(1)} KiB gzip).`);
}
