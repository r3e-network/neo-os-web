import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const canonicalDocuments = [
  "docs/superpowers/README.md",
  "docs/superpowers/plans/2026-07-18-phase0-2-stabilize-audit-testnet.md",
  "docs/superpowers/plans/2026-07-18-phase5-engine-absorption-migration.md",
  "docs/superpowers/specs/2026-03-31-miniapp-os-v2-design.md",
  "docs/superpowers/specs/2026-07-18-joint-platform-contract-library-design.md",
];

const runGit = (...args) =>
  spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });

test("canonical architecture documents exist and are not ignored", () => {
  for (const relativePath of canonicalDocuments) {
    assert.ok(fs.existsSync(path.join(repoRoot, relativePath)), `${relativePath} must exist`);

    const ignored = runGit("check-ignore", "--no-index", "--quiet", "--", relativePath);
    assert.equal(
      ignored.status,
      1,
      `${relativePath} must remain versionable instead of matching .gitignore`
    );
  }
});

test("tracked files never match repository ignore rules", () => {
  const result = runGit("ls-files", "-ci", "--exclude-standard");
  assert.equal(result.status, 0, result.stderr);

  const trackedIgnoredFiles = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  assert.deepEqual(
    trackedIgnoredFiles,
    [],
    `tracked files also ignored by .gitignore: ${trackedIgnoredFiles.join(", ")}`
  );
});

test("local agent state remains ignored", () => {
  for (const relativePath of [
    ".superpowers/runtime-state.json",
    ".workbuddy/memory/MEMORY.md",
  ]) {
    const ignored = runGit("check-ignore", "--no-index", "--quiet", "--", relativePath);
    assert.equal(ignored.status, 0, `${relativePath} must remain local-only`);
  }
});
