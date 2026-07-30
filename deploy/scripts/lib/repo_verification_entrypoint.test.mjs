import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

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

  // The two inline `npm audit` blocks were factored into a single
  // run_npm_audit_scope helper, so the flags now live in one place and the
  // scopes are its call sites. Both halves are asserted separately so the test
  // keeps its original teeth: dropping the production-only/high-severity flags
  // fails the first assertion, and dropping either audited scope fails the
  // matching call-site assertion.
  assert.match(script, /npm audit "\$@" --omit=dev --audit-level=high/);
  assert.match(script, /^run_npm_audit_scope "root audit"$/m);
  assert.match(script, /^run_npm_audit_scope "host-app audit" --workspace platform\/host-app$/m);
  assert.match(script, /test:deploy-scripts/);
  assert.match(script, /check:platform:social-framework/);
  assert.match(script, /check:factory-template-artifacts/);
  assert.match(script, /platform\/admin-console test --silent/);
  assert.match(script, /platform\/admin-console run typecheck/);
  assert.match(script, /platform\/admin-console run build/);
  assert.match(script, /platform\/host-app run test:full/);
});

test("every gate verify_repo.sh runs is a script this package defines", () => {
  const script = read("scripts/verify_repo.sh");
  const rootPackageJson = readJson("package.json");

  // The gate list is read out of the script rather than repeated here: pinning
  // the names meant that when four gates moved to neo-os-contracts, the script
  // kept calling them and this test kept asserting it did, so verify:repo was
  // broken and green at the same time.
  const gateBlock = script.match(/for gate in \\\n([\s\S]*?); do/);
  assert.ok(gateBlock, "verify_repo.sh must keep its `for gate in ...` list");

  const gates = gateBlock[1]
    .split("\n")
    .map((line) => line.replace(/\\$/, "").trim())
    .filter(Boolean);

  assert.ok(gates.length > 0, "the gate list must not be empty");
  const undefinedGates = gates.filter((gate) => !rootPackageJson.scripts?.[gate]);
  assert.deepEqual(undefinedGates, [], "verify_repo.sh runs gates this package does not define");
});

// The contract acceptance and upgrade-readiness audits read contract sources and
// contracts/build artifacts, so they moved to neo-os-contracts along with the
// contracts; the commands that ran them are gone from this package. What is
// still asserted is that no command here points at a script that is not.
test("every root script points at a file that exists", () => {
  const rootPackageJson = readJson("package.json");
  const dangling = [];

  for (const [name, command] of Object.entries(rootPackageJson.scripts ?? {})) {
    const referenced = String(command).match(
      /(?:deploy\/scripts|scripts)\/[A-Za-z0-9_\-/.]+\.(?:mjs|cjs|js|ts|sh)/g,
    );
    for (const file of referenced ?? []) {
      if (!fs.existsSync(path.join(repoRoot, file))) dangling.push(`${name} -> ${file}`);
    }
  }

  // A command that runs a script another repo now owns fails only when someone
  // runs it; naming them here fails at the same time as the move.
  assert.deepEqual(dangling, [], "these npm scripts run files that are not in this repo");
});

test("host app Playwright config caps local workers while preserving CI serialization", () => {
  const hostPackageJson = readJson("platform/host-app/package.json");
  const playwrightConfig = read("platform/host-app/playwright.config.ts");

  assert.doesNotMatch(hostPackageJson.scripts["test:e2e"], /--workers=/);
  assert.match(playwrightConfig, /PLAYWRIGHT_WORKERS\s*\?\?\s*"4"/);
  assert.match(playwrightConfig, /Math\.min\(4,\s*Math\.max\(1,\s*localWorkerCount\)\)/);
  assert.match(playwrightConfig, /workers:\s*process\.env\.CI\s*\?\s*1\s*:\s*safeLocalWorkers/);
});

test("host app core Playwright gate covers desktop Chrome and Pixel 7", () => {
  const playwrightConfig = read("platform/host-app/playwright.config.ts");

  assert.match(playwrightConfig, /name:\s*"chromium"/);
  assert.match(playwrightConfig, /devices\["Desktop Chrome"\]/);
  assert.match(playwrightConfig, /name:\s*"mobile-chrome"/);
  assert.match(playwrightConfig, /devices\["Pixel 7"\]/);
});

test("README documents the repo verification entrypoint", () => {
  const readme = read("README.md");

  assert.match(readme, /verify:repo/);
  assert.match(readme, /preferred local verification entrypoint/i);
});
