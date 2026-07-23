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

  assert.match(script, /npm audit --omit=dev --audit-level=high/);
  assert.match(script, /audit --workspace platform\/host-app --omit=dev --audit-level=high/);
  assert.match(script, /test:deploy-scripts/);
  assert.match(script, /check:platform:contracts/);
  assert.match(script, /check:platform:social-framework/);
  assert.match(script, /check:factory-template-artifacts/);
  assert.match(script, /platform\/admin-console test --silent/);
  assert.match(script, /platform\/admin-console run typecheck/);
  assert.match(script, /platform\/admin-console run build/);
  assert.match(script, /platform\/host-app run test:full/);
});

test("root package exposes the platform contract acceptance ledger commands", () => {
  const rootPackageJson = readJson("package.json");

  assert.equal(
    rootPackageJson.scripts["audit:platform:contracts"],
    "node deploy/scripts/audit_platform_contract_acceptance.mjs",
  );
  assert.equal(
    rootPackageJson.scripts["check:platform:contracts"],
    "node deploy/scripts/audit_platform_contract_acceptance.mjs --check",
  );
  assert.equal(
    rootPackageJson.scripts["audit:platform:testnet-live"],
    "node deploy/scripts/verify_platform_contracts_live.mjs",
  );
  assert.equal(
    rootPackageJson.scripts["audit:platform:upgrade-readiness"],
    "node deploy/scripts/audit_platform_upgrade_readiness.mjs",
  );
  assert.equal(
    rootPackageJson.scripts["check:factory-template-artifacts"],
    "node deploy/scripts/generate_factory_template_artifacts.mjs --check",
  );
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
