import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

test("admin-console pins the same Vite React plugin version as the root workspace", () => {
  const rootPackageJson = readJson("package.json");
  const adminConsolePackageJson = readJson("platform/admin-console/package.json");

  assert.equal(
    adminConsolePackageJson.devDependencies["@vitejs/plugin-react"],
    rootPackageJson.devDependencies["@vitejs/plugin-react"],
  );
});

test("admin-console lockfile resolves the same Vite React plugin version as the root workspace", () => {
  const packageLock = readJson("package-lock.json");
  const sharedInstall = packageLock.packages["node_modules/@vitejs/plugin-react"];
  const workspaceInstall =
    packageLock.packages["platform/admin-console/node_modules/@vitejs/plugin-react"] || sharedInstall;

  assert.equal(
    workspaceInstall.version,
    sharedInstall.version,
  );
});
