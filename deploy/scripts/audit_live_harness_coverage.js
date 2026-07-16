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
  ["miniapp-recovery-guardian", { script: "deploy/scripts/live_validate_aa_ns_miniapps.js", target: "recovery" }],
  ["miniapp-breakupcontract", { script: "deploy/scripts/live_validate_remaining_contracts_part1.js", target: "breakup" }],
  ["miniapp-burn-league", { script: "deploy/scripts/live_validate_remaining_contracts_part1.js", target: "burnleague" }],
  ["miniapp-council-governance", { script: "deploy/scripts/live_validate_council_governance.js", target: "council" }],
  ["miniapp-dailycheckin", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "dailyCheckin" }],
  ["miniapp-dev-tipping", { script: "deploy/scripts/live_validate_remaining_contracts_part1.js", target: "devtipping" }],
  ["miniapp-dice-game", { script: "deploy/scripts/live_validate_dicegame.mjs", target: "dicegame" }],
  ["miniapp-event-ticket-pass", { script: "deploy/scripts/live_validate_remaining_contracts_part2.js", target: "eventticket" }],
  ["miniapp-flashloan", { script: "deploy/scripts/live_validate_selected_miniapps.js", target: "flashloan" }],
  // C6 NOTE: fogplay migrated to the standalone MiniAppCoinFlip contract and a per-app
  // harness exists (deploy/scripts/live_validate_coinflip.mjs), but retargeting here
  // requires removing the matching fogPlay task from FLAGSHIP_TASKS in
  // live_validate_flagship_user_flows.js (enforced by flagship_live_targets.test.mjs) —
  // that validator is a separate, out-of-scope file, so the routing flip is deferred to a
  // coordinated follow-up. The flagship flow still exercises the dead PlatformGame kernel path.
  ["miniapp-fogplay", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "fogPlay" }],
  ["miniapp-gas-sponsor", { script: "deploy/scripts/live_validate_remaining_contracts_part2.js", target: "gassponsor" }],
  // gasbox migrated to the standalone MiniAppGasBox contract, but no per-app standalone
  // harness exists yet (the flagship PlatformGame flow exercises the dead kernel ABI keyed
  // by appId). This entry keeps it classified as live-chain-flow until a dedicated
  // deploy/scripts/live_validate_gasbox.mjs against MiniAppGasBox 0xeb635b6e… is written;
  // reclassifying it as missing-live-chain-harness here would diverge from the
  // KNOWN_MISSING_LIVE_HARNESS allowlist in build_goal_validation_report.js. KNOWN GAP.
  ["miniapp-gasbox", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "gasBox" }],
  ["miniapp-gov-merc", { script: "deploy/scripts/live_validate_remaining_contracts_part3.js", target: "govmerc" }],
  ["miniapp-graveyard", { script: "deploy/scripts/live_validate_selected_miniapps.js", target: "graveyard" }],
  // C6 NOTE: last-survivor migrated to the standalone MiniAppLastSurvivor contract and a
  // per-app harness exists (deploy/scripts/live_validate_lastsurvivor.mjs), but retargeting
  // requires removing the lastSurvivor task from FLAGSHIP_TASKS (out-of-scope validator;
  // see fogplay note) — deferred to a coordinated follow-up.
  ["miniapp-last-survivor", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "lastSurvivor" }],
  ["miniapp-memorial-shrine", { script: "deploy/scripts/live_validate_remaining_contracts_part2.js", target: "memorial" }],
  ["miniapp-milestone-escrow", { script: "deploy/scripts/live_validate_remaining_contracts_part2.js", target: "milestone" }],
  ["miniapp-neo-pay", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "neoPay" }],
  // Shared example: reuses neo-pay's exact contract, so neo-pay's flow covers it.
  ["miniapp-neo-pay-shared-example", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "neoPay" }],
  ["miniapp-neo-message", { script: "deploy/scripts/live_validate_neo_message.mjs", target: "neo-message" }],
  ["miniapp-neo-ns", { script: "deploy/scripts/live_validate_aa_ns_miniapps.js", target: "neons" }],
  ["miniapp-onchaintarot", { script: "deploy/scripts/live_validate_remaining_contracts_part1.js", target: "tarot" }],
  ["miniapp-profitanchor", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "profitAnchor" }],
  ["miniapp-quadratic-funding", { script: "deploy/scripts/live_validate_remaining_contracts_part3.js", target: "quadratic" }],
  ["miniapp-redenvelope", { script: "deploy/scripts/live_validate_flagship_user_flows.js", target: "redEnvelope" }],
  // C6 NOTE: self-loan migrated to the standalone MiniAppSelfLoan contract and a per-app
  // smoke exists (deploy/scripts/live_validate_selfloan_smoke.mjs, owner-path; full lifecycle
  // in the NeoVM TestEngine), but retargeting requires removing the selfLoan task from
  // FLAGSHIP_TASKS (out-of-scope validator; see fogplay note) — deferred to a coordinated follow-up.
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
  ...[
    "miniapp-aim-master",
    "miniapp-color-clash",
    "miniapp-flappy-dash",
    "miniapp-game-2048",
    "miniapp-jump-rush",
    "miniapp-curve-arrow",
    "miniapp-merge-kingdom",
    "miniapp-pet-potion",
    "miniapp-sheep-solitaire",
    "miniapp-snake-bounty",
    "miniapp-sudoku",
  ].map((id) => [
    id,
    {
      script: "deploy/scripts/live_validate_morpheus_game_liveness.mjs",
      target: "morpheus-game-contract-runtime-liveness",
      coveredBy: [
        "testnet contract state",
        "Morpheus oracle / TEE signer config",
        "public Morpheus runtime health",
      ],
    },
  ]),
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

