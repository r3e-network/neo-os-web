import test from "node:test";
import assert from "node:assert/strict";

import { requireCredential, allowSkip, ALLOW_SKIP_ENV } from "./live_credentials.js";

function captureExit() {
  const calls = [];
  return {
    calls,
    exit: (code) => {
      calls.push(code);
      throw new Error(`exit:${code}`);
    },
  };
}

test("returns the trimmed credential when present", () => {
  const { exit } = captureExit();
  assert.equal(requireCredential("NEO_TESTNET_WIF", "  abc  ", { env: {}, exit, log: () => {} }), "abc");
});

test("missing credential exits non-zero by default", () => {
  const { calls, exit } = captureExit();
  const logs = [];
  assert.throws(
    () => requireCredential("NEO_TESTNET_WIF", "", { env: {}, exit, log: (m) => logs.push(m) }),
    /exit:1/
  );
  assert.deepEqual(calls, [1]);
  assert.match(logs[0], /NEO_TESTNET_WIF is required/);
  assert.match(logs[0], new RegExp(ALLOW_SKIP_ENV));
});

test("LIVE_SMOKE_ALLOW_SKIP=1 turns the failure into an explicit exit-0 skip", () => {
  const { calls, exit } = captureExit();
  const logs = [];
  assert.throws(
    () =>
      requireCredential("NEO_TESTNET_WIF", undefined, {
        env: { [ALLOW_SKIP_ENV]: "1" },
        exit,
        log: (m) => logs.push(m),
      }),
    /exit:0/
  );
  assert.deepEqual(calls, [0]);
  assert.match(logs[0], /skipping/);
});

test("only the exact value 1 enables the skip", () => {
  assert.equal(allowSkip({ [ALLOW_SKIP_ENV]: "1" }), true);
  assert.equal(allowSkip({ [ALLOW_SKIP_ENV]: " 1 " }), true);
  assert.equal(allowSkip({ [ALLOW_SKIP_ENV]: "true" }), false);
  assert.equal(allowSkip({ [ALLOW_SKIP_ENV]: "0" }), false);
  assert.equal(allowSkip({}), false);
});

test("throws (instead of continuing) when exit is stubbed without throwing", () => {
  // Guards against a stubbed exit that returns: control flow must not fall
  // through to "credential ok" paths.
  assert.throws(
    () => requireCredential("X_WIF", "", { env: {}, exit: () => {}, log: () => {} }),
    /X_WIF is required/
  );
});
