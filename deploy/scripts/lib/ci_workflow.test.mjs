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
  // Anchored per-step matches: a substring like `npm run -s test:integration`
  // must not satisfy the requirement that the push/PR job runs the suite.
  assert.match(workflow, /^\s*run: npm run -s lint$/m);
  assert.match(workflow, /^\s*run: npm run -s test:deploy-scripts$/m);
  assert.match(workflow, /^\s*run: npm run -s test:shared$/m);
  assert.match(workflow, /^\s*run: (?:npm run -s test:integration|node --test test\/integration\/\*\.test\.mjs)$/m);
  assert.match(workflow, /generated-morpheus-runtime-catalog/);
  assert.match(workflow, /automation\.upkeep/);
});

test("lint gate is wired through the root flat config", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(pkg.scripts.lint, "eslint .");
  assert.ok(pkg.devDependencies.eslint, "eslint must be a root devDependency");
  assert.ok(
    pkg.devDependencies["typescript-eslint"],
    "typescript-eslint must be a root devDependency"
  );
  assert.ok(
    fs.existsSync(path.join(repoRoot, "eslint.config.mjs")),
    "root eslint flat config (eslint.config.mjs) must exist"
  );
});

test("workspace members must not carry their own package-lock.json", () => {
  // XC-W2-04: the root package-lock.json is the single source of dependency
  // truth. Nested lockfiles silently fork resolution (npm ci inside a member
  // installs against a stale tree) and have drifted before
  // (platform/admin-console, platform/sdk, platform/shared, apps/shared).
  const skipDirs = new Set([
    "node_modules",
    ".git",
    ".next",
    ".turbo",
    "dist",
    "build",
    "out",
    "coverage",
  ]);
  const offenders = [];
  const stack = [repoRoot];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) stack.push(path.join(dir, entry.name));
        continue;
      }
      if (entry.name !== "package-lock.json") continue;
      const fullPath = path.join(dir, entry.name);
      if (fullPath === path.join(repoRoot, "package-lock.json")) continue;
      offenders.push(path.relative(repoRoot, fullPath));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `nested package-lock.json files found (remove them; the root lock owns resolution): ${offenders.join(", ")}`
  );
});

test("verify_repo gate runs the deploy-script suite", () => {
  // It used to run test:shared as well. apps/shared is the SDK's now and lives
  // in neo-os-devpack, so that suite runs there; asserting it here would only
  // pin a command this package no longer defines.
  const verifyRepo = fs.readFileSync(path.join(repoRoot, "scripts/verify_repo.sh"), "utf8");
  assert.match(verifyRepo, /^npm run test:deploy-scripts$/m);
});
