import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const libPath = path.join(here, "neoexpress_config.sh");
const libRelative = path.relative(repoRoot, libPath);
const configPath = "deploy/config/default.neo-express";
const HEX64 = "0123456789abcdef".repeat(4);

const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

const git = (args) =>
  execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });

test("the neo-express config is not tracked in git", () => {
  const tracked = git(["ls-files", "--", configPath]).trim();
  assert.equal(
    tracked,
    "",
    `${configPath} holds live account private keys once generated; it must never be tracked`,
  );
});

test("the neo-express config is gitignored so it cannot be added back by accident", () => {
  let ignored = "";
  try {
    ignored = git(["check-ignore", "--", configPath]).trim();
  } catch {
    ignored = "";
  }
  assert.equal(ignored, configPath, `${configPath} must be matched by .gitignore`);
});

test("the shared helper is the only place that creates a neo-express config", () => {
  const shellFiles = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard", "*.sh"])
    .split("\0")
    .filter((entry) => entry.length > 0);

  const creators = shellFiles.filter(
    (file) =>
      file !== libRelative &&
      /\bcreate\s+-o\s+"?\$\{?NEOEXPRESS_CONFIG/.test(read(file)),
  );

  assert.deepEqual(
    creators,
    [],
    `config creation must be delegated to ${libRelative}`,
  );
});

test("both bootstrap entrypoints source the shared helper", () => {
  for (const entry of [
    "deploy/scripts/setup_neoexpress.sh",
    "deploy/scripts/deploy/deploy-factory.sh",
  ]) {
    const body = read(entry);
    assert.match(body, /neoexpress_config\.sh/, `${entry} must source the shared helper`);
    assert.match(body, /ensure_neoexpress_config/, `${entry} must call ensure_neoexpress_config`);
  }
});

// --- behaviour, exercised against a stubbed neoxp ----------------------------

function callHelper(args, { cwd } = {}) {
  return execFileSync(
    "bash",
    ["-c", 'set -euo pipefail; . "$1"; shift; ensure_neoexpress_config "$@"', "bash", libPath, ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], cwd: cwd ?? repoRoot },
  );
}

function stubNeoxp(dir, { privateKey = HEX64, exitStatus = 0 } = {}) {
  const stub = path.join(dir, "neoxp");
  fs.writeFileSync(
    stub,
    `#!/bin/bash
echo "$@" >> ${JSON.stringify(path.join(dir, "calls.log"))}
if [ "${exitStatus}" != "0" ]; then exit ${exitStatus}; fi
out=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-o" ]; then out="$arg"; fi
  prev="$arg"
done
if [ -n "$out" ]; then
  printf '{"wallets":[{"accounts":[{"private-key":"%s"}]}]}\\n' ${JSON.stringify(privateKey)} > "$out"
fi
`,
    { mode: 0o755 },
  );
  return stub;
}

function runHelper({ configBody, privateKey, exitStatus } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "neoxp-cfg-"));
  const configFile = path.join(dir, "default.neo-express");
  if (configBody !== undefined) fs.writeFileSync(configFile, configBody);
  const stub = stubNeoxp(dir, { privateKey, exitStatus });

  const stdout = callHelper([configFile, stub], { cwd: dir });
  const callsLog = path.join(dir, "calls.log");
  const calls = fs.existsSync(callsLog)
    ? fs.readFileSync(callsLog, "utf8").trim().split("\n").filter(Boolean)
    : [];

  return {
    stdout,
    calls,
    configFile,
    body: fs.existsSync(configFile) ? fs.readFileSync(configFile, "utf8") : null,
  };
}

test("helper fails loudly when called without arguments", () => {
  assert.throws(() => callHelper([]), /usage|argument/i);
});

test("helper generates a config when none exists", () => {
  const run = runHelper({});
  assert.equal(run.calls.length, 1, "neoxp create must run exactly once");
  assert.match(run.calls[0], /-f\b/, "generation must pass -f so it is non-interactive");
  assert.match(run.body, new RegExp(HEX64));
});

test("helper regenerates a config whose keys were redacted by a history purge", () => {
  const run = runHelper({
    configBody: JSON.stringify({
      wallets: [{ accounts: [{ "private-key": "REDACTED_PRIVATE_KEY_PURGED_FROM_HISTORY" }] }],
    }),
  });
  assert.equal(run.calls.length, 1, "a poisoned config must be regenerated, not reused");
  assert.doesNotMatch(run.body, /REDACTED/);
  assert.match(run.body, new RegExp(HEX64));
});

test("helper regenerates a config with an empty private key", () => {
  const run = runHelper({
    configBody: JSON.stringify({ wallets: [{ accounts: [{ "private-key": "" }] }] }),
  });
  assert.equal(run.calls.length, 1);
});

test("helper regenerates a config with a truncated private key", () => {
  const run = runHelper({
    configBody: JSON.stringify({ wallets: [{ accounts: [{ "private-key": HEX64.slice(0, 40) }] }] }),
  });
  assert.equal(run.calls.length, 1);
});

test("helper regenerates a config that carries no private keys at all", () => {
  const run = runHelper({ configBody: JSON.stringify({ wallets: [] }) });
  assert.equal(run.calls.length, 1);
});

test("helper regenerates a config that is not valid json", () => {
  const run = runHelper({ configBody: "not json at all" });
  assert.equal(run.calls.length, 1);
});

test("helper leaves a usable config untouched", () => {
  const usable = JSON.stringify({
    wallets: [
      { accounts: [{ "private-key": HEX64 }] },
      { accounts: [{ "private-key": HEX64.toUpperCase() }] },
    ],
  });
  const run = runHelper({ configBody: usable });
  assert.equal(run.calls.length, 0, "a usable config must not be regenerated");
  assert.equal(run.body, usable, "a usable config must not be rewritten");
});

test("helper reports a failing generator instead of continuing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "neoxp-cfg-fail-"));
  const stub = stubNeoxp(dir, { exitStatus: 7 });
  try {
    callHelper([path.join(dir, "default.neo-express"), stub], { cwd: dir });
    assert.fail("a failing generator must abort the caller");
  } catch (error) {
    assert.equal(error.status, 7, "the generator's exit status must propagate");
  }
});

test("helper does not print private key material", () => {
  const run = runHelper({});
  assert.doesNotMatch(run.stdout, new RegExp(HEX64), "helper output must stay key-free");
});
