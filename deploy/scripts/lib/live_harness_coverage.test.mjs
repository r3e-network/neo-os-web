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
  // RE-PINNED (was "stateless-ui-flow"). This assertion was written when
  // asset-factory bound no contract; it gained its testnet Factory binding
  // 0x03a7c8fc… in 0dd7c4af1, AFTER this line was authored, so the assertion —
  // not the classifier — is the stale side. It also contradicted a second
  // required gate: apps/shared/test/asset-factory.production.test.ts:234 pins
  // asset-factory's gap was CLOSED 2026-07-18 by live_validate_miniapp_factory.mjs
  // (the shared MiniAppFactory registry harness covering all three factory
  // apps). The pin's intent — fail if the classification drifts — is preserved;
  // the expectation now locks in the live-chain-flow classification.
  assert.equal(byId.get("miniapp-asset-factory")?.coverage, "live-chain-flow");
  // The derived ui-only branch is still covered here, by an app that genuinely
  // declares no chain surface (no contract, no platform.transactions, no write
  // permission) — and which features.stateless would have MISCLASSIFIED, since
  // it persists progress and therefore honestly sets stateless: false.
  assert.equal(byId.get("miniapp-arrow-escape")?.coverage, "ui-only-flow");
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

  // App-count question OWNED (2026-07-25): the census confirms 78 active
  // manifests — this literal was stale at 77. The 78th is miniapp-gomoku,
  // classified ui-only-flow because it declares no chain surface (no contract
  // binding, no platform.transactions, no write permission), so it adds no
  // live-harness obligation and the two fix lists below stay empty. Bumped
  // deliberately, not reflexively; the derived-count gate in
  // goal_validation_report.test.mjs (expectedActiveMiniAppCount() ==
  // rows.length) independently proves 78.
  assert.equal(summary.totalActive, 78);
  // The gap list is EMPTY as of 2026-07-18: every chain-surface app has a
  // registered live-flow script. The pin's intent — fail on any drift, whether
  // a NEW uncovered app appears or a registration is dropped — is unchanged;
  // an empty list is now the only passing state. (Closed by
  // live_validate_oracle_price_console.mjs, live_validate_miniapp_factory.mjs
  // [covers all three factory apps], live_validate_timestamp_proof.mjs,
  // live_validate_neo_treasury.mjs, live_validate_neo_multisig.mjs.)
  assert.deepEqual(summary.missingLiveChainHarness, []);
  assert.deepEqual(summary.blockedNoTestnetContract, []);
});
