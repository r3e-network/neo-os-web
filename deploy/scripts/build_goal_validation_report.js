#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const REPORT_DIR = path.join(ROOT, "docs/reports");
const JSON_REPORT = path.join(REPORT_DIR, "goal-validation-latest.json");
const MD_REPORT = path.join(REPORT_DIR, "goal-validation-latest.md");
const DEFAULT_ORACLE_ROOT = path.resolve(ROOT, "../neo-morpheus-oracle");

const INPUTS = {
  runtimeUi: path.join(REPORT_DIR, "miniapp-runtime-ui-latest.json"),
  coverage: path.join(REPORT_DIR, "miniapp-coverage-latest.json"),
  playareas: path.join(REPORT_DIR, "miniapp-playarea-functionality-latest.json"),
  liveHarness: path.join(REPORT_DIR, "live-smoke/live-harness-coverage-latest.json"),
  businessCompleteness: path.join(REPORT_DIR, "miniapp-business-completeness-latest.json"),
  runtimeScreenshotsDir: path.join(REPORT_DIR, "miniapp-runtime-ui-screenshots"),
  contractDomains: path.join(REPORT_DIR, "contract-domain-coverage-latest.json"),
  mainnetMethods: path.join(REPORT_DIR, "mainnet-miniapp-contract-methods-latest.json"),
  hostFullLog: process.env.GOAL_HOST_FULL_LOG || "/tmp/host-app-full-current.redacted.log",
  platformLocalGatesLog:
    process.env.GOAL_PLATFORM_LOCAL_GATES_LOG || "/tmp/platform-local-gates-current.redacted.log",
  directLog: process.env.GOAL_DIRECT_TESTNET_LOG || "/tmp/cross_repo_testnet_direct.redacted.log",
  testnetBackfillLogs: [
    process.env.GOAL_TESTNET_BACKFILL_LOG || "/tmp/testnet-market-hours-backfill-retry.redacted.log",
    process.env.GOAL_TESTNET_BACKFILL_REST_LOG ||
      "/tmp/testnet-market-hours-backfill-rest.redacted.log",
    process.env.GOAL_TESTNET_CONTINUOUS_BACKFILL_LOG ||
      "/tmp/testnet-continuous-backfill-current.redacted.log",
  ],
  mainnetFreshness:
    process.env.GOAL_MAINNET_FRESHNESS_JSON || "/tmp/feed-freshness-mainnet-current.json",
  testnetFreshness:
    process.env.GOAL_TESTNET_FRESHNESS_JSON || "/tmp/feed-freshness-testnet-current.json",
  betterstack: process.env.GOAL_BETTERSTACK_JSON || "/tmp/betterstack-current.json",
};

