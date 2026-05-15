#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const APPS_DIR = path.join(ROOT, "apps");
const DEFAULT_REPORT_PATH = path.join(
  ROOT,
  "docs",
  "reports",
  "live-smoke",
  "live-harness-coverage-latest.json"
);

const ARCHIVED_APP_SLUGS = new Set(["neoburger", "neo-burger", "flamingo", "flaminggo"]);

const LIVE_CHAIN_FLOWS = new Map([
  ["miniapp-aa-account-lab", { script: "deploy/scripts/live_validate_aa_ns_miniapps.js", target: "account" }],
  ["miniapp-aa-market-hub", { script: "deploy/scripts/live_validate_aa_ns_miniapps.js", target: "market" }],
  ["miniapp-aa-permissions-lab", { script: "deploy/scripts/live_validate_aa_ns_miniapps.js", target: "permissions" }],
  ["miniapp-aa-relay-console", { script: "deploy/scripts/live_validate_aa_ns_miniapps.js", target: "relay" }],
  ["miniapp-aa-session-key-lab", { script: "deploy/scripts/live_validate_aa_ns_miniapps.js", target: "session" }],
  ["miniapp-breakupcontract", { script: "deploy/scripts/live_validate_remaining_contracts_part1.js", target: "breakup" }],
  ["miniapp-burn-league", { script: "deploy/scripts/live_validate_remaining_contracts_part1.js", target: "burnleague" }],
  ["miniapp-council-governance", { script: "deploy/scripts/live_validate_council_governance.js", target: "council" }],
  ["miniapp-dailycheckin", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "dailyCheckin" }],
  ["miniapp-dev-tipping", { script: "deploy/scripts/live_validate_remaining_contracts_part1.js", target: "devtipping" }],
  ["miniapp-event-ticket-pass", { script: "deploy/scripts/live_validate_remaining_contracts_part2.js", target: "eventticket" }],
  ["miniapp-flashloan", { script: "deploy/scripts/live_validate_selected_miniapps.js", target: "flashloan" }],
  ["miniapp-fogplay", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "fogPlay" }],
  ["miniapp-gas-sponsor", { script: "deploy/scripts/live_validate_remaining_contracts_part2.js", target: "gassponsor" }],
  ["miniapp-gasbox", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "gasBox" }],
  ["miniapp-gov-merc", { script: "deploy/scripts/live_validate_remaining_contracts_part3.js", target: "govmerc" }],
  ["miniapp-graveyard", { script: "deploy/scripts/live_validate_selected_miniapps.js", target: "graveyard" }],
  ["miniapp-last-survivor", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "lastSurvivor" }],
  ["miniapp-memorial-shrine", { script: "deploy/scripts/live_validate_remaining_contracts_part2.js", target: "memorial" }],
  ["miniapp-milestone-escrow", { script: "deploy/scripts/live_validate_remaining_contracts_part2.js", target: "milestone" }],
  ["miniapp-neo-pay", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "neoPay" }],
  ["miniapp-neo-ns", { script: "deploy/scripts/live_validate_aa_ns_miniapps.js", target: "neons" }],
  ["miniapp-onchaintarot", { script: "deploy/scripts/live_validate_remaining_contracts_part1.js", target: "tarot" }],
  ["miniapp-profitanchor", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "profitAnchor" }],
  ["miniapp-quadratic-funding", { script: "deploy/scripts/live_validate_remaining_contracts_part3.js", target: "quadratic" }],
  ["miniapp-redenvelope", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "redEnvelope" }],
  ["miniapp-self-loan", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "selfLoan" }],
  ["miniapp-soulbound-certificate", { script: "deploy/scripts/live_validate_remaining_contracts_part2.js", target: "soulbound" }],
  ["miniapp-time-capsule", { script: "deploy/scripts/live_validate_remaining_contracts_part3.js", target: "timecapsule" }],
  ["miniapp-trustanchor", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "trustAnchor" }],
  ["miniapp-unbreakablevault", { script: "deploy/scripts/live_validate_remaining_contracts_part1.js", target: "vault" }],
]);

const SHARED_RUNTIME_FLOWS = new Map([
  [
    "PlatformAnchor",
    {
      script: "deploy/scripts/live_validate_flagship_user_flows.js",
      target: "profitAnchor/trustAnchor",
      coveredBy: ["miniapp-profitanchor", "miniapp-trustanchor"],
    },
  ],
  [
    "PlatformGame",
    {
      script: "deploy/scripts/live_validate_flagship_user_flows.js",
      target: "lastSurvivor/gasBox/fogPlay",
      coveredBy: ["miniapp-last-survivor", "miniapp-gasbox", "miniapp-fogplay"],
    },
  ],
]);

