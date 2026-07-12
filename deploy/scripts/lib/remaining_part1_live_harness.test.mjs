import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const scriptPath = path.resolve("deploy/scripts/live_validate_remaining_contracts_part1.js");
const source = fs.readFileSync(scriptPath, "utf8");

test("part1 live harness selects distinct live actors instead of skipping Breakup", () => {
  assert.match(source, /LIVE_ACTOR_WIFS/);
  assert.match(source, /user = chooseDistinctLiveActor\("default user", \[admin\]\)/);
  assert.doesNotMatch(source, /breakup: .*Skipping test/);
});

test("part1 live harness resolves DevTipping manager from all configured live actors", () => {
  assert.match(source, /function findLiveActorByHash/);
  assert.match(source, /const managerAccount = findLiveActorByHash\(onchainAdmin\)/);
  assert.match(source, /const tipperAccount = chooseDistinctLiveActor\("devtipping tipper", \[managerAccount\]\)/);
  assert.doesNotMatch(source, /return \{ skipped: true, reason: "admin mismatch" \}/);
});

test("part1 live harness validates the deployed standalone Tarot ABI", () => {
  assert.match(source, /apps", "on-chain-tarot", "neo-manifest\.json"/);
  assert.match(source, /"miniapp-tarot:draw"/);
  assert.match(source, /userContract\.invoke\("draw"/);
  assert.match(source, /findNotification\(log\.execution, hash, "ReadingDrawn"\)/);
  assert.match(source, /invokeRead\(hash, "getReading"/);
  assert.doesNotMatch(source, /userContract\.invoke\("requestReading"/);
});
