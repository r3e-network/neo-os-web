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

  assert.equal(summary.totalActive, 61);
  // Two apps now ship a deployed testnet contract but have no registered live-chain
  // harness in LIVE_CHAIN_FLOWS, so the audit correctly classifies each as
  // missing-live-chain-harness (the testnet-hash branch fires before the
  // stateless-ui-flow fallback, which is intended — an on-chain contract should be
  // exercised by a live-flow script, not treated as a pure UI flow):
  //   - miniapp-neo-multisig: v2 contract 0xa361cdc792e97c4d8ddf42048cf48f3283ea7178
  //     (replacing v1 0xa89f8dd1ebc0e29561c4c3e9ad60ec307b9a473e which stays live for
  //     user exits); the on-chain approval flow still needs a dedicated
  //     deploy/scripts/live_validate_* script.
  // (miniapp-dice-game now has a registered harness — deploy/scripts/live_validate_dicegame.mjs
  // for the self-contained MiniAppDiceGame 0x2c6134f9… — so it is no longer a gap.)
  // This is a real coverage gap, not a misclassification — the expectation is pinned to
  // the exact known set (sorted by app slug, matching readActiveManifests' ordering) so
  // any further drift (a new uncovered app, or the gap being closed) fails here.
  assert.deepEqual(summary.missingLiveChainHarness, ["miniapp-neo-multisig"]);
  assert.deepEqual(summary.blockedNoTestnetContract, []);
});