/**
 * S11 permissions that authorize a BROADCAST. `read:blockchain` is deliberately
 * absent: a read-only app has no user workflow a live-chain business-flow script
 * could exercise beyond what the RPC read itself proves.
 */
const CHAIN_WRITE_PERMISSIONS = new Set(["invoke:primary", "write:blockchain"]);

/**
 * Does this manifest DECLARE a chain surface — i.e. is a live-chain business
 * flow a thing this app even has?
 *
 * This is deliberately DERIVED from facts the manifest already states rather
 * than read from a dedicated opt-out field. Two prior signals were rejected:
 *
 *   - `features.stateless` (what this branch used to read) is OVERLOADED. The
 *     audit read it as "needs no live-chain harness", but
 *     apps/shared/test/stateful-manifest-truth.test.ts defines it as "persists
 *     progress or transaction recovery". The two meanings are orthogonal: 19
 *     active apps are chainless AND stateful (16 of them land on the ui-only
 *     branch below), so no single value of the flag can be true for both
 *     readers at once — which is why this branch reported 16 false gaps.
 *   - A NEW dedicated field would be one more thing that can drift away from
 *     the code and lie — which is exactly how `stateless` rotted here.
 *
 * A contract binding / `platform.transactions` / a write permission cannot go
 * stale the same way: they are the facts the runtime itself is gated on, so an
 * app that starts writing to chain must change one of them to work at all.
 */
function declaresChainSurface(manifest) {
  const contracts = manifest?.contracts;
  const hasContractBinding =
    Boolean(contracts) &&
    typeof contracts === "object" &&
    Object.values(contracts).some((hash) => String(hash || "").trim());
  if (hasContractBinding) return true;
  if (manifest?.platform?.transactions === true) return true;
  const permissions = Array.isArray(manifest?.permissions) ? manifest.permissions : [];
  return permissions.some((name) => CHAIN_WRITE_PERMISSIONS.has(String(name || "").trim()));
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

  // Derived, NOT declared: an app with no contract binding, no
  // platform.transactions and no write permission has no chain surface for a
  // live-chain flow to exercise. Its whole workflow is the UI, which the build
  // + play-area audits below already cover. Note this branch is reached only
  // AFTER the contract branches above, so any app with a deployed hash is
  // already classified as a real gap and can never land here.
  if (!declaresChainSurface(manifest)) {
    return {
      coverage: "ui-only-flow",
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
    action:
      "this app declares a chain surface (platform.transactions or a write permission) but binds no contract — add a testnet live-flow script, or drop the undeclared chain surface from the manifest",
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
      // The signal the classifier actually derives its ui-only branch from.
      declaresChainSurface: declaresChainSurface(manifest),
      // Echoed from the manifest for report readers ONLY. This is NOT what the
      // classifier keys on — see declaresChainSurface() for why the two must
      // not be conflated.
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
