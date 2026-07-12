#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shimsRoot = path.resolve(root, "../shared/shims");

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

const files = walk(shimsRoot).filter((file) => (
  /\.js$/i.test(file)
  && /[/\\]noble-(?:hashes|curves)/.test(file)
));

invariant(files.length > 0, "No vendored noble shim files were found.");

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  invariant(
    !/\/\/# sourceMappingURL=/.test(text),
    `${path.relative(root, file)} contains a sourceMappingURL comment; remove it so Vite/Vitest does not read stale vendored maps.`,
  );
}

console.log(`Vendored shim gate passed: ${files.length} noble shim JS files contain no sourceMappingURL comments.`);
