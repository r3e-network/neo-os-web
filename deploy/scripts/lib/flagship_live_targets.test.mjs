import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

test("flagship live validation covers every flagship miniapp", () => {
  const script = fs.readFileSync(
    path.join(repoRoot, "deploy/scripts/live_validate_flagship_user_flows.js"),
    "utf8",
  );

  const targetNames = [...script.matchAll(/\["([^"]+)",\s*run[A-Za-z]+\]/g)].map((match) => match[1]);

  assert.deepEqual(targetNames, [
    "dailyCheckin",
    "lastSurvivor",
    "gasBox",
    "fogPlay",
    "redEnvelope",
    "profitAnchor",
    "trustAnchor",
    "selfLoan",
    "neoPay",
  ]);
});

test("anchor AA proxy smoke witness matches the AA core scoped transaction rule", () => {
  const script = fs.readFileSync(
    path.join(repoRoot, "deploy/scripts/live_validate_flagship_user_flows.js"),
    "utf8",
  );

  assert.match(script, /function aaProxySigner/);
  assert.match(script, /normalizeHash160\(AA_CORE_HASH\)/);
  assert.match(script, /normalizeHash160\(targetContract\)/);
  assert.match(script, /scopes:\s*CozNeon\.tx\.WitnessScope\.WitnessRules/);
});
