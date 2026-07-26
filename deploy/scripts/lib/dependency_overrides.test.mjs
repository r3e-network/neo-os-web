import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

const versionAtLeast = (actual, expected) => {
  const toParts = (value) =>
    String(value)
      .split(/[.-]/)
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10) || 0);

  const actualParts = toParts(actual);
  const expectedParts = toParts(expected);

  for (let index = 0; index < expectedParts.length; index += 1) {
    if ((actualParts[index] ?? 0) > expectedParts[index]) return true;
    if ((actualParts[index] ?? 0) < expectedParts[index]) return false;
  }

  return true;
};

// Advisory-driven pins are asserted as floors, not exact matches. An exact
// assertion turns a pin that fixed one advisory into a gate that forbids the
// fix for the next advisory covering that same version.
const assertAtLeast = (actual, floor, label) => {
  assert.ok(
    actual !== undefined && actual !== null,
    `${label} must stay pinned (floor ${floor}); found no pin`,
  );
  assert.ok(
    versionAtLeast(actual, floor),
    `${label} must stay at or above the advisory floor ${floor}; found ${actual}`,
  );
};

test("root package pins vulnerable transitive dependencies used by deployable surfaces", () => {
  const pkg = readJson("package.json");

  assertAtLeast(pkg.overrides?.axios, "1.18.1", "overrides.axios");
  assertAtLeast(pkg.overrides?.dompurify, "3.4.12", "overrides.dompurify");
  assertAtLeast(pkg.overrides?.["fast-uri"], "3.1.4", "overrides['fast-uri']");
  assertAtLeast(pkg.overrides?.immutable, "5.1.9", "overrides.immutable");
  assertAtLeast(pkg.overrides?.sharp, "0.35.3", "overrides.sharp");
  assertAtLeast(
    pkg.overrides?.["minimatch@>=9"]?.["brace-expansion"],
    "5.0.8",
    "overrides['minimatch@>=9']['brace-expansion']",
  );
  assertAtLeast(pkg.overrides?.postcss, "8.5.23", "overrides.postcss");
  assertAtLeast(pkg.overrides?.next?.postcss, "8.5.23", "overrides.next.postcss");
  assertAtLeast(pkg.overrides?.picomatch, "4.0.4", "overrides.picomatch");

  // The 2.x picomatch entries are deliberate compatibility ceilings for the
  // legacy micromatch line, not advisory floors, so they stay exact.
  assert.equal(pkg.overrides?.micromatch?.picomatch, "2.3.2");
  assert.equal(pkg.overrides?.anymatch?.picomatch, "2.3.2");
  assert.equal(pkg.overrides?.readdirp?.picomatch, "2.3.2");
  assert.equal(pkg.overrides?.["@sentry/nextjs"], undefined);
});

test("workspace manifests pin vulnerable transitive dependencies at the package boundary", () => {
  const hostAppPkg = readJson(path.join("platform", "host-app", "package.json"));
  const adminPkg = readJson(path.join("platform", "admin-console", "package.json"));

  assert.equal(hostAppPkg.dependencies?.["@sentry/nextjs"], "^10.48.0");
  assert.equal(hostAppPkg.dependencies?.next, "^15.5.21");
  assert.equal(adminPkg.dependencies?.next, "^15.5.21");
  assert.equal(hostAppPkg.overrides?.axios, "1.18.1");
  assert.equal(hostAppPkg.overrides?.dompurify, "3.4.12");
  assert.equal(hostAppPkg.overrides?.["@sentry/nextjs"], undefined);
  assert.equal(adminPkg.overrides?.anymatch?.picomatch, "2.3.2");
  assert.equal(adminPkg.overrides?.readdirp?.picomatch, "2.3.2");
  assert.equal(adminPkg.overrides?.vite?.picomatch, "4.0.4");
  assert.equal(adminPkg.overrides?.vitest?.picomatch, "4.0.4");
  assert.equal(adminPkg.overrides?.["@parcel/watcher"]?.picomatch, "4.0.4");
});

test("package lock resolves the hardened dependency versions used in production installs", () => {
  const lock = readJson("package-lock.json");
  const packages = lock.packages ?? {};
  const resolvedRollup =
    packages["node_modules/@sentry/nextjs/node_modules/rollup"]?.version ??
    packages["node_modules/rollup"]?.version;

  assertAtLeast(packages["node_modules/axios"]?.version, "1.18.1", "lock axios");
  assertAtLeast(packages["node_modules/dompurify"]?.version, "3.4.12", "lock dompurify");
  assertAtLeast(packages["node_modules/fast-uri"]?.version, "3.1.4", "lock fast-uri");
  assertAtLeast(packages["node_modules/immutable"]?.version, "5.1.9", "lock immutable");
  assertAtLeast(packages["node_modules/sharp"]?.version, "0.35.3", "lock sharp");
  assertAtLeast(
    packages["node_modules/brace-expansion"]?.version,
    "5.0.8",
    "lock brace-expansion",
  );
  assertAtLeast(packages["node_modules/postcss"]?.version, "8.5.23", "lock postcss");
  assert.equal(packages["node_modules/picomatch"]?.version, "2.3.2");
  assertAtLeast(
    packages["node_modules/@sentry/nextjs"]?.version,
    "10.56.0",
    "lock @sentry/nextjs",
  );
  assertAtLeast(packages["node_modules/next"]?.version, "15.5.21", "lock next");
  assert.ok(versionAtLeast(resolvedRollup, "4.35.0"));
  assert.equal(packages["node_modules/@parcel/watcher/node_modules/picomatch"]?.version, "4.0.4");
  assert.equal(packages["node_modules/vite/node_modules/picomatch"]?.version, "4.0.4");
});
