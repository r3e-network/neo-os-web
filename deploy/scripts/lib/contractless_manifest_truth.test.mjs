import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

const contractlessApps = [
  "arrow-escape",
  "automation-copilot",
  "bead-workshop",
  "fruit-funnel",
  "screw-sort",
  "wallet-health",
];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("contractless apps do not retain a standalone custom contract binding", () => {
  for (const slug of contractlessApps) {
    const source = read(`apps/${slug}/src/manifest.ts`);
    const publicManifest = JSON.parse(read(`apps/${slug}/neo-manifest.json`));
    const contracts = publicManifest.contracts;
    const hasPublicContract = Boolean(
      contracts &&
        typeof contracts === "object" &&
        Object.values(contracts).some((value) => String(value ?? "").trim()),
    );

    assert.equal(hasPublicContract, false, `${slug} must remain contractless`);
    assert.doesNotMatch(
      source,
      /contract:\s*\{\s*mode:\s*["']custom["']/,
      `${slug} must not claim an undeployed custom contract`,
    );
  }
});