const SERVER_BACKED_FLOWS = new Map([
  [
    "miniapp-gas-lucky-pool",
    {
      script: "apps/shared/test/gas-lucky-pool.logic.test.ts",
      target: "onegate-vault-claim",
      coveredBy: [
        "platform/host-app/__tests__/api/onegate-vault.claim.test.ts",
        "platform/host-app/__tests__/api/onegate-vault.status.test.ts",
        "platform/host-app/__tests__/lib/onegate-vault.test.ts",
      ],
    },
  ],
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asNetworkHash(manifest, network) {
  return String(manifest?.contracts?.[network] || "").trim();
}

function isActiveManifest(manifest) {
  const status = String(manifest?.status || "").trim().toLowerCase();
  return !status || status === "active";
}

function runtimePlatforms(manifest) {
  const modules = Array.isArray(manifest?.runtime?.modules) ? manifest.runtime.modules : [];
  return modules.map((module) => String(module?.platform || "").trim()).filter(Boolean);
}

function readActiveManifests(root = ROOT) {
  const appsDir = path.join(root, "apps");
  return fs
    .readdirSync(appsDir)
    .filter((slug) => !ARCHIVED_APP_SLUGS.has(slug.toLowerCase()))
    .filter((slug) => fs.existsSync(path.join(appsDir, slug, "neo-manifest.json")))
    .map((slug) => {
      const manifest = readJson(path.join(appsDir, slug, "neo-manifest.json"));
      return { slug, manifest };
    })
    .filter(({ manifest }) => isActiveManifest(manifest))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function classifyCoverage({ slug, manifest }) {
  const id = String(manifest.id || "").trim();
  const testnetHash = asNetworkHash(manifest, "neo-n3-testnet");
  const mainnetHash = asNetworkHash(manifest, "neo-n3-mainnet");
  const stateless = Boolean(manifest?.features?.stateless);

  if (LIVE_CHAIN_FLOWS.has(id)) {
    return {
      coverage: "live-chain-flow",
      harness: LIVE_CHAIN_FLOWS.get(id),
      action: null,
    };
  }

  if (SERVER_BACKED_FLOWS.has(id)) {
    return {
      coverage: "server-backed-flow",
      harness: SERVER_BACKED_FLOWS.get(id),
      action: null,
    };
  }

  for (const platform of runtimePlatforms(manifest)) {
    if (SHARED_RUNTIME_FLOWS.has(platform)) {
      return {
        coverage: "shared-runtime-flow",
        harness: { runtime: platform, ...SHARED_RUNTIME_FLOWS.get(platform) },
        action: null,
      };
    }
  }

  if (!testnetHash && mainnetHash) {
    return {
      coverage: "blocked-no-testnet-contract",
      harness: null,
      action: "deploy or configure a testnet contract before a full live-chain business-flow test can run",
    };
  }

  if (testnetHash) {
    return {
      coverage: "missing-live-chain-harness",
      harness: null,
      action: "add an app-specific testnet live-flow script that exercises the primary user workflow",
    };
  }

  if (stateless) {
    return {
      coverage: "stateless-ui-flow",
      harness: {
        script: "npm run verify:miniapp-dapps && npm run build:miniapp-dapps && npm run audit:miniapps:playareas",
        target: "standalone-ui-workflow",
      },
      action: null,
    };
  }

  return {
    coverage: "missing-live-chain-harness",
    harness: null,
    action: "classify the app as stateless or add a testnet live-flow script",
  };
}

function buildCoverageRows({ root = ROOT } = {}) {
  return readActiveManifests(root).map(({ slug, manifest }) => {
    const classified = classifyCoverage({ slug, manifest });
    return {
      slug,
      id: manifest.id || "",
      name: manifest.name || slug,
      coverage: classified.coverage,
      testnetHash: asNetworkHash(manifest, "neo-n3-testnet") || null,
      mainnetHash: asNetworkHash(manifest, "neo-n3-mainnet") || null,
      stateless: Boolean(manifest?.features?.stateless),
      runtimePlatforms: runtimePlatforms(manifest),
      harness: classified.harness,
      action: classified.action,
    };
  });
}

function summarizeCoverage(rows) {
  const byCoverage = rows.reduce((acc, row) => {
    acc[row.coverage] = (acc[row.coverage] || 0) + 1;
    return acc;
  }, {});
  return {
    totalActive: rows.length,
    byCoverage,
    missingLiveChainHarness: rows
      .filter((row) => row.coverage === "missing-live-chain-harness")
      .map((row) => row.id),
    blockedNoTestnetContract: rows
      .filter((row) => row.coverage === "blocked-no-testnet-contract")
      .map((row) => row.id),
  };
}

function writeReport(report, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
}

function main() {
  const outputPath = String(process.env.LIVE_HARNESS_COVERAGE_REPORT_PATH || DEFAULT_REPORT_PATH);
  const rows = buildCoverageRows({ root: ROOT });
  const report = {
    generatedAt: new Date().toISOString(),
    summary: summarizeCoverage(rows),
    rows,
  };
  writeReport(report, outputPath);
  console.log(`Report: ${outputPath}`);
  console.log(JSON.stringify(report.summary, null, 2));

  if (process.argv.includes("--fail-on-missing") && report.summary.missingLiveChainHarness.length > 0) {
    throw new Error(
      `missing live-chain harness: ${report.summary.missingLiveChainHarness.join(", ")}`
    );
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  buildCoverageRows,
  classifyCoverage,
  summarizeCoverage,
  LIVE_CHAIN_FLOWS,
  SERVER_BACKED_FLOWS,
  SHARED_RUNTIME_FLOWS,
};
