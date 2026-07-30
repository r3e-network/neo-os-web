import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const libPath = path.join(repoRoot, "deploy/scripts/lib/build_artifacts.sh");
const factoryScript = path.join(repoRoot, "deploy/scripts/deploy/deploy-factory.sh");

function callHelper(args, { cwd } = {}) {
  return execFileSync(
    "bash",
    [
      "-c",
      'set -euo pipefail; . "$1"; shift; promote_contract_artifacts "$@"',
      "bash",
      libPath,
      ...args,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], cwd: cwd ?? repoRoot },
  );
}

function callHelperExpectingFailure(args, { cwd } = {}) {
  let thrown;
  assert.throws(() => callHelper(args, { cwd }), (error) => {
    thrown = error;
    return true;
  });
  return thrown;
}

function makeWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nmp-artifacts-"));
  const src = path.join(dir, "temp_out");
  const dest = path.join(dir, "build");
  fs.mkdirSync(src, { recursive: true });
  return { dir, src, dest };
}

function writeArtifacts(src, names) {
  for (const [name, body] of Object.entries(names)) {
    fs.writeFileSync(path.join(src, name), body);
  }
}

test("promote_contract_artifacts rejects a call with no arguments", () => {
  const error = callHelperExpectingFailure([]);
  assert.equal(error.status, 2);
  assert.match(error.stderr, /Usage: promote_contract_artifacts/);
});

test("promote_contract_artifacts rejects a call missing the contract name", () => {
  const { src, dest } = makeWorkspace();
  const error = callHelperExpectingFailure([src, dest]);
  assert.equal(error.status, 2);
  assert.match(error.stderr, /Usage: promote_contract_artifacts/);
});

test("promote_contract_artifacts rejects an empty argument", () => {
  const { src, dest } = makeWorkspace();
  const error = callHelperExpectingFailure([src, dest, ""]);
  assert.equal(error.status, 2);
  assert.match(error.stderr, /Usage: promote_contract_artifacts/);
});

test("promote_contract_artifacts renames the single compiler output pair", () => {
  const { src, dest } = makeWorkspace();
  writeArtifacts(src, {
    "MiniAppFactory.nef": "nef-bytes",
    "MiniAppFactory.manifest.json": '{"name":"MiniAppFactory"}',
  });

  const stdout = callHelper([src, dest, "MiniAppFactoryV2"]);

  assert.equal(
    fs.readFileSync(path.join(dest, "MiniAppFactoryV2.nef"), "utf8"),
    "nef-bytes",
  );
  assert.equal(
    fs.readFileSync(path.join(dest, "MiniAppFactoryV2.manifest.json"), "utf8"),
    '{"name":"MiniAppFactory"}',
  );
  assert.deepEqual(fs.readdirSync(src).sort(), []);
  assert.match(stdout, /MiniAppFactoryV2\.nef/);
  assert.match(stdout, /MiniAppFactoryV2\.manifest\.json/);
});

test("promote_contract_artifacts creates the destination directory when absent", () => {
  const { src, dest } = makeWorkspace();
  writeArtifacts(src, { "Out.nef": "n", "Out.manifest.json": "{}" });
  assert.equal(fs.existsSync(dest), false);

  callHelper([src, dest, "Contract"]);

  assert.equal(fs.existsSync(path.join(dest, "Contract.nef")), true);
});

test("promote_contract_artifacts fails loudly when the compiler emitted no nef", () => {
  const { src, dest } = makeWorkspace();
  writeArtifacts(src, { "Out.manifest.json": "{}" });

  const error = callHelperExpectingFailure([src, dest, "Contract"]);

  assert.notEqual(error.status, 0);
  assert.notEqual(error.status, 2);
  assert.match(error.stderr, /\.nef/);
  assert.equal(fs.existsSync(path.join(dest, "Contract.nef")), false);
  assert.equal(fs.existsSync(path.join(dest, "Contract.manifest.json")), false);
});

test("promote_contract_artifacts fails loudly when the output directory is empty", () => {
  const { src, dest } = makeWorkspace();

  const error = callHelperExpectingFailure([src, dest, "Contract"]);

  assert.notEqual(error.status, 0);
  assert.match(error.stderr, /\.nef/);
  assert.equal(fs.existsSync(dest), false);
});

test("promote_contract_artifacts fails loudly when the manifest is missing", () => {
  const { src, dest } = makeWorkspace();
  writeArtifacts(src, { "Out.nef": "n" });

  const error = callHelperExpectingFailure([src, dest, "Contract"]);

  assert.notEqual(error.status, 0);
  assert.match(error.stderr, /manifest\.json/);
  assert.equal(fs.existsSync(path.join(dest, "Contract.nef")), false);
  assert.equal(fs.existsSync(path.join(src, "Out.nef")), true);
});

