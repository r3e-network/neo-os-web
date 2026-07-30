import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

/**
 * These two gates read gate logs whose default paths are under /tmp. Asserting
 * they report "pass" therefore asserted that somebody had recently run those
 * gates on this machine and that macOS had not swept /tmp yet - so they failed
 * on a clean checkout and in CI, and passing meant nothing about this code.
 *
 * They now drive the builder with logs written for the test, through the same
 * environment overrides the builder already supports. Each asserts both
 * directions: the markers it looks for produce a pass, and their absence
 * produces a fail. That is a test of the parsing, which is the part that lives
 * in this repo.
 */
function buildReportWithLogs(logs) {
  const dir = mkdtempSync(path.join(tmpdir(), "goal-report-"));
  const env = {};
  for (const [envName, { file, body }] of Object.entries(logs)) {
    const target = path.join(dir, file);
    writeFileSync(target, body);
    env[envName] = target;
  }

  const previous = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    // INPUTS is read when the module is evaluated, so the overrides only take
    // effect on a fresh load.
    delete require.cache[require.resolve("../build_goal_validation_report.js")];
    return require("../build_goal_validation_report.js").buildReport();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[require.resolve("../build_goal_validation_report.js")];
    rmSync(dir, { recursive: true, force: true });
  }
}

const HOST_FULL_PASSING = [
  "Test Suites: 120 passed, 120 total",
  "Tests:       1206 passed, 1206 total",
  "  42 passed (3.1m)",
].join("\n");

const PLATFORM_GATES_PASSING = [
  "Test Files  61 passed (61)",
  "Tests  405 passed (405)",
  "Local validation gates completed successfully",
].join("\n");

const hostGateOf = (report) =>
  report.requirements.find(({ id }) => id === "platform.host-admin-gates");

test("host/admin gate passes on the markers it looks for", () => {
  const gate = hostGateOf(
    buildReportWithLogs({
      GOAL_HOST_FULL_LOG: { file: "host-full.log", body: HOST_FULL_PASSING },
      GOAL_PLATFORM_LOCAL_GATES_LOG: { file: "gates.log", body: PLATFORM_GATES_PASSING },
    }),
  );

  assert.equal(gate.status, "pass");
  assert.deepEqual(gate.evidence.host_full.checks, { jestSuites: true, jestTests: true, e2e: true });
  assert.deepEqual(gate.evidence.local_gates.checks, {
    completed: true,
    adminTests: true,
    adminFiles: true,
  });
  // The counts are reported, never compared against a hardcoded total - a suite
  // growing by one test must not turn this gate red.
  assert.equal(gate.evidence.host_full.jest_tests_passed, 1206);
});

test("host/admin gate fails when a log is missing its markers", () => {
  const gate = hostGateOf(
    buildReportWithLogs({
      GOAL_HOST_FULL_LOG: { file: "host-full.log", body: HOST_FULL_PASSING },
      GOAL_PLATFORM_LOCAL_GATES_LOG: { file: "gates.log", body: "gates did not finish\n" },
    }),
  );

  assert.equal(gate.status, "fail");
  assert.equal(gate.evidence.local_gates.checks.completed, false);
});

// worker and relayer counts come out of the SAME oracle log; only the
// "=== <heading> ===" slicing keeps them apart. Distinct numbers under each
// heading are what proves the slicing still happens.
const ORACLE_LOG = [
  "=== Worker Local Gates ===",
  "ℹ pass 470",
  "ℹ fail 0",
  "=== Relayer Local Gates ===",
  "ℹ pass 440",
  "ℹ fail 0",
  "=== Web Local Gates ===",
  "Compiled successfully",
  "Generating static pages (12/12)",
  "ℹ pass 12",
  "ℹ fail 0",
].join("\n");

const RUNTIME_MATRIX_LOG = [
  "=== Control Plane Local Gates ===",
  "ℹ pass 6",
  "ℹ fail 0",
].join("\n");

const oracleGateOf = (report) =>
  report.requirements.find(({ id }) => id === "oracle.service-gates");

test("oracle gate scopes each count to its own heading in the combined log", () => {
  const gate = oracleGateOf(
    buildReportWithLogs({
      GOAL_ORACLE_WORKER_LOG: { file: "oracle.log", body: ORACLE_LOG },
      GOAL_ORACLE_RELAYER_LOG: { file: "oracle.log", body: ORACLE_LOG },
      GOAL_ORACLE_WEB_BUILD_LOG: { file: "oracle.log", body: ORACLE_LOG },
      GOAL_ORACLE_RUNTIME_MATRIX_LOG: { file: "matrix.log", body: RUNTIME_MATRIX_LOG },
    }),
  );

  // Reading the file whole would give every section the first count, 470.
  assert.equal(gate.evidence.worker.pass, 470);
  assert.equal(gate.evidence.relayer.pass, 440);
  assert.equal(gate.evidence.runtime_matrix.pass, 6);
  assert.equal(gate.evidence.web_build.compiled, true);
  assert.equal(gate.evidence.web_build.staticPages, true);
});

// The same log with the relayer section failing. Everything before and after it
// is untouched, so a gate that ignored the headings would still see the worker's
// "pass 470 / fail 0" first and call the whole thing green.
const ORACLE_LOG_RELAYER_FAILING = ORACLE_LOG.replace(
  "=== Relayer Local Gates ===\nℹ pass 440\nℹ fail 0",
  "=== Relayer Local Gates ===\nℹ pass 0\nℹ fail 3",
);

test("oracle gate reports a failing section rather than the first passing one", () => {
  const body = ORACLE_LOG_RELAYER_FAILING;
  const gate = oracleGateOf(
    buildReportWithLogs({
      GOAL_ORACLE_WORKER_LOG: { file: "oracle.log", body },
      GOAL_ORACLE_RELAYER_LOG: { file: "oracle.log", body },
      GOAL_ORACLE_WEB_BUILD_LOG: { file: "oracle.log", body },
      GOAL_ORACLE_RUNTIME_MATRIX_LOG: { file: "matrix.log", body: RUNTIME_MATRIX_LOG },
    }),
  );

  assert.equal(gate.evidence.worker.pass, 470);
  assert.equal(gate.evidence.relayer.fail, 3);
  assert.equal(gate.evidence.relayer.fail0, false);
  assert.equal(gate.status, "fail");
});
