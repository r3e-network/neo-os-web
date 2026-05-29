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

test("Explorer skips host API fetches when opened from local static public miniapp files", () => {
  const source = read("apps/explorer/src/composables/useExplorer.ts");

  assert.match(source, /function isLocalStaticExplorer/);
  assert.match(source, /function shouldUseExplorerApi/);
  assert.match(source, /window\.location\.pathname\.includes\("\/miniapps\/explorer\/"\)/);
  assert.match(source, /if \(!shouldUseExplorerApi\(\)\) return;/);
  assert.match(source, /if \(!shouldUseExplorerApi\(\)\) return null;/);
});
