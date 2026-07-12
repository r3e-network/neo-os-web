#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "dist");
const stagedDir = path.resolve(root, "..", "..", "platform", "host-app", "public", "miniapps", "zhuada-e");

function fail(message) {
  console.error(`Staged dist verification failed: ${message}`);
  process.exit(1);
}

function assertDirectory(directory, label) {
  if (!fs.existsSync(directory)) fail(`${label} directory is missing: ${directory}`);
  if (!fs.statSync(directory).isDirectory()) fail(`${label} path is not a directory: ${directory}`);
}

function walk(directory, base = directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolute, base));
    } else if (entry.isFile()) {
      files.push(path.relative(base, absolute).split(path.sep).join("/"));
    } else {
      fail(`unsupported filesystem entry in staged release tree: ${absolute}`);
    }
  }
  return files;
}

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

assertDirectory(sourceDir, "dist");
assertDirectory(stagedDir, "platform/host-app/public/miniapps/zhuada-e");

const sourceFiles = walk(sourceDir);
const stagedFiles = walk(stagedDir);
const sourceSet = new Set(sourceFiles);
const stagedSet = new Set(stagedFiles);

const missing = sourceFiles.filter((file) => !stagedSet.has(file));
const extra = stagedFiles.filter((file) => !sourceSet.has(file));
if (missing.length || extra.length) {
  const details = [
    ...missing.map((file) => `missing staged file: ${file}`),
    ...extra.map((file) => `extra staged file: ${file}`),
  ].slice(0, 20);
  fail(`${missing.length} missing and ${extra.length} extra files\n${details.join("\n")}`);
}

const changed = sourceFiles.filter((file) => digest(path.join(sourceDir, file)) !== digest(path.join(stagedDir, file)));
if (changed.length) {
  fail(`${changed.length} staged files differ from dist\n${changed.slice(0, 20).join("\n")}`);
}

console.log(`Staged dist verification passed: ${sourceFiles.length} files match platform/host-app/public/miniapps/zhuada-e.`);
