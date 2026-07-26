import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { findTool, isContinuousIntegration, requireTool } from "./required_tool.mjs";

function scratchDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `nmp-${prefix}-`));
}

function writeExecutable(dir, name) {
  const target = path.join(dir, name);
  fs.writeFileSync(target, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  return target;
}

test("findTool returns the executable it located on the supplied search path", (t) => {
  const dir = scratchDir("findtool");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const expected = writeExecutable(dir, "shellcheck");

  assert.equal(findTool("shellcheck", { PATH: dir }), expected);
});

test("findTool honours search-path order so the first match wins", (t) => {
  const first = scratchDir("order-first");
  const second = scratchDir("order-second");
  t.after(() => {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  });
  const winner = writeExecutable(first, "lsof");
  writeExecutable(second, "lsof");

  assert.equal(findTool("lsof", { PATH: `${first}${path.delimiter}${second}` }), winner);
});

test("findTool ignores a match that the current process cannot execute", (t) => {
  const dir = scratchDir("nonexec");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "shellcheck"), "not executable\n", { mode: 0o644 });

  assert.equal(findTool("shellcheck", { PATH: dir }), null);
});

test("findTool ignores a directory that shares the tool name", (t) => {
  const dir = scratchDir("dirname");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "shellcheck"), { mode: 0o755 });

  assert.equal(findTool("shellcheck", { PATH: dir }), null);
});

test("findTool skips unreadable and empty search-path entries instead of throwing", (t) => {
  const dir = scratchDir("gaps");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const expected = writeExecutable(dir, "jq");
  const missing = path.join(dir, "does-not-exist");

  const searchPath = ["", missing, dir, ""].join(path.delimiter);
  assert.equal(findTool("jq", { PATH: searchPath }), expected);
});

test("findTool reports nothing when the search path is absent or empty", () => {
  assert.equal(findTool("shellcheck", {}), null);
  assert.equal(findTool("shellcheck", { PATH: "" }), null);
});

test("findTool rejects a tool name that could escape the search path", () => {
  for (const name of ["", "   ", "../shellcheck", "bin/shellcheck", "shell check"]) {
    assert.throws(() => findTool(name, { PATH: "/usr/bin" }), /tool name/i, `accepted ${JSON.stringify(name)}`);
  }
  assert.throws(() => findTool(undefined, { PATH: "/usr/bin" }), /tool name/i);
});

test("isContinuousIntegration treats the conventional CI values as automation", () => {
  assert.equal(isContinuousIntegration({ CI: "true" }), true);
  assert.equal(isContinuousIntegration({ CI: "1" }), true);
  assert.equal(isContinuousIntegration({ CI: "TRUE" }), true);
  assert.equal(isContinuousIntegration({ GITHUB_ACTIONS: "true" }), true);
});

test("isContinuousIntegration treats an absent or disabled flag as a developer machine", () => {
  assert.equal(isContinuousIntegration({}), false);
  assert.equal(isContinuousIntegration({ CI: "" }), false);
  assert.equal(isContinuousIntegration({ CI: "false" }), false);
  assert.equal(isContinuousIntegration({ CI: "0" }), false);
});

test("requireTool returns the resolved path when the tool is installed", (t) => {
  const dir = scratchDir("require-ok");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const expected = writeExecutable(dir, "shellcheck");
  const context = { skip: () => assert.fail("an installed tool must not skip the test") };

  assert.equal(requireTool(context, "shellcheck", { env: { PATH: dir, CI: "true" } }), expected);
});

test("requireTool fails the test when the tool is missing under CI", () => {
  const context = { skip: () => assert.fail("CI must never skip a verification gate") };

  assert.throws(
    () => requireTool(context, "shellcheck", { env: { PATH: "", CI: "true" } }),
    (error) => {
      assert.match(error.message, /shellcheck/);
      assert.match(error.message, /not installed/i);
      return true;
    },
  );
});

test("requireTool skips locally so a developer without the tool is not blocked", () => {
  const skipped = [];
  const context = { skip: (reason) => skipped.push(reason) };

  assert.equal(requireTool(context, "shellcheck", { env: { PATH: "", CI: "false" } }), null);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0], /shellcheck/);
});

test("requireTool defaults to the live environment when no env is supplied", () => {
  const context = { skip: () => {} };
  const resolved = requireTool(context, "node");

  assert.equal(resolved, findTool("node", process.env));
});

test("requireTool refuses a test context that cannot record a skip", () => {
  assert.throws(() => requireTool({}, "shellcheck", { env: { PATH: "", CI: "false" } }), /skip/i);
  assert.throws(() => requireTool(null, "shellcheck", { env: { PATH: "", CI: "false" } }), /skip/i);
});
