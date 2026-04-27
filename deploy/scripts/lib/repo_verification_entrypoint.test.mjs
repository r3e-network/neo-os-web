import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

test("root package exposes the repo verification command", () => {
  const rootPackageJson = readJson("package.json");

  assert.equal(rootPackageJson.scripts["verify:repo"], "bash scripts/verify_repo.sh");
});

test("repo verification script runs the canonical local validation stack", () => {
  const script = read("scripts/verify_repo.sh");

  assert.match(script, /npm audit --omit=dev --audit-level=high/);
  assert.match(script, /audit --workspace platform\/host-app --omit=dev --audit-level=high/);
  assert.match(script, /test:deploy-scripts/);
  assert.match(script, /platform\/admin-console test --silent/);
  assert.match(script, /platform\/admin-console run typecheck/);
  assert.match(script, /platform\/admin-console run build/);
  assert.match(script, /platform\/host-app run test:full/);
});

test("host app Playwright config caps local workers while preserving CI serialization", () => {
  const hostPackageJson = readJson("platform/host-app/package.json");
  const playwrightConfig = read("platform/host-app/playwright.config.ts");

  assert.doesNotMatch(hostPackageJson.scripts["test:e2e"], /--workers=/);
  assert.match(playwrightConfig, /PLAYWRIGHT_WORKERS\s*\?\?\s*"4"/);
  assert.match(playwrightConfig, /Math\.min\(4,\s*Math\.max\(1,\s*localWorkerCount\)\)/);
  assert.match(playwrightConfig, /workers:\s*process\.env\.CI\s*\?\s*1\s*:\s*safeLocalWorkers/);
});

test("README documents the repo verification entrypoint", () => {
  const readme = read("README.md");

  assert.match(readme, /verify:repo/);
  assert.match(readme, /preferred local verification entrypoint/i);
});
