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

test("goal report uses the current active miniapp count for UI evidence", () => {
  const report = require("../build_goal_validation_report.js").buildReport();
  const runtimeUi = report.requirements.find(({ id }) => id === "frontend.runtime-ui");
  const coverage = report.requirements.find(({ id }) => id === "miniapps.coverage");
  const expected = expectedActiveMiniAppCount();

  assert.match(runtimeUi.title, new RegExp(`All ${expected} active miniapps`));
  assert.equal(runtimeUi.status, "pass");
  assert.match(coverage.title, new RegExp(`All ${expected} active miniapps`));
});

test("goal report accepts current host and admin gate counts without hardcoding totals", () => {
  const report = require("../build_goal_validation_report.js").buildReport();
  const gate = report.requirements.find(({ id }) => id === "platform.host-admin-gates");

  assert.equal(gate.status, "pass");
  assert.deepEqual(gate.evidence.host_full.checks, {
    jestSuites: true,
    jestTests: true,
    e2e: true,
  });
  assert.deepEqual(gate.evidence.local_gates.checks, {
    completed: true,
    adminTests: true,
    adminFiles: true,
  });
});

test("goal report keeps combined Oracle gate counts scoped to their headings", () => {
  const report = require("../build_goal_validation_report.js").buildReport();
  const gate = report.requirements.find(({ id }) => id === "oracle.service-gates");

  assert.equal(gate.status, "pass");
  assert.equal(gate.evidence.worker.pass, 470);
  assert.equal(gate.evidence.relayer.pass, 440);
  assert.equal(gate.evidence.runtime_matrix.pass, 6);
  assert.equal(gate.evidence.web_build.compiled, true);
  assert.equal(gate.evidence.web_build.staticPages, true);
});
