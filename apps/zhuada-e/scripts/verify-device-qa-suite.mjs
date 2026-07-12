#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportVerifier = path.join(root, "scripts", "verify-device-qa-report.mjs");
const MIN_PHONE_SHORT_EDGE = 280;
const MAX_PHONE_SHORT_EDGE = 520;
const MIN_PHONE_LONG_EDGE = 560;
const MAX_PHONE_LONG_EDGE = 960;

function usage() {
  console.error([
    "Usage: node scripts/verify-device-qa-suite.mjs <evidence-root>",
    "",
    "Verifies a complete physical-device QA evidence suite before release signoff.",
    "The suite must contain at least one accepted iOS/Safari report and one accepted Android/Chrome report from the same app version and build id.",
    "Each report is verified with --strict-evidence-files using its own directory as evidence root.",
  ].join("\n"));
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (
      entry.isFile()
      && entry.name.endsWith(".json")
      && !entry.name.includes("template")
      && !absolute.split(path.sep).includes("evidence")
    ) {
      files.push(absolute);
    }
  }
  return files;
}

function classifyDevice(report) {
  const text = [
    report.runtime?.deviceLabel,
    report.runtime?.userAgent,
    report.runtime?.platform,
  ].filter(Boolean).join(" ").toLowerCase();
  const isIosDevice = /\b(iphone|ipad|ios)\b/.test(text);
  const isSafari = /\bsafari\b/.test(text) && !/\b(chrome|crios|fxios|edgios)\b/.test(text);
  const isAndroidDevice = /\bandroid\b/.test(text);
  const isChrome = /\b(chrome|crios)\b/.test(text);
  const width = Number(report.runtime?.viewport?.width ?? 0);
  const height = Number(report.runtime?.viewport?.height ?? 0);
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  const phoneViewport = shortEdge >= MIN_PHONE_SHORT_EDGE
    && shortEdge <= MAX_PHONE_SHORT_EDGE
    && longEdge >= MIN_PHONE_LONG_EDGE
    && longEdge <= MAX_PHONE_LONG_EDGE;
  const isIos = isIosDevice && isSafari && !isAndroidDevice && phoneViewport;
  const isAndroid = isAndroidDevice && isChrome && !isIosDevice && phoneViewport;
  return { isIos, isAndroid, text, viewport: `${width}x${height}`, phoneViewport };
}

function verifyReport(reportPath) {
  const evidenceRoot = path.dirname(reportPath);
  const run = spawnSync(process.execPath, [
    reportVerifier,
    reportPath,
    "--evidence-root",
    evidenceRoot,
    "--strict-evidence-files",
  ], {
    cwd: root,
    encoding: "utf8",
  });
  if (run.status !== 0) {
    return { ok: false, output: `${run.stdout}${run.stderr}` };
  }
  return { ok: true, output: run.stdout };
}

function main() {
  const suiteRoot = process.argv[2] ? path.resolve(process.argv[2]) : "";
  if (!suiteRoot) {
    usage();
    process.exit(2);
  }
  if (!fs.existsSync(suiteRoot) || !fs.statSync(suiteRoot).isDirectory()) {
    console.error(`Device QA suite root is not a directory: ${suiteRoot}`);
    process.exit(2);
  }

  const reports = walk(suiteRoot);
  if (reports.length < 2) {
    console.error("Device QA suite rejected: at least two reports are required, one iOS/Safari and one Android/Chrome.");
    process.exit(1);
  }

  const failures = [];
  const accepted = [];
  for (const reportPath of reports) {
    const verification = verifyReport(reportPath);
    if (!verification.ok) {
      failures.push(`${path.relative(suiteRoot, reportPath)}\n${verification.output}`);
      continue;
    }
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    accepted.push({
      path: reportPath,
      appVersion: String(report.appVersion ?? ""),
      buildId: String(report.buildId ?? ""),
      sessionId: String(report.sessionId ?? ""),
      ...classifyDevice(report),
    });
  }

  if (failures.length > 0) {
    console.error("Device QA suite rejected: one or more reports failed strict verification.");
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }

  const versions = new Set(accepted.map((report) => report.appVersion));
  const builds = new Set(accepted.map((report) => report.buildId));
  if (versions.size !== 1 || builds.size !== 1) {
    console.error(`Device QA suite rejected: reports must share one appVersion and one buildId. versions=${[...versions].join(",")} builds=${[...builds].join(",")}`);
    process.exit(1);
  }

  const ios = accepted.filter((report) => report.isIos);
  const android = accepted.filter((report) => report.isAndroid);
  if (ios.length === 0 || android.length === 0) {
    console.error("Device QA suite rejected: missing required device family coverage.");
    if (ios.length === 0) console.error("MISSING accepted iOS/Safari report.");
    if (android.length === 0) console.error("MISSING accepted Android/Chrome report.");
    for (const report of accepted) {
      console.error(`- ${path.relative(suiteRoot, report.path)} classified text: ${report.text || "<empty>"} viewport=${report.viewport} phoneViewport=${report.phoneViewport}`);
    }
    process.exit(1);
  }

  console.log(`Device QA suite accepted: ${accepted.length} report(s), ${ios.length} iOS/Safari, ${android.length} Android/Chrome · ${[...versions][0]} · ${[...builds][0]}`);
}

main();
