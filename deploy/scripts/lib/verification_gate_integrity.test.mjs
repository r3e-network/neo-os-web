import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// A verification gate that skips itself reports the same green as a gate that
// passed, so a suite full of conditional skips can hide any defect the gates
// were built to catch. `requireTool` (deploy/scripts/lib/required_tool.mjs) is
// the one sanctioned way to depend on an external tool: it skips only on a
// developer machine and fails under CI. These tests keep that the only way --
// no test may reach for the raw skip API, and every CI job that runs the
// deploy-script suite must install the tools those gates need.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// The tools the deploy-script suite resolves through requireTool. Each one is a
// hard requirement under CI, so the workflow has to install it.
const TOOLS_REQUIRED_BY_GATES = ["shellcheck", "lsof"];

// Built at runtime: spelling the raw skip call as a literal here would make this
// file its own first offender.
const RAW_SKIP_CALL = ["\\.", "skip", "\\("].join("");

function trackedTestFiles() {
  const listed = spawnSync(
    "git",
    [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "*.test.mjs",
      "*.test.js",
      "*.test.ts",
      "*.test.tsx",
    ],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  assert.equal(listed.status, 0, listed.stderr);
  const files = listed.stdout
    .split("\0")
    .filter(Boolean)
    .filter((file) => !file.includes("node_modules/"));
  assert.ok(files.length > 0, "expected the repository to contain test files");
  return files;
}

function jobsInWorkflow(workflow) {
  // ci.yml jobs are the only two-space-indented mapping keys under `jobs:`.
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  assert.ok(start >= 0, "ci.yml must declare a jobs: mapping");

  const jobs = new Map();
  let current = null;
  for (const line of lines.slice(start + 1)) {
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (header) {
      current = header[1];
      jobs.set(current, []);
      continue;
    }
    if (current !== null) {
      jobs.get(current).push(line);
    }
  }
  assert.ok(jobs.size > 0, "ci.yml must declare at least one job");
  return jobs;
}

test("no test reaches for the raw skip API instead of requireTool", () => {
  const sanctioned = path.join("deploy", "scripts", "lib", "required_tool.mjs");
  const needle = new RegExp(RAW_SKIP_CALL);
  const offenders = [];

  for (const file of trackedTestFiles()) {
    if (file === sanctioned) continue;
    const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
    source.split("\n").forEach((line, index) => {
      if (needle.test(line)) {
        offenders.push(`${file}:${index + 1}`);
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    `these tests can silently skip themselves; depend on a tool through requireTool() instead:\n${offenders.join("\n")}`,
  );
});

test("requireTool is the only availability check the deploy-script gates use", () => {
  // The pattern that preceded requireTool: a local `<tool>Available()` helper
  // wrapping `command -v` or `--version`, whose false branch skipped the gate.
  const legacyProbe = /function\s+\w*[Aa]vailable\s*\(/;
  const offenders = [];

  for (const file of trackedTestFiles()) {
    if (!file.startsWith("deploy/scripts/lib/")) continue;
    const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
    if (legacyProbe.test(source)) {
      offenders.push(file);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `these tests probe for a tool themselves instead of using requireTool():\n${offenders.join("\n")}`,
  );
});

test("every ci job running the deploy-script suite installs the tools those gates need", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
  const jobs = jobsInWorkflow(workflow);

  const runners = [...jobs.entries()].filter(([, body]) =>
    body.some((line) => /run:.*\btest:deploy-scripts\b/.test(line) || /run:.*\bverify:repo\b/.test(line)),
  );
  assert.ok(
    runners.length > 0,
    "ci.yml must run the deploy-script gates (test:deploy-scripts or verify:repo)",
  );

  for (const [name, body] of runners) {
    const text = body.join("\n");
    for (const tool of TOOLS_REQUIRED_BY_GATES) {
      assert.match(
        text,
        new RegExp(`\\b${tool}\\b`),
        `ci job "${name}" runs the deploy-script gates but never installs ${tool}, so those gates would fail there`,
      );
    }
  }
});

test("the tools the gates require are the tools the workflow installs", () => {
  // Keeps TOOLS_REQUIRED_BY_GATES honest: every tool actually passed to
  // requireTool() in the suite must be listed above, or a new dependency could
  // be added without the workflow learning about it.
  const requested = new Set();
  for (const file of trackedTestFiles()) {
    if (!file.startsWith("deploy/scripts/lib/")) continue;
    if (file.endsWith("required_tool.test.mjs")) continue;
    const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
    for (const match of source.matchAll(/requireTool\(\s*\w+\s*,\s*"([^"]+)"/g)) {
      requested.add(match[1]);
    }
  }

  assert.ok(requested.size > 0, "expected the deploy-script suite to depend on at least one tool");
  const unlisted = [...requested].filter((tool) => !TOOLS_REQUIRED_BY_GATES.includes(tool)).sort();
  assert.deepEqual(
    unlisted,
    [],
    `these tools are required by a gate but absent from TOOLS_REQUIRED_BY_GATES (and so from the workflow): ${unlisted.join(", ")}`,
  );
});
