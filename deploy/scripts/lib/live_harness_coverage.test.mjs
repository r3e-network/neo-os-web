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
  assert.equal(byId.get("miniapp-aim-master")?.coverage, "server-backed-flow");
  assert.equal(byId.get("miniapp-jump-rush")?.coverage, "server-backed-flow");
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

  assert.equal(summary.totalActive, 71);
  // One app now ships a deployed testnet contract but has no registered live-chain
  // harness in LIVE_CHAIN_FLOWS, so the audit correctly classifies it as
  // missing-live-chain-harness (the testnet-hash branch fires before the
  // stateless-ui-flow fallback, which is intended: an on-chain contract should be
  // exercised by a live-flow script, not treated as a pure UI flow).
  //   - miniapp-neo-multisig: v2 contract 0xa361cdc792e97c4d8ddf42048cf48f3283ea7178
  //     (replacing v1 0xa89f8dd1ebc0e29561c4c3e9ad60ec307b9a473e which stays live for
  //     user exits). The on-chain approval-flow harness now EXISTS
  //     (deploy/scripts/live_validate_multisig.mjs), but it is intentionally NOT yet
  //     wired into LIVE_CHAIN_FLOWS here: removing miniapp-neo-multisig from the audit
  //     output would diverge from the KNOWN_MISSING_LIVE_HARNESS allowlist in
  //     build_goal_validation_report.js (a separate file). Registering the flow +
  //     trimming both allowlists is a single coordinated follow-up; until then the
  //     audit keeps reporting the gap and this assertion stays green.
  // (miniapp-dice-game now has a registered harness, and the new Morpheus games
  // have a server-backed liveness harness that verifies deployed contracts,
  // oracle / TEE signer configuration, and public runtime health.)
  // This is a real coverage gap, not a misclassification — the expectation is pinned to
  // the exact known set (sorted by app slug, matching readActiveManifests' ordering) so
  // any further drift (a new uncovered app, or the gap being closed) fails here.
  assert.deepEqual(summary.missingLiveChainHarness, ["miniapp-neo-multisig"]);
  assert.deepEqual(summary.blockedNoTestnetContract, []);
});
