#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function walk(directory, base = directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute, base));
    else if (entry.isFile()) files.push(path.relative(base, absolute).split(path.sep).join("/"));
    else throw new Error(`unsupported filesystem entry in dist tree: ${absolute}`);
  }
  return files;
}

function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
    else throw new Error(`unsupported filesystem entry in dist tree: ${from}`);
  }
}

export function syncStagedDist({ root = defaultRoot } = {}) {
  const sourceDir = path.join(root, "dist");
  const stagedDir = path.resolve(root, "..", "..", "platform", "host-app", "public", "miniapps", "zhuada-e");
  const expectedSuffix = path.join("platform", "host-app", "public", "miniapps", "zhuada-e");

  invariant(fs.existsSync(sourceDir), "dist/ does not exist; run npm run build before staging.");
  invariant(fs.statSync(sourceDir).isDirectory(), "dist/ is not a directory.");
  invariant(stagedDir.endsWith(expectedSuffix), `refusing to replace unexpected staged directory: ${stagedDir}`);

  const files = walk(sourceDir);
  invariant(files.length > 0, "dist/ is empty; refusing to stage an empty release.");

  fs.rmSync(stagedDir, { recursive: true, force: true });
  copyTree(sourceDir, stagedDir);
  return { files: files.length, stagedDir };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = syncStagedDist();
  console.log(`Staged dist synchronized: ${result.files} files copied to ${path.relative(defaultRoot, result.stagedDir)}.`);
}
