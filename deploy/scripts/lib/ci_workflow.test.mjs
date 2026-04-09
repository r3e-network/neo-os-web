import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

test("ci workflow installs node dependencies and exercises the maintained test surface", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");

  assert.match(workflow, /actions\/setup-node@v4/);
  assert.match(workflow, /npm ci --legacy-peer-deps/);
  assert.match(workflow, /npm run -s test/);
  assert.match(workflow, /npm run -s test:integration|node --test test\/integration\/\*\.test\.mjs/);
  assert.match(workflow, /generated-morpheus-runtime-catalog/);
  assert.match(workflow, /automation\.upkeep/);
});
