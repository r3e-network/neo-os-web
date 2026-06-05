import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { buildCoverageRows, summarizeCoverage } = require("../audit_live_harness_coverage.js");

test("live harness coverage classifies representative active miniapps", () => {
  const rows = buildCoverageRows({ root: repoRoot });
  const byId = new Map(rows.map((row) => [row.id, row]));

  assert.equal(byId.get("miniapp-dailycheckin")?.coverage, "live-chain-flow");
  assert.equal(byId.get("miniapp-custom-anchor")?.coverage, "shared-runtime-flow");
  assert.equal(byId.get("miniapp-gas-lucky-pool")?.coverage, "server-backed-flow");
  assert.equal(byId.get("miniapp-asset-factory")?.coverage, "stateless-ui-flow");
  assert.equal(byId.get("miniapp-recovery-guardian")?.coverage, "live-chain-flow");
  assert.equal(byId.get("miniapp-aa-account-lab")?.coverage, "live-chain-flow");
  assert.equal(byId.get("miniapp-aa-market-hub")?.coverage, "live-chain-flow");
  assert.equal(byId.get("miniapp-aa-permissions-lab")?.coverage, "live-chain-flow");
  assert.equal(byId.get("miniapp-aa-relay-console")?.coverage, "live-chain-flow");
  assert.equal(byId.get("miniapp-aa-session-key-lab")?.coverage, "live-chain-flow");
  assert.equal(byId.get("miniapp-neo-ns")?.coverage, "live-chain-flow");
});

test("live harness coverage summary exposes fix lists", () => {
  const rows = buildCoverageRows({ root: repoRoot });
  const summary = summarizeCoverage(rows);

  assert.equal(summary.totalActive, 60);
  // miniapp-neo-multisig now ships a deployed testnet contract
  // (0xa89f8dd1ebc0e29561c4c3e9ad60ec307b9a473e) but has no registered live-chain
  // harness in LIVE_CHAIN_FLOWS, so the audit correctly classifies it as
  // missing-live-chain-harness. This is a real coverage gap (a dedicated
  // deploy/scripts/live_validate_* flow for the on-chain approval contract is still
  // missing), not a misclassification — the expectation is pinned to the exact known
  // gap so any further drift (a new uncovered app, or this gap being closed) fails here.
  assert.deepEqual(summary.missingLiveChainHarness, ["miniapp-neo-multisig"]);
  assert.deepEqual(summary.blockedNoTestnetContract, []);
});
