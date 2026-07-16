import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("../live_validate_dicegame_v2.mjs", import.meta.url),
);

test("Dice live harness waits for the deployed three-block V2 beacon", () => {
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /BEACON_BLOCKS\s*=\s*3/);
  assert.match(source, /event\(commitLog,\s*"Committed"\)/);
  assert.match(source, /event\(settleLog,\s*"Settled"\)/);
  assert.match(source, /BET \* 57n \/ 10n/);
  assert.match(source, /waitForBeacon\(commitIndex\)/);
  assert.doesNotMatch(source, /while \(h <= commitH/);
});