const ORACLE_ROOT = path.resolve(process.env.MORPHEUS_DIR || DEFAULT_ORACLE_ROOT);
const ORACLE_INPUTS = {
  drift: path.join(ORACLE_ROOT, "docs/reports/feed-registry-drift-latest.json"),
  controlPlaneSmoke:
    process.env.GOAL_CONTROL_PLANE_SMOKE_JSON ||
    path.join(ORACLE_ROOT, "examples/deployments/control-plane-smoke.testnet.latest.json"),
  workerLog: process.env.GOAL_ORACLE_WORKER_LOG || "/tmp/oracle-worker-current.redacted.log",
  relayerLog: process.env.GOAL_ORACLE_RELAYER_LOG || "/tmp/oracle-relayer-current.redacted.log",
  runtimeMatrixLog:
    process.env.GOAL_ORACLE_RUNTIME_MATRIX_LOG || "/tmp/oracle-runtime-matrix-current.redacted.log",
  webBuildLog: process.env.GOAL_ORACLE_WEB_BUILD_LOG || "/tmp/oracle-web-build-current.redacted.log",
};

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function normalizeLogText(text) {
  return String(text || "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "\n");
}

function status(ok, partial = false) {
  if (ok) return "pass";
  return partial ? "partial" : "fail";
}

function extractTxHashes(text) {
  return Array.from(new Set(String(text || "").match(/0x[a-fA-F0-9]{64}/g) || [])).sort();
}

function hasText(text, pattern) {
  return pattern.test(normalizeLogText(text));
}

function extractFirstInt(text, pattern) {
  const match = normalizeLogText(text).match(pattern);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function readLogChecks(text, checks) {
  return Object.fromEntries(
    Object.entries(checks).map(([key, pattern]) => [key, hasText(text, pattern)])
  );
}

function countFilesWithExtension(dirPath, extension) {
  try {
    return fs.readdirSync(dirPath).filter((name) => name.endsWith(extension)).length;
  } catch {
    return 0;
  }
}

function extractTestSummary(text) {
  const pass = extractFirstInt(text, /(?:^|\n)\s*(?:#\s*)?(?:ℹ\s*)?pass\s+(\d+)/);
  const fail = extractFirstInt(text, /(?:^|\n)\s*(?:#\s*)?(?:ℹ\s*)?fail\s+(\d+)/);
  return {
    pass,
    fail,
    has_passes: Number.isInteger(pass) && pass > 0,
    fail0: fail === 0,
  };
}

function countContractStateErrors(mainnetMethods) {
  const value = mainnetMethods?.contractStateErrors;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number") return value;
  return null;
}

function buildRequirement(id, title, evidence, ok, partial = false, notes = []) {
  return {
    id,
    title,
    status: status(ok, partial),
    evidence,
    notes,
  };
}

function countFailures(report) {
  if (!report) return null;
  if (Array.isArray(report.failures)) return report.failures.length;
  if (Array.isArray(report.failed)) return report.failed.length;
  if (typeof report.failed === "number") return report.failed;
  if (typeof report.failures === "number") return report.failures;
  if (Array.isArray(report.summary?.gaps)) return report.summary.gaps.length;
  if (typeof report.summary?.needsFollowUp === "number") return report.summary.needsFollowUp;
  return null;
}

function countWarnings(report) {
  if (!report) return null;
  if (Array.isArray(report.warnings)) return report.warnings.length;
  if (typeof report.warnings === "number") return report.warnings;
  if (typeof report.summary?.cleanupWarnings === "number") return report.summary.cleanupWarnings;
  return null;
}

function buildReport() {
  const runtimeUi = readJson(INPUTS.runtimeUi);
  const coverage = readJson(INPUTS.coverage);
  const playareas = readJson(INPUTS.playareas);
  const liveHarness = readJson(INPUTS.liveHarness);
  const businessCompleteness = readJson(INPUTS.businessCompleteness);
  const contractDomains = readJson(INPUTS.contractDomains);
  const mainnetMethods = readJson(INPUTS.mainnetMethods);
  const mainnetFreshness = readJson(INPUTS.mainnetFreshness);
  const testnetFreshness = readJson(INPUTS.testnetFreshness);
  const betterstack = readJson(INPUTS.betterstack);
  const drift = readJson(ORACLE_INPUTS.drift);
  const hostFullLog = readText(INPUTS.hostFullLog);
  const platformLocalGatesLog = readText(INPUTS.platformLocalGatesLog);
  const directLog = readText(INPUTS.directLog);
  const backfillLogs = INPUTS.testnetBackfillLogs.map(readText).filter(Boolean).join("\n");
  const oracleWorkerLog = readText(ORACLE_INPUTS.workerLog);
  const oracleRelayerLog = readText(ORACLE_INPUTS.relayerLog);
  const oracleRuntimeMatrixLog = readText(ORACLE_INPUTS.runtimeMatrixLog);
  const oracleWebBuildLog = readText(ORACLE_INPUTS.webBuildLog);
  const controlPlaneSmoke = readJson(ORACLE_INPUTS.controlPlaneSmoke);

  const directTxHashes = extractTxHashes(directLog);
  const backfillTxHashes = extractTxHashes(backfillLogs);
  const runtimeWarningCount = countWarnings(runtimeUi);
  const runtimeFailureCount = countFailures(runtimeUi);
  const playareaFailureCount = countFailures(playareas);
  const liveHarnessSummary = liveHarness?.summary || liveHarness || {};
  const businessFailureCount = countFailures(businessCompleteness);
  const businessWarningCount = countWarnings(businessCompleteness);
  const runtimeScreenshotPngCount = countFilesWithExtension(INPUTS.runtimeScreenshotsDir, ".png");
  const hasRuntimeScreenshotEvidence =
    runtimeUi?.screenshots_enabled === true || runtimeScreenshotPngCount >= 120;
  const contractDomainSummary = contractDomains?.summary || contractDomains || {};
  const contractStateErrorCount = countContractStateErrors(mainnetMethods);
  const hostFullChecks = readLogChecks(hostFullLog, {
    jestSuites: /Test Suites:\s+127 passed,\s+127 total/,
    jestTests: /Tests:\s+666 passed,\s+666 total/,
    e2e: /\b27 passed\b/,
  });
  const platformLocalChecks = readLogChecks(platformLocalGatesLog, {
    completed: /Local validation gates completed successfully/,
    adminTests: /Tests\s+241 passed\s+\(241\)/,
    adminFiles: /Test Files\s+25 passed\s+\(25\)/,
  });
  const oracleWorkerChecks = extractTestSummary(oracleWorkerLog);
  const oracleRelayerChecks = extractTestSummary(oracleRelayerLog);
  const oracleRuntimeChecks = extractTestSummary(oracleRuntimeMatrixLog);
  const oracleWebBuildChecks = readLogChecks(oracleWebBuildLog, {
    compiled: /Compiled successfully/,
    staticPages: /Generating static pages/,
  });
  const directChecks = {
    runtimeApiOperational: hasText(directLog, /"runtimeStatus":\s*"operational"/),
    oracleSmoke: hasText(directLog, /Direct Oracle[\s\S]*"success":\s*true/),
    aaRelayHalt: hasText(directLog, /Direct AA[\s\S]*"vmstate":\s*"HALT"/),
    completed: hasText(directLog, /Cross-repo testnet validation completed successfully/),
  };

  const betterstackDown =
    betterstack?.heartbeats?.filter((entry) => String(entry.status || "") !== "up") || [];
  const relayers =
    betterstack?.heartbeats?.filter((entry) =>
      ["morpheus-relayer", "morpheus-relayer-feed"].includes(entry.name)
    ) || [];
  const controlPlaneSmokeStatus = String(controlPlaneSmoke?.status || "");
  const controlPlaneTerminalStatus = String(controlPlaneSmoke?.terminal?.body?.status || "");
  const controlPlaneAcceptedStatus = controlPlaneSmoke?.accepted?.status || null;
  const controlPlaneSmokeOk =
    controlPlaneAcceptedStatus === 202 && controlPlaneTerminalStatus === "succeeded";

  const requirements = [
    buildRequirement(
      "platform.host-admin-gates",
      "Host app, AA surfaces, and Admin Console local gates pass tests, builds, and e2e",
      {
        host_full_log: INPUTS.hostFullLog,
        platform_local_gates_log: INPUTS.platformLocalGatesLog,
        host_full: {
          checks: hostFullChecks,
          jest_suites_passed: extractFirstInt(hostFullLog, /Test Suites:\s+(\d+) passed/),
          jest_tests_passed: extractFirstInt(hostFullLog, /Tests:\s+(\d+) passed/),
          e2e_passed: extractFirstInt(hostFullLog, /(?:^|\n)\s*(\d+)\s+passed\s+\([^)]+\)/),
        },
        local_gates: {
          checks: platformLocalChecks,
        },
      },
      hostFullChecks.jestSuites &&
        hostFullChecks.jestTests &&
        hostFullChecks.e2e &&
        platformLocalChecks.completed &&
        platformLocalChecks.adminTests &&
        platformLocalChecks.adminFiles
    ),
    buildRequirement(
      "frontend.runtime-ui",
      "All 60 miniapps render professional desktop/mobile UI without runtime failures",
      {
        file: path.relative(ROOT, INPUTS.runtimeUi),
        catalog_count: runtimeUi?.catalog_count,
        catalog_total_count: runtimeUi?.catalog_total_count,
        total_checks: runtimeUi?.total_checks,
        passed: runtimeUi?.passed,
        failed: runtimeUi?.failed,
        warnings: runtimeWarningCount,
        failures: runtimeFailureCount,
        screenshots_enabled: runtimeUi?.screenshots_enabled,
        screenshot_png_count: runtimeScreenshotPngCount,
        screenshot_dir: path.relative(ROOT, INPUTS.runtimeScreenshotsDir),
      },
      runtimeUi?.catalog_count === 60 &&
        runtimeUi?.catalog_total_count === 60 &&
        runtimeUi?.total_checks === 120 &&
        runtimeUi?.passed === 120 &&
        runtimeUi?.failed === 0 &&
        runtimeWarningCount === 0 &&
        runtimeFailureCount === 0 &&
        hasRuntimeScreenshotEvidence,
      false,
      [
        "Automated evidence covers rendering, text, controls, asset failures, horizontal overflow, and screenshots. Human aesthetic review remains qualitative.",
      ]
    ),
    buildRequirement(
      "miniapps.coverage",
      "All 60 miniapps have complete catalog, PlayArea, live harness, and chain coverage classification",
      {
        coverage_file: path.relative(ROOT, INPUTS.coverage),
        playarea_file: path.relative(ROOT, INPUTS.playareas),
        live_harness_file: path.relative(ROOT, INPUTS.liveHarness),
        coverage_summary: coverage?.summary,
        action_required: coverage?.action_required || null,
        rpc_unknown: coverage?.rpc_unknown || null,
        playarea_failures: playareaFailureCount,
        live_harness: liveHarnessSummary,
      },
      coverage?.summary?.["testnet+mainnet"] === 36 &&
        coverage?.summary?.["frontend-only"] === 24 &&
        Array.isArray(coverage?.action_required) &&
        coverage.action_required.length === 0 &&
        Array.isArray(coverage?.rpc_unknown) &&
        coverage.rpc_unknown.length === 0 &&
        playareaFailureCount === 0 &&
        liveHarnessSummary?.totalActive === 60 &&
        Array.isArray(liveHarnessSummary?.missingLiveChainHarness) &&
        liveHarnessSummary.missingLiveChainHarness.length === 0 &&
        Array.isArray(liveHarnessSummary?.blockedNoTestnetContract) &&
        liveHarnessSummary.blockedNoTestnetContract.length === 0
    ),
    buildRequirement(
      "contracts.mainnet-readiness",
      "Contract domains and mainnet read-only method surfaces have no blockers",
      {
        contract_domain_file: path.relative(ROOT, INPUTS.contractDomains),
        mainnet_methods_file: path.relative(ROOT, INPUTS.mainnetMethods),
        contract_domains: contractDomainSummary,
        mainnet_methods: {
          totalMiniapps: mainnetMethods?.totalMiniapps,
          mainnetContractApps: mainnetMethods?.mainnetContractApps,
          uniqueMainnetContracts: mainnetMethods?.uniqueMainnetContracts,
          safeInvocationsAttempted: mainnetMethods?.safeInvocationsAttempted,
          blockerCount: mainnetMethods?.blockerCount,
          contractStateErrors: contractStateErrorCount,
        },
      },
      contractDomainSummary?.total_contract_bindings === 46 &&
        contractDomainSummary?.configured === 46 &&
        contractDomainSummary?.chain_ok === 46 &&
        contractDomainSummary?.chain_missing === 0 &&
        contractDomainSummary?.chain_mismatch === 0 &&
        contractDomainSummary?.chain_error === 0 &&
        contractDomainSummary?.unique_actionable === 0 &&
        mainnetMethods?.totalMiniapps === 60 &&
        mainnetMethods?.mainnetContractApps === 36 &&
        mainnetMethods?.uniqueMainnetContracts === 27 &&
        mainnetMethods?.safeInvocationsAttempted >= 800 &&
        mainnetMethods?.blockerCount === 0 &&
        contractStateErrorCount === 0
    ),
    buildRequirement(
      "oracle.mainnet-freshness",
      "Neo mainnet pricefeed has all 33 configured pairs fresh",
      {
        source: INPUTS.mainnetFreshness,
        total: mainnetFreshness?.total,
        fresh: mainnetFreshness?.fresh,
        stale: mainnetFreshness?.stale,
        actionable_stale: mainnetFreshness?.actionable_stale,
        stale_pairs: mainnetFreshness?.stale_pairs || null,
      },
      mainnetFreshness?.total === 33 &&
        mainnetFreshness?.fresh === 33 &&
        mainnetFreshness?.stale === 0 &&
        mainnetFreshness?.actionable_stale === 0 &&
        Array.isArray(mainnetFreshness?.stale_pairs) &&
        mainnetFreshness.stale_pairs.length === 0
    ),
    buildRequirement(
      "oracle.testnet-freshness",
      "Neo testnet pricefeed has all 33 configured pairs fresh",
      {
        source: INPUTS.testnetFreshness,
        total: testnetFreshness?.total,
        fresh: testnetFreshness?.fresh,
        stale: testnetFreshness?.stale,
        actionable_stale: testnetFreshness?.actionable_stale,
        stale_pairs: testnetFreshness?.stale_pairs || null,
        backfill_tx_hashes: backfillTxHashes,
      },
      testnetFreshness?.total === 33 &&
        testnetFreshness?.fresh === 33 &&
        testnetFreshness?.stale === 0 &&
        testnetFreshness?.actionable_stale === 0 &&
        Array.isArray(testnetFreshness?.stale_pairs) &&
        testnetFreshness.stale_pairs.length === 0
    ),
    buildRequirement(
      "oracle.drift",
      "Configured feed registry pairs are present on chain with no blocking drift",
      {
        file: path.relative(ORACLE_ROOT, ORACLE_INPUTS.drift),
        summary: drift?.summary || null,
        legacy_extra_onchain_pairs: (drift?.reports || []).flatMap(
          (report) => report.legacy_extra_onchain_pairs || []
        ),
      },
      drift?.summary?.status === "pass" &&
        drift?.summary?.missing_onchain_pair_count === 0 &&
        drift?.summary?.configured_onchain_stale_pair_count === 0 &&
        drift?.summary?.blocking_issue_count === 0,
      false,
      [
        "Legacy extra on-chain records are classified as non-blocking because the deployed datafeed contract has no safe per-pair delete method.",
      ]
    ),
    buildRequirement(
      "oracle.service-gates",
      "Oracle worker, relayer, runtime matrix, and web build gates pass",
      {
        worker_log: ORACLE_INPUTS.workerLog,
        relayer_log: ORACLE_INPUTS.relayerLog,
        runtime_matrix_log: ORACLE_INPUTS.runtimeMatrixLog,
        web_build_log: ORACLE_INPUTS.webBuildLog,
        worker: oracleWorkerChecks,
        relayer: oracleRelayerChecks,
        runtime_matrix: oracleRuntimeChecks,
        web_build: oracleWebBuildChecks,
      },
      oracleWorkerChecks.has_passes &&
        oracleWorkerChecks.fail0 &&
        oracleRelayerChecks.has_passes &&
        oracleRelayerChecks.fail0 &&
        oracleRuntimeChecks.has_passes &&
        oracleRuntimeChecks.fail0 &&
        oracleWebBuildChecks.compiled &&
        oracleWebBuildChecks.staticPages
    ),
    buildRequirement(
      "oracle.control-plane-smoke",
      "Control plane accepts and completes a durable testnet oracle job",
      {
        file: path.relative(ORACLE_ROOT, ORACLE_INPUTS.controlPlaneSmoke),
        network: controlPlaneSmoke?.network || null,
        route: controlPlaneSmoke?.route || null,
        accepted_status: controlPlaneAcceptedStatus,
        terminal_status: controlPlaneTerminalStatus || controlPlaneSmokeStatus || null,
      },
      controlPlaneSmokeOk,
      false,
      controlPlaneSmokeStatus === "storage_quota_restricted"
        ? [
            "Supabase storage quota is restricting durable job writes; restore or expand the backing store, then rerun the control-plane smoke.",
          ]
        : controlPlaneSmoke === null
          ? ["Control-plane smoke report was not readable."]
          : []
    ),
    buildRequirement(
      "oracle.betterstack",
      "Relayer and feed heartbeat monitors are up",
      {
        source: INPUTS.betterstack,
        total_heartbeats: betterstack?.total_heartbeats,
        down: betterstackDown.map((entry) => ({ name: entry.name, status: entry.status })),
        relayers: relayers.map((entry) => ({ name: entry.name, status: entry.status })),
      },
      betterstack?.total_heartbeats >= 2 &&
        betterstackDown.length === 0 &&
        relayers.length === 2 &&
        relayers.every((entry) => entry.status === "up")
    ),
    buildRequirement(
      "cross-repo.transactions",
      "Cross-repo testnet path can submit Oracle and AA paymaster transactions",
      {
        source: INPUTS.directLog,
        checks: directChecks,
        tx_hashes: directTxHashes,
      },
      directChecks.runtimeApiOperational &&
        directChecks.oracleSmoke &&
        directChecks.aaRelayHalt &&
        directChecks.completed &&
        directTxHashes.length >= 3
    ),
    buildRequirement(
      "business-completeness",
      "Miniapp business completeness report has no failures",
      {
        file: path.relative(ROOT, INPUTS.businessCompleteness),
        failures: businessFailureCount,
        warnings: businessWarningCount,
        summary: businessCompleteness?.summary || null,
      },
      businessFailureCount === 0 && businessWarningCount === 0,
      businessCompleteness === null,
      businessCompleteness === null ? ["Business completeness report was not readable."] : []
    ),
  ];

  const failed = requirements.filter((entry) => entry.status === "fail");
  const partial = requirements.filter((entry) => entry.status === "partial");
  return {
    generated_at: new Date().toISOString(),
    objective_scope: [
      "60 miniapps",
      "miniapp platform UI",
      "host app and admin console local gates",
      "AA surfaces and paymaster relay",
      "mainnet contract domain and read-only method surfaces",
      "oracle services and pricefeeds",
      "control-plane durable oracle job path",
      "cross-repo testnet transaction path",
      "contract/runtime drift evidence",
    ],
    summary: {
      status: failed.length === 0 && partial.length === 0 ? "pass" : failed.length ? "fail" : "partial",
      requirement_count: requirements.length,
      pass: requirements.filter((entry) => entry.status === "pass").length,
      partial: partial.length,
      fail: failed.length,
      direct_testnet_tx_count: directTxHashes.length,
      testnet_feed_backfill_tx_count: backfillTxHashes.length,
    },
    inputs: {
      platform_root: ROOT,
      oracle_root: ORACLE_ROOT,
      ...INPUTS,
      oracle: ORACLE_INPUTS,
    },
    requirements,
  };
}

function writeReports(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(JSON_REPORT, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    "# Goal Validation Report",
    "",
    `Generated: ${report.generated_at}`,
    `Status: ${report.summary.status}`,
    `Requirements: ${report.summary.pass} pass, ${report.summary.partial} partial, ${report.summary.fail} fail`,
    `Direct testnet tx count: ${report.summary.direct_testnet_tx_count}`,
    `Testnet feed backfill tx count: ${report.summary.testnet_feed_backfill_tx_count}`,
    "",
    "## Requirements",
    "",
  ];

  for (const requirement of report.requirements) {
    lines.push(`- ${requirement.status.toUpperCase()} ${requirement.id}: ${requirement.title}`);
    if (requirement.notes?.length) {
      for (const note of requirement.notes) lines.push(`  - ${note}`);
    }
  }

  lines.push("", "## Evidence Files", "");
  lines.push(`- JSON: ${path.relative(ROOT, JSON_REPORT)}`);
  lines.push(`- Runtime UI: ${path.relative(ROOT, INPUTS.runtimeUi)}`);
  lines.push(`- Miniapp coverage: ${path.relative(ROOT, INPUTS.coverage)}`);
  lines.push(`- Contract domains: ${path.relative(ROOT, INPUTS.contractDomains)}`);
  lines.push(`- Mainnet methods: ${path.relative(ROOT, INPUTS.mainnetMethods)}`);
  lines.push(`- Feed drift: ${path.relative(ORACLE_ROOT, ORACLE_INPUTS.drift)}`);
  lines.push("");
  fs.writeFileSync(MD_REPORT, `${lines.join("\n")}\n`);
}

const report = buildReport();
writeReports(report);
console.log(JSON.stringify({ report: JSON_REPORT, markdown: MD_REPORT, summary: report.summary }, null, 2));
if (report.summary.status === "fail") process.exit(1);
