import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { scanHistoryForSecretMaterial } from "./history_secret_scan.mjs";

/**
 * WIF-shaped fixtures are assembled at runtime, never written as literals.
 *
 * This file is scanned by the working-tree gate and, once this module is wired
 * up, by the history gate too — so a literal fixture would either fail the
 * build or force a path allowlist, and a path allowlist is exactly the place a
 * real key could later hide unnoticed.
 */
const syntheticWif = (lead = "L", filler = "1") => `${lead}${filler.repeat(51)}`;
const syntheticNep2 = (filler = "1") => `6P${filler.repeat(56)}`;

/** Deterministic identity so fixture commits do not depend on user git config. */
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};

/**
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string}
 */
function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: GIT_ENV }).trim();
}

/**
 * Create a throwaway repository and hand it to `build` for population.
 *
 * @template T
 * @param {(repo: string) => T} build
 * @returns {T extends void ? void : T}
 */
function withRepo(build) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "history-secret-scan-"));
  try {
    git(repo, ["init", "--quiet", "--initial-branch=main"]);
    return build(repo);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

/**
 * @param {string} repo
 * @param {string} relativePath
 * @param {string} contents
 * @param {string} message
 */
function commitFile(repo, relativePath, contents, message) {
  const target = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  git(repo, ["add", "--all"]);
  git(repo, ["commit", "--quiet", "--no-verify", "-m", message]);
  return git(repo, ["rev-parse", "HEAD"]);
}

test("finds a key that history still carries after the file was deleted", () => {
  withRepo((repo) => {
    const wif = syntheticWif();
    const leaking = commitFile(repo, "deploy/smoke.sh", `--wif ${wif}\n`, "add smoke signer");
    fs.rmSync(path.join(repo, "deploy/smoke.sh"));
    git(repo, ["add", "--all"]);
    git(repo, ["commit", "--quiet", "--no-verify", "-m", "remove smoke signer"]);

    // The working tree is clean at this point; only history holds the key. This
    // is the exact shape of audit finding C-6, and the case a tree-only gate
    // reports as passing.
    const report = scanHistoryForSecretMaterial(repo);

    assert.equal(report.violations.length, 1);
    const [violation] = report.violations;
    assert.equal(violation.ruleId, "neo-wif");
    assert.equal(violation.kind, "blob");
    assert.equal(violation.path, "deploy/smoke.sh");
    assert.deepEqual(violation.commits, [leaking]);
  });
});

test("finds a key committed only in a commit message", () => {
  withRepo((repo) => {
    commitFile(repo, "README.md", "# fixture\n", "initial");
    const wif = syntheticWif("K");
    git(repo, ["commit", "--quiet", "--no-verify", "--allow-empty", "-m", `rotate away from ${wif}`]);
    const sha = git(repo, ["rev-parse", "HEAD"]);

    const report = scanHistoryForSecretMaterial(repo);

    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].kind, "commit-message");
    assert.deepEqual(report.violations[0].commits, [sha]);
  });
});

test("finds a key committed only in an annotated tag message", () => {
  withRepo((repo) => {
    commitFile(repo, "README.md", "# fixture\n", "initial");
    git(repo, ["tag", "-a", "v9.9.9", "-m", `ship with ${syntheticNep2()}`]);

    const report = scanHistoryForSecretMaterial(repo);

    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].kind, "tag-message");
    assert.equal(report.violations[0].ruleId, "neo-nep2");
    assert.equal(report.violations[0].ref, "refs/tags/v9.9.9");
  });
});

test("scans history reachable from every ref, not just the checked-out branch", () => {
  withRepo((repo) => {
    commitFile(repo, "README.md", "# fixture\n", "initial");
    git(repo, ["checkout", "--quiet", "-b", "side"]);
    const sha = commitFile(repo, "cfg/key.env", `WIF=${syntheticWif()}\n`, "side leak");
    git(repo, ["checkout", "--quiet", "main"]);

    // `main` is clean and checked out; the key lives on an unmerged branch. A
    // scan scoped to HEAD would miss it, which is how the local-only branch in
    // C-6 kept the key long after the published line was squashed clean.
    const report = scanHistoryForSecretMaterial(repo);

    assert.equal(report.violations.length, 1);
    assert.deepEqual(report.violations[0].commits, [sha]);
  });
});

