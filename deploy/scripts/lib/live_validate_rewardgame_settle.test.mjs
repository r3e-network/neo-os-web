import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../live_validate_rewardgame_settle.mjs", import.meta.url),
  "utf8",
);

test("live RewardGame harness persists standardized lifecycle evidence", () => {
  assert.match(source, /buildLifecycleEvidence/);
  assert.match(source, /writeLifecycleEvidence/);
  assert.match(source, /lifecycleEvidenceDirectory/);
  assert.match(source, /chainWritesPerformed/);
  assert.match(source, /persistLifecycleEvidence\("pass"\)/);
  assert.match(source, /persistLifecycleEvidence\("fail"\)/);
});

test("lifecycle evidence wiring does not serialize signing credentials", () => {
  const evidenceSection = source.slice(
    source.indexOf("function persistLifecycleEvidence"),
    source.indexOf("async function main"),
  );

  assert.doesNotMatch(evidenceSection, /NEO_TESTNET_WIF/);
  assert.doesNotMatch(evidenceSection, /PRIVATE_KERNEL_VERIFIER_WIF/);
  assert.doesNotMatch(evidenceSection, /verifierWif/);
});
