import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

function readPackageJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("root admin-console test delegates to the workspace package script", () => {
  const rootPackageJson = readPackageJson("package.json");

  assert.equal(rootPackageJson.scripts["test:admin-console"], "npm --prefix platform/admin-console test --silent");
});

test("admin-console test scripts use the workspace-local vitest binary", () => {
  const adminConsolePackageJson = readPackageJson("platform/admin-console/package.json");

  assert.equal(adminConsolePackageJson.scripts.test, "vitest run");
  assert.equal(adminConsolePackageJson.scripts["test:coverage"], "vitest run --coverage");
});

test("full-stack testnet wrapper guards empty live args under bash nounset", () => {
  const script = readText("deploy/scripts/run_full_stack_testnet_validation.sh");

  assert.match(script, /\$\{#live_args\[@\]\} -gt 0/);
  assert.match(script, /run_live_testnet_validation\.sh"\s*$/m);
});
