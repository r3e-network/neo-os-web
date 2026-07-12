import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = "scripts/verify-device-qa-env.mjs";

function run(value) {
  const env = { ...process.env };
  delete env.VITE_BUILD_SHA;
  if (value !== undefined) env.VITE_BUILD_SHA = value;
  return spawnSync(process.execPath, [script], {
    cwd: root,
    env,
    encoding: "utf8",
  });
}

describe("Device QA build env gate", () => {
  it("rejects a missing VITE_BUILD_SHA", () => {
    const result = run(undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /VITE_BUILD_SHA must be set/);
  });

  it("rejects the runtime placeholder build id", () => {
    const result = run("local-unbound");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /VITE_BUILD_SHA must be set/);
  });

  it("rejects documentation placeholders and ad hoc labels", () => {
    for (const value of ["<git-sha>", "dev", "test", "qa-build"]) {
      const result = run(value);
      assert.notEqual(result.status, 0, value);
    }
  });

  it("accepts a short git commit SHA", () => {
    const result = run("abc1234");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Device QA env gate passed/);
  });

  it("accepts a full git commit SHA", () => {
    const result = run("0123456789abcdef0123456789abcdef01234567");
    assert.equal(result.status, 0, result.stderr);
  });
});