test("promote_contract_artifacts refuses an ambiguous multi-nef output", () => {
  const { src, dest } = makeWorkspace();
  writeArtifacts(src, {
    "A.nef": "a",
    "B.nef": "b",
    "A.manifest.json": "{}",
  });

  const error = callHelperExpectingFailure([src, dest, "Contract"]);

  assert.notEqual(error.status, 0);
  assert.match(error.stderr, /expected exactly one/i);
  assert.equal(fs.existsSync(path.join(dest, "Contract.nef")), false);
  assert.equal(fs.existsSync(path.join(src, "A.nef")), true);
  assert.equal(fs.existsSync(path.join(src, "B.nef")), true);
});

test("promote_contract_artifacts refuses an ambiguous multi-manifest output", () => {
  const { src, dest } = makeWorkspace();
  writeArtifacts(src, {
    "A.nef": "a",
    "A.manifest.json": "{}",
    "B.manifest.json": "{}",
  });

  const error = callHelperExpectingFailure([src, dest, "Contract"]);

  assert.notEqual(error.status, 0);
  assert.match(error.stderr, /expected exactly one/i);
  assert.equal(fs.existsSync(path.join(dest, "Contract.nef")), false);
});

test("promote_contract_artifacts fails when the output directory does not exist", () => {
  const { dir, dest } = makeWorkspace();

  const error = callHelperExpectingFailure([path.join(dir, "absent"), dest, "Contract"]);

  assert.notEqual(error.status, 0);
  assert.equal(fs.existsSync(dest), false);
});

test("promote_contract_artifacts handles paths containing spaces", () => {
  const { dir } = makeWorkspace();
  const src = path.join(dir, "temp out");
  const dest = path.join(dir, "build dir");
  fs.mkdirSync(src, { recursive: true });
  writeArtifacts(src, { "Out.nef": "n", "Out.manifest.json": "{}" });

  callHelper([src, dest, "Contract Name"]);

  assert.equal(fs.readFileSync(path.join(dest, "Contract Name.nef"), "utf8"), "n");
});

function shellFiles() {
  const listed = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "*.sh"],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  assert.equal(listed.status, 0, listed.stderr);
  const files = listed.stdout.split("\0").filter(Boolean)
    // A path can be listed by git and absent on disk while a deletion is staged
    // or a move is in progress; handing it to a linter reports a read error rather
    // than a finding.
    .filter((file) => existsSync(path.join(repoRoot, file)));
  assert.ok(files.length > 0, "expected the repository to contain shell scripts");
  return files;
}

// `[ -f dir/*.ext ]` and `[[ -f dir/*.ext ]]` are both broken: the single-bracket
// form errors out when the glob matches two or more paths and silently tests the
// literal pattern when it matches none, while `[[ ]]` never globs at all, so the
// test always fails. Either way the guarded block is unreachable or wrong.
const GLOB_FILE_TEST = /\[{1,2}\s+-(?:f|e|d|s|r|w|x|L|h)\s+([^\]]+?)\s*\]{1,2}/g;

test("no shell script passes a glob to a file test operand", () => {
  const offenders = [];

  for (const relativePath of shellFiles()) {
    const contents = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    contents.split(/\r?\n/).forEach((line, index) => {
      if (/^\s*#/.test(line)) return;
      for (const match of line.matchAll(GLOB_FILE_TEST)) {
        const unquoted = match[1].replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "");
        if (/[*?]/.test(unquoted)) {
          offenders.push(`${relativePath}:${index + 1}: ${line.trim()}`);
        }
      }
    });
  }

  assert.deepEqual(offenders, [], `glob passed to a file test:\n${offenders.join("\n")}`);
});

test("deploy-factory.sh promotes artifacts through the shared helper", () => {
  const script = fs.readFileSync(factoryScript, "utf8");

  assert.match(script, /\.\s+"\$SCRIPT_DIR\/\.\.\/lib\/build_artifacts\.sh"/);
  assert.match(script, /promote_contract_artifacts\s+"[^"]*temp_factory"/);
  assert.doesNotMatch(script, /mv\s+build\/temp_factory/);
});

test("deploy-factory.sh passes compiler sources as a quoted array", () => {
  const script = fs.readFileSync(factoryScript, "utf8");

  assert.doesNotMatch(script, /\$cs_files(?!\[)/);
  assert.match(script, /"\$\{cs_files\[@\]\}"/);
});

test("every shell library this repository sources is syntactically valid", () => {
  for (const relativePath of [
    "deploy/scripts/lib/build_artifacts.sh",
    "deploy/scripts/lib/neoexpress_config.sh",
    "deploy/scripts/deploy/deploy-factory.sh",
    "deploy/scripts/setup_neoexpress.sh",
  ]) {
    const parsed = spawnSync("bash", ["-n", path.join(repoRoot, relativePath)], {
      encoding: "utf8",
    });
    assert.equal(parsed.status, 0, `${relativePath}: ${parsed.stderr}`);
  }
});
