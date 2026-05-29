import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("miniapp dist staging supports the same selected-slug workflow as builds", () => {
  const buildScript = read("scripts/build-miniapp-dapps.mjs");
  const stageScript = read("scripts/stage-miniapp-dists.mjs");

  assert.match(buildScript, /const selected = new Set\(process\.argv\.slice\(2\)/);
  assert.match(stageScript, /const selected = new Set\(process\.argv\.slice\(2\)/);
  assert.match(stageScript, /if \(selected\.size > 0 && !selected\.has\(slug\)\) continue;/);
  assert.match(
    stageScript,
    /selectedCount:\s*selected\.size/,
    "staging output should report whether it ran scoped or full-repo",
  );
});
