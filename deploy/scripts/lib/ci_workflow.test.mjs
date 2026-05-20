import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("ci workflow installs node dependencies and exercises the maintained test surface", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");

  // Audit fix M-22 pinned every action to a 40-char commit SHA with a `# v<major>`
  // trailer (e.g. `actions/checkout@de0fac2e...  # v6 — audit fix M-22 (pinned to SHA)`).
  // Match the SHA form OR the legacy tag form so the test tolerates either pinning
  // strategy.
  const shaOrTag = (name) =>
    new RegExp(String.raw`actions/${name}@(?:v\d+|[0-9a-f]{40})`);
  assert.match(workflow, shaOrTag("checkout"));
  assert.match(workflow, shaOrTag("setup-node"));
  assert.match(workflow, shaOrTag("setup-go"));
  assert.match(workflow, /npm ci --legacy-peer-deps/);
  assert.match(workflow, /npm run -s test/);
  assert.match(workflow, /npm run -s test:integration|node --test test\/integration\/\*\.test\.mjs/);
  assert.match(workflow, /generated-morpheus-runtime-catalog/);
  assert.match(workflow, /automation\.upkeep/);
});
