import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { requireTool } from "./required_tool.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// Codes that describe a real difference between what the script says and what
// the shell does, rather than a style preference:
//
//   SC2086 / SC2046  an unquoted expansion is split on $IFS and glob-expanded,
//                    so a value containing a space or a `*` silently turns into
//                    several arguments -- or into matching filenames.
//
//   SC2155           `local x=$(cmd)` returns the exit status of `local`, which
//                    is always 0, so a failing `cmd` slips past `set -e` and the
//                    script carries on with an empty value. Declaring first and
//                    assigning second restores the abort; where a failure really
//                    is an expected outcome, an explicit `|| true` says so.
//
// Anywhere splitting is genuinely wanted, the value belongs in an array, which
// says so explicitly and survives odd characters. Errors are listed too because
// a shellcheck error means the line cannot do what it appears to do at all.
const FORBIDDEN_CODES = ["SC2086", "SC2046", "SC2155"];

function trackedShellScripts() {
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

function shellcheckFindings(shellcheck, files) {
  const run = spawnSync(shellcheck, ["-x", "-f", "gcc", ...files], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  // shellcheck exits 1 whenever it reports anything, so only a crash (>1) or a
  // missing binary is a harness failure.
  assert.ok(run.status !== null && run.status <= 1, run.stderr || `shellcheck status ${run.status}`);
  return run.stdout.split("\n").filter((line) => /\[SC\d+\]\s*$/.test(line));
}

test("no shell script lets the shell reinterpret or discard a value", (t) => {
  const shellcheck = requireTool(t, "shellcheck", { purpose: "lint every tracked shell script" });
  if (shellcheck === null) {
    return;
  }

  const findings = shellcheckFindings(shellcheck, trackedShellScripts());
  const offenders = findings.filter((line) =>
    FORBIDDEN_CODES.some((code) => line.includes(`[${code}]`)),
  );

  assert.deepEqual(offenders, [], `shell reinterprets these values:\n${offenders.join("\n")}`);
});

test("no shell script contains a shellcheck error", (t) => {
  const shellcheck = requireTool(t, "shellcheck", { purpose: "lint every tracked shell script" });
  if (shellcheck === null) {
    return;
  }

  const errors = shellcheckFindings(shellcheck, trackedShellScripts()).filter((line) =>
    line.includes(": error:"),
  );

  assert.deepEqual(errors, [], `shellcheck errors:\n${errors.join("\n")}`);
});
