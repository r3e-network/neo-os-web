import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// Requiring the report builder must be side-effect free (require.main guard):
// without it this import would write docs/reports files and process.exit(1).
const {
  KNOWN_MISSING_LIVE_HARNESS,
  expectedActiveMiniAppCount,
  liveHarnessCoverageOk,
} = require("../build_goal_validation_report.js");
const { buildCoverageRows, summarizeCoverage } = require("../audit_live_harness_coverage.js");

test("goal gate derives the active miniapp total from the live harness audit source", () => {
  const rows = buildCoverageRows({ root: repoRoot });
  assert.equal(expectedActiveMiniAppCount(), rows.length);
});

test("goal gate accepts the live harness audit's current output", () => {
  const summary = summarizeCoverage(buildCoverageRows({ root: repoRoot }));
  assert.ok(
    liveHarnessCoverageOk(summary, expectedActiveMiniAppCount()),
    `current audit output must pass the goal gate: ${JSON.stringify(summary)}`,
  );
});

test("every allowlisted live-harness gap is still reported by the audit", () => {
  const summary = summarizeCoverage(buildCoverageRows({ root: repoRoot }));
  for (const id of KNOWN_MISSING_LIVE_HARNESS) {
    assert.ok(
      summary.missingLiveChainHarness.includes(id),
      `${id} is allowlisted in build_goal_validation_report.js but the audit no longer reports it — remove the stale allowlist entry`,
    );
  }
});

test("goal gate rejects drifted live-harness summaries", () => {
  const expected = expectedActiveMiniAppCount();
  const base = {
    totalActive: expected,
    missingLiveChainHarness: [...KNOWN_MISSING_LIVE_HARNESS],
    blockedNoTestnetContract: [],
  };

  assert.ok(liveHarnessCoverageOk(base, expected));
  // A closed gap (empty missing list) must still pass.
  assert.ok(
    liveHarnessCoverageOk({ ...base, missingLiveChainHarness: [] }, expected),
  );
  // Count drift, an unknown uncovered app, or a blocked app must fail.
  assert.ok(!liveHarnessCoverageOk({ ...base, totalActive: expected + 1 }, expected));
  assert.ok(
    !liveHarnessCoverageOk(
      { ...base, missingLiveChainHarness: [...KNOWN_MISSING_LIVE_HARNESS, "miniapp-new"] },
      expected,
    ),
  );
  assert.ok(
    !liveHarnessCoverageOk({ ...base, blockedNoTestnetContract: ["miniapp-new"] }, expected),
  );
  assert.ok(!liveHarnessCoverageOk(null, expected));
  assert.ok(!liveHarnessCoverageOk({ ...base, missingLiveChainHarness: null }, expected));
});
