import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const scriptPath = path.resolve("deploy/scripts/live_validate_remaining_contracts_part3.js");
const source = fs.readFileSync(scriptPath, "utf8");

test("part3 live harness selects a NEO-capable actor for GovMerc deposit flow", () => {
  assert.match(source, /chooseNeoCapableActor/);
  assert.match(source, /async function chooseLiveNeoActor/);
  assert.match(source, /const govUser = await chooseLiveNeoActor\("govmerc", 1n, \[admin\]\)/);
  assert.match(source, /transfer\(neoByGovUser, govUser, hash, "1", null\)/);
  assert.match(source, /hash160\(`0x\$\{govUser\.scriptHash\}`\)/);
});

test("part3 live harness uses distinct interaction actors instead of silently skipping user workflows", () => {
  assert.match(source, /const qfUser = await chooseDistinctGasActor\("quadratic", \[admin\]\)/);
  assert.match(source, /const capsuleUser = await chooseDistinctGasActor\("timecapsule", \[admin\]\)/);
  assert.equal(source.includes("return { skipped: true"), false);
});
