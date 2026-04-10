import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

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

test("root package pins vulnerable transitive dependencies used by deployable surfaces", () => {
  const pkg = readJson("package.json");

  assert.equal(pkg.overrides?.axios, "1.15.0");
  assert.equal(pkg.overrides?.picomatch, "4.0.4");
  assert.equal(pkg.overrides?.micromatch?.picomatch, "2.3.2");
  assert.equal(pkg.overrides?.anymatch?.picomatch, "2.3.2");
  assert.equal(pkg.overrides?.readdirp?.picomatch, "2.3.2");
  assert.equal(pkg.overrides?.["@sentry/nextjs"], undefined);
});

test("workspace manifests pin vulnerable transitive dependencies at the package boundary", () => {
  const hostAppPkg = readJson(path.join("platform", "host-app", "package.json"));
  const adminPkg = readJson(path.join("platform", "admin-console", "package.json"));

  assert.equal(hostAppPkg.dependencies?.["@sentry/nextjs"], "^10.48.0");
  assert.equal(hostAppPkg.overrides?.axios, "1.15.0");
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

  assert.equal(packages["node_modules/axios"]?.version, "1.15.0");
  assert.equal(packages["node_modules/picomatch"]?.version, "2.3.2");
  assert.equal(packages["node_modules/@sentry/nextjs"]?.version, "10.48.0");
  assert.ok(versionAtLeast(resolvedRollup, "4.35.0"));
  assert.equal(packages["node_modules/@parcel/watcher/node_modules/picomatch"]?.version, "4.0.4");
  assert.equal(packages["node_modules/vite/node_modules/picomatch"]?.version, "4.0.4");
});
