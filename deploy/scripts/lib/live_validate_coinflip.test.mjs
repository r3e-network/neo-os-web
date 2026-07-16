import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("../live_validate_coinflip.mjs", import.meta.url),
);

test("FogPlay live harness exercises the deployed V2 commit/reveal ABI", () => {
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /operation:\s*"transfer"/);
  assert.match(source, /"commit"/);
  assert.match(source, /"settle"/);
  assert.match(source, /BEACON_BLOCKS\s*=\s*3/);
  assert.match(source, /event\(commitLog,\s*"Committed"\)/);
  assert.match(source, /event\(settleLog,\s*"Settled"\)/);
  assert.doesNotMatch(source, /operation:\s*"flip"/);
});
