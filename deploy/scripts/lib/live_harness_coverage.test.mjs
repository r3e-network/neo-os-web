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
  // features.stateless === false plus that real testnet contract, which made
  // the two expectations mutually unsatisfiable while this branch keyed on
  // `stateless`. A contract-bound app must be exercised by a live-flow script,
  // so the honest classification is a real gap, not a pure UI flow. The intent
  // of this line — pin asset-factory's classification so it cannot drift
  // silently — is preserved; only the expected value is corrected.
  assert.equal(byId.get("miniapp-asset-factory")?.coverage, "missing-live-chain-harness");
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

  // KNOWN RED, LEFT DELIBERATELY UNBUMPED: the audit reports 77 active
  // manifests, not 71. This literal is a stale constant that fell behind as
  // apps were added — bumping it to match current output is exactly the reflex
  // that lets a count drift unnoticed, so the correction is left to the owner
  // of the app-count question rather than smuggled in here.
  assert.equal(summary.totalActive, 71);
  // The gaps below are apps that DECLARE a chain surface (a contract binding,
  // platform.transactions, or a write permission) but have no registered
  // live-chain harness. This list is REAL, not a misclassification, and the
  // audit is expected to keep reporting it: the corresponding gate in
  // build_goal_validation_report.js allowlists only miniapp-neo-multisig, so it
  // stays red until each gap gets a live-flow script. Do NOT widen that
  // allowlist to make it pass — a green gate here would mean the audit stopped
  // reporting real gaps.
  //
  // RE-PINNED from ["miniapp-neo-multisig"]: that expectation was written while
  // this branch keyed on features.stateless, an OVERLOADED field the audit read
  // as "needs no live-chain harness" while apps/shared/test/stateful-manifest-truth.test.ts
  // defines it as "persists progress or transaction recovery". Reading it here
  // both hid contract-bound gaps behind a stateless:true and swept in 16
  // chainless apps that merely set stateless:false. The classifier now derives
  // the signal instead, which drops the 16 false gaps and surfaces the true set
  // below. The intent of this pin — fail on any drift, whether a new uncovered
  // app appears or a gap is closed — is unchanged.
  //
  //   - miniapp-neo-multisig: harness EXISTS (live_validate_multisig.mjs) but is
  //     intentionally not yet wired into LIVE_CHAIN_FLOWS; registering it means
  //     trimming the allowlist in build_goal_validation_report.js in the same
  //     coordinated change.
  //   - miniapp-asset-factory / miniapp-miniapp-factory / miniapp-nft-factory /
  //     miniapp-oracle-price-console: deployed testnet contract, no live flow.
  //   - miniapp-neo-treasury / miniapp-timestamp-proof: bind no contract but
  //     declare platform.transactions + a write permission, so they assert a
  //     chain surface no harness exercises. Either the flow needs a script or
  //     the manifest overstates the app — both are real findings.
  assert.deepEqual(summary.missingLiveChainHarness, [
    "miniapp-asset-factory",
    "miniapp-miniapp-factory",
    "miniapp-neo-multisig",
    "miniapp-neo-treasury",
    "miniapp-nft-factory",
    "miniapp-oracle-price-console",
    "miniapp-timestamp-proof",
  ]);
  assert.deepEqual(summary.blockedNoTestnetContract, []);
});
