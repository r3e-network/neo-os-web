#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SCHEMA = "zhuada-e-simulator-qa-v1";
const REQUIRED_THEMES = ["fresh-market", "farm-kitchen", "night-market"];

function usage() {
  console.error([
    "Usage: node scripts/verify-simulator-qa-evidence.mjs <evidence.json> [--no-file-check]",
    "",
    "Verifies local iOS/Android simulator smoke evidence for zhuada-e.",
    "This does not replace the physical Device QA release gate; it proves the",
    "checked-in simulator run captured a real playable surface and Android pick.",
  ].join("\n"));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read simulator QA evidence JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function stringAt(root, key) {
  const value = root[key];
  return typeof value === "string" ? value.trim() : "";
}

function numberAt(root, key) {
  const value = root[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pathExists(evidencePath, baseDir) {
  const absolute = path.isAbsolute(evidencePath) ? evidencePath : path.resolve(baseDir, evidencePath);
  try {
    return fs.statSync(absolute).isFile();
  } catch {
    return false;
  }
}

function requireString(root, key, failures) {
  const value = stringAt(root, key);
  if (!value) failures.push(`${key} is missing.`);
  return value;
}

function requireBoolean(root, key, failures) {
  if (typeof root[key] !== "boolean") failures.push(`${key} must be boolean.`);
  return root[key] === true;
}

function verifyScreenshot(root, key, baseDir, checkFiles, failures) {
  const value = requireString(root, key, failures);
  if (value && checkFiles && !pathExists(value, baseDir)) failures.push(`${key} file not found: ${value}`);
}

function verifyIos(report, baseDir, checkFiles, failures) {
  const ios = report.ios;
  if (!isObject(ios)) {
    failures.push("ios is missing or not an object.");
    return;
  }
  requireString(ios, "simulator", failures);
  requireString(ios, "runtime", failures);
  verifyScreenshot(ios, "screenshot", baseDir, checkFiles, failures);
  for (const key of ["gameVisible", "topViewVisible", "trayVisible", "singleTrayLayout"]) {
    if (!requireBoolean(ios, key, failures)) failures.push(`ios.${key} must be true.`);
  }
}

function verifyAndroid(report, baseDir, checkFiles, failures) {
  const android = report.android;
  if (!isObject(android)) {
    failures.push("android is missing or not an object.");
    return;
  }
  requireString(android, "emulator", failures);
  requireString(android, "runtime", failures);
  const url = requireString(android, "url", failures);
  const networkBridge = requireString(android, "networkBridge", failures);
  if (networkBridge === "emulator-host-loopback") {
    if (url && !/^https?:\/\/10\.0\.2\.2:\d+\//.test(url)) {
      failures.push(`android.url must target 10.0.2.2 when networkBridge is emulator-host-loopback, got ${url}`);
    }
  } else if (networkBridge === "adb-reverse") {
    if (url && !/^https?:\/\/(?:127\.0\.0\.1|localhost):\d+\//.test(url)) {
      failures.push(`android.url must target emulator-localhost when networkBridge is adb-reverse, got ${url}`);
    }
    requireString(android, "reverseCommand", failures);
  } else if (networkBridge) {
    failures.push("android.networkBridge must be emulator-host-loopback or adb-reverse.");
  }
  verifyScreenshot(android, "screenshotAfterPick", baseDir, checkFiles, failures);
  for (const key of ["gameVisible", "topViewVisible", "trayVisible", "singleTrayLayout", "webglCanvasPresent"]) {
    if (!requireBoolean(android, key, failures)) failures.push(`android.${key} must be true.`);
  }
  if (android.androidFallbackActive === true) {
    requireString(android, "fallbackReason", failures);
    const fallbackItems = numberAt(android, "fallbackItemsAfterPick");
    if (fallbackItems === undefined || fallbackItems < 1) {
      failures.push("android.fallbackItemsAfterPick must be a positive number when fallback is active.");
    }
  } else if (android.androidFallbackActive !== false) {
    failures.push("android.androidFallbackActive must be boolean.");
  }

  const pick = android.pickProof;
  if (!isObject(pick)) {
    failures.push("android.pickProof is missing or not an object.");
    return;
  }
  const before = numberAt(pick, "trayCountBefore");
  const after = numberAt(pick, "trayCountAfter");
  if (before === undefined || after === undefined) {
    failures.push("android.pickProof tray counts must be finite numbers.");
  } else if (after <= before) {
    failures.push(`android.pickProof must show the tray count increasing, got ${before} -> ${after}.`);
  }
  requireString(pick, "bodyTextAfterPick", failures);
}

function verifyReport(report, baseDir, checkFiles) {
  const failures = [];
  if (!isObject(report)) failures.push("Report root is not an object.");
  if (report.schema !== SCHEMA) failures.push(`schema must be ${SCHEMA}.`);
  requireString(report, "appVersion", failures);
  requireString(report, "devUrl", failures);
  requireString(report, "distDigest", failures);
  requireString(report, "verifiedAt", failures);
  const themes = Array.isArray(report.themesCovered) ? report.themesCovered : [];
  for (const theme of REQUIRED_THEMES) {
    if (!themes.includes(theme)) failures.push(`themesCovered missing ${theme}.`);
  }
  verifyIos(report, baseDir, checkFiles, failures);
  verifyAndroid(report, baseDir, checkFiles, failures);
  return failures;
}

function main() {
  const args = process.argv.slice(2);
  const evidencePath = args.find((arg) => !arg.startsWith("--")) ?? "";
  const checkFiles = !args.includes("--no-file-check");
  if (!evidencePath) {
    usage();
    process.exit(2);
  }
  const absolute = path.resolve(evidencePath);
  const report = readJson(absolute);
  const failures = verifyReport(report, path.dirname(absolute), checkFiles);
  if (failures.length > 0) {
    console.error("Simulator QA evidence rejected:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Simulator QA evidence accepted: iOS + Android · ${report.appVersion} · ${report.distDigest}`);
}

main();
