import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const scriptPath = path.join(repoRoot, "deploy", "scripts", "live_validate_council_governance.js");

test("council live harness can prepare ephemeral testnet candidate accounts without leaking secrets", () => {
  const script = fs.readFileSync(scriptPath, "utf8");

  assert.match(script, /COUNCIL_AUTO_PREPARE_TEST_CANDIDATES/);
  assert.match(script, /new Neon\.wallet\.Account\(\)/);
  assert.match(script, /registerCandidate/);
  assert.match(script, /vote", \[/);
  assert.match(script, /cleanupEphemeralCandidates/);
  assert.match(script, /ephemeralCandidateAccounts/);
  assert.match(script, /COUNCIL_AUTO_CANDIDATE_EXTRA_GAS \|\| "2000"/);
  assert.match(script, /function syncEphemeralCandidateReport/);
  assert.match(script, /async function waitForTokenBalance/);
  assert.match(script, /candidatePreparation\.ephemeralCandidateAccounts\.push\(reportEphemeralCandidate\(entry\)\)/);

  const trackingIndex = script.indexOf("preparedEphemeralByAddress.set(candidate.address, entry)");
  const fundGasIndex = script.indexOf('"council.autoCandidate.fundGas"');
  const registerIndex = script.indexOf('"council.autoCandidate.registerCandidate"');
  assert.ok(trackingIndex > -1, "ephemeral candidate should be registered for cleanup");
  assert.ok(trackingIndex < fundGasIndex, "ephemeral candidate should be tracked before funding");
  assert.ok(trackingIndex < registerIndex, "ephemeral candidate should be tracked before registration");
  assert.ok(script.indexOf("await waitForTokenBalance(GAS_HASH") < registerIndex);
  assert.ok(script.indexOf("await waitForTokenBalance(NEO_HASH") < registerIndex);

  const reportStart = script.indexOf("function reportEphemeralCandidate");
  const reportEnd = script.indexOf("async function prepareEphemeralCandidate");
  const reportBody = script.slice(reportStart, reportEnd);
  assert.doesNotMatch(reportBody, /WIF/);
  assert.doesNotMatch(reportBody, /privateKey/);
});
