#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full, base);
      if (!entry.isFile()) return [];
      return [path.relative(base, full).split(path.sep).join("/")];
    })
    .sort((a, b) => a.localeCompare(b));
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function digestDist(distDir = path.join(defaultRoot, "dist")) {
  if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
    throw new Error(`${distDir} does not exist; run npm run build before npm run dist:digest.`);
  }
  const files = walk(distDir);
  if (files.length === 0) throw new Error(`${distDir} contains no files.`);
  // Release evidence hashes the sorted relative file manifest, not absolute
  // paths, so the same dist tree has the same digest across machines.
  const manifest = files.map((file) => {
    const digest = sha256(fs.readFileSync(path.join(distDir, file)));
    return `${digest}  ${file}`;
  }).join("\n");
  return {
    files: files.length,
    digest: sha256(`${manifest}\n`),
    manifest,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = digestDist(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
    console.log(`dist tree digest: ${result.digest} (${result.files} files)`);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