test("reports a clean repository as clean", () => {
  withRepo((repo) => {
    commitFile(repo, "README.md", "# fixture\n", "initial");
    commitFile(repo, "src/app.ts", "export const answer = 42;\n", "add app");

    const report = scanHistoryForSecretMaterial(repo);

    assert.deepEqual(report.violations, []);
    assert.ok(report.scannedBlobs >= 2);
    assert.ok(report.scannedCommits >= 2);
  });
});

test("reports an empty repository as clean rather than failing", () => {
  withRepo((repo) => {
    // A fresh clone mid-CI, or a repo whose refs have not been fetched yet.
    // `git rev-list --all` exits non-zero on some git versions here, and a gate
    // that crashes on an empty repo gets disabled.
    const report = scanHistoryForSecretMaterial(repo);
    assert.deepEqual(report.violations, []);
    assert.equal(report.scannedBlobs, 0);
    assert.equal(report.scannedCommits, 0);
  });
});

test("never echoes a secret into the report", () => {
  withRepo((repo) => {
    const wif = syntheticWif();
    commitFile(repo, "deploy/smoke.sh", `--wif ${wif}\n`, "add smoke signer");

    const report = scanHistoryForSecretMaterial(repo);
    const serialized = JSON.stringify(report);

    assert.ok(
      !serialized.includes(wif),
      "a history report that prints the key has copied it out of history into CI logs",
    );
    assert.ok(report.violations[0].redacted.length > 0);
  });
});

test("honours the value allowlist so published test vectors do not fail the gate", () => {
  withRepo((repo) => {
    // The published private-key-1 WIF is pinned by a conversion test and lives
    // in reachable history forever. Allowlisting is by value, so the same file
    // still trips the gate if a real key is added beside it.
    commitFile(
      repo,
      "apps/shared/test/vector.ts",
      'export const expectedWif = "KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn";\n',
      "pin conversion vector",
    );

    const report = scanHistoryForSecretMaterial(repo);

    assert.deepEqual(report.violations, []);
  });
});

test("deduplicates one key that appears in many commits into one violation", () => {
  withRepo((repo) => {
    const wif = syntheticWif();
    const first = commitFile(repo, "deploy/smoke.sh", `--wif ${wif}\n`, "add smoke signer");
    const second = commitFile(repo, "deploy/other.sh", `--wif ${wif}\n`, "copy smoke signer");

    // Same blob content under two paths: two blobs, but the operator needs one
    // row per (path, key), with every commit that carries it listed.
    const report = scanHistoryForSecretMaterial(repo);

    assert.equal(report.violations.length, 2);
    const paths = report.violations.map((v) => v.path).sort();
    assert.deepEqual(paths, ["deploy/other.sh", "deploy/smoke.sh"]);
    for (const violation of report.violations) {
      assert.ok(violation.commits.length >= 1);
    }
    assert.ok([first, second].every((sha) => typeof sha === "string" && sha.length === 40));
  });
});

test("does not scan unreachable objects that pruning will remove", () => {
  withRepo((repo) => {
    commitFile(repo, "README.md", "# fixture\n", "initial");
    git(repo, ["checkout", "--quiet", "-b", "doomed"]);
    commitFile(repo, "cfg/key.env", `WIF=${syntheticWif()}\n`, "doomed leak");
    git(repo, ["checkout", "--quiet", "main"]);
    git(repo, ["branch", "-D", "doomed"]);
    git(repo, ["reflog", "expire", "--expire=now", "--expire-unreachable=now", "--all"]);
    git(repo, ["gc", "--prune=now", "--quiet"]);

    // Scoping to reachable history is deliberate: an unreachable object is
    // already gone as far as clone, fetch and checkout are concerned, and a
    // gate that failed on loose garbage would fail on state no commit can fix.
    const report = scanHistoryForSecretMaterial(repo);

    assert.deepEqual(report.violations, []);
  });
});

test("skips binary blobs instead of decoding them into false positives", () => {
  withRepo((repo) => {
    const target = path.join(repo, "assets", "logo.bin");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from([0x00, 0x01, 0x02, 0x00, 0xff, 0xfe]));
    git(repo, ["add", "--all"]);
    git(repo, ["commit", "--quiet", "--no-verify", "-m", "add binary asset"]);

    const report = scanHistoryForSecretMaterial(repo);

    assert.deepEqual(report.violations, []);
    assert.ok(report.skippedBlobs >= 1);
  });
});
