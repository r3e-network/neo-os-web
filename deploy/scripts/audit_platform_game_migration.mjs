#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DEFAULT_LIFECYCLE_EVIDENCE_DIR,
  loadLifecycleEvidence,
} from "./lib/platform_game_lifecycle_evidence.mjs";
import { hasPlatformBinding } from "./lib/platform_binding_source.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const absorptionManifestPath =
  "deploy/config/rewardgame-absorption-manifest.json";
const attachmentReportPath =
  "deploy/config/engine-attach-testnet-2026-07-19.json";
const liveStateReportPath =
  "docs/reports/platform-game-live-state-latest.json";
const candidateIds = [
  "miniapp-arrow-escape",
  "miniapp-bead-workshop",
  "miniapp-fruit-funnel",
  "miniapp-screw-sort",
  "miniapp-zhuada-e",
];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function readOptionalJson(relativePath) {
  try {
    return readJson(relativePath);
  } catch {
    return null;
  }
}

export function withoutGeneratedTimestamps(value) {
  if (Array.isArray(value)) return value.map(withoutGeneratedTimestamps);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "generated_at_utc")
        .map(([key, nested]) => [key, withoutGeneratedTimestamps(nested)]),
    );
  }
  return value;
}

function sameHash(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const normalize = (value) => value.trim().toLowerCase().replace(/^0x/, "");
  return normalize(left) === normalize(right);
}

function appSlug(appId) {
  return appId.replace(/^miniapp-/, "");
}

function sourceFiles(directory) {
  const absolute = path.join(repoRoot, directory);
  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(relative));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(relative);
  }
  return files.sort();
}

function sourceBundle(slug) {
  return sourceFiles(`apps/${slug}/src`).map(read).join("\n");
}

export function bindingOf(manifestSource) {
  const shared = /mode:\s*["']shared["']/.test(manifestSource);
  const custom = /mode:\s*["']custom["']/.test(manifestSource);
  const moduleMatch = manifestSource.match(/moduleId:\s*["']([^"']+)["']/);
  const platformGame = hasPlatformBinding(manifestSource, "game");
  return {
    mode: platformGame || shared ? "shared" : custom ? "custom" : "none",
    module_id: platformGame ? "platform-game" : moduleMatch?.[1] ?? null,
  };
}

function runtimeAdapterOf(source) {
  const platformSurface = /\.platformGame\b/.test(source);
  const legacyRewardSdk = /\.game\.reward\s*(?:<|\()/.test(source);
  const legacyDirectChain = /\.chain\.(?:invoke|invokeWithPayment|readRaw|query)\(\s*["'](?:startGame|finalizeGame|expireGame|withdraw|freePool|creditOf|activeGameOf|getGame|statsOf)["']/.test(source);
  if (platformSurface && legacyRewardSdk && !legacyDirectChain) {
    return "reward-sdk-plus-platform-surface";
  }
  if (platformSurface && legacyRewardSdk) return "mixed";
  if (platformSurface) return "platform-game-surface";
  if (legacyRewardSdk) return "legacy-reward-sdk";
  if (legacyDirectChain) return "legacy-direct-chain";
  return "none";
}

function frameworkAdapterEvidence() {
  const facade = read("node_modules/@r3e-network/neo-miniapp-framework/game-facade.ts");
  const adapter = read("node_modules/@r3e-network/neo-miniapp-framework/gamefi/platform-game-reward-adapter.ts");
  const definition = read("node_modules/@r3e-network/neo-miniapp-shared/react/defineMiniApp.tsx");
  return {
    implemented:
      facade.includes("createPlatformGameRewardChain") &&
      adapter.includes("Shared PlatformGame entries must be prepaid") &&
      adapter.includes("event: undefined") &&
      definition.includes("platformGameConfigFromManifest"),
    // Whether the SDK carries regression coverage for its own adapter is
    // asserted in neo-miniapp-sdk (framework/test/reward-adapter-regression-coverage).
    // Test files are not published, so this repo cannot read them from an
    // installed package.
  };
}

function appEvidence(
  appId,
  absorptionApps,
  attachmentByApp,
  frameworkAdapter,
  lifecycleEvidenceByApp,
  liveStateContext,
) {
  const slug = appSlug(appId);
  const neoManifestPath = `apps/${slug}/neo-manifest.json`;
  const sourceManifestPath = `apps/${slug}/src/manifest.ts`;
  const neoManifest = readJson(neoManifestPath);
  const manifestSource = read(sourceManifestPath);
  const source = sourceBundle(slug);
  const binding = bindingOf(manifestSource);
  const absorption = absorptionApps[appId] ?? null;
  const attachment = attachmentByApp.get(appId) ?? null;
  const migrationScope = absorption ? "absorption-cohort" : "future-local-only";
  const lifecycleEvidence = lifecycleEvidenceByApp.get(appId) ?? null;
  const liveStateRow = liveStateContext.byApp.get(appId) ?? null;
  const liveStateReportMatches =
    liveStateContext.report !== null &&
    liveStateContext.report.read_only === true &&
    liveStateContext.report.chain_writes_performed === false &&
    liveStateContext.report.network === "neo-n3-testnet" &&
    sameHash(liveStateContext.report.engine?.expected_hash, liveStateContext.engineHash) &&
    liveStateContext.report.summary?.contract_state_ready === true;
  const liveStateReady =
    absorption !== null &&
    liveStateReportMatches &&
    liveStateRow?.live_state_ready === true;
  const contracts = neoManifest.contracts && typeof neoManifest.contracts === "object"
    ? Object.values(neoManifest.contracts).filter((value) => String(value ?? "").trim())
    : [];
  const detectedRuntime = runtimeAdapterOf(source);
  const expectedDescriptors = Object.entries(absorption?.descriptors ?? {});
  const attachedDescriptors = new Map(
    (attachment?.descriptors ?? []).map((row) => [row.param, row]),
  );
  const matchingDescriptorCount = expectedDescriptors.filter(([param, target]) => {
    const row = attachedDescriptors.get(param);
    return row?.status === "set" && Number(row.target) === Number(target);
  }).length;
  const frameworkRouted =
    ["legacy-reward-sdk", "reward-sdk-plus-platform-surface"].includes(detectedRuntime) &&
    binding.mode === "shared" &&
    binding.module_id === "platform-game" &&
    frameworkAdapter.implemented;
  const runtimeAdapter = frameworkRouted
    ? "framework-platform-game-adapter"
    : detectedRuntime;
  const platformRouted = [
    "platform-game-surface",
    "framework-platform-game-adapter",
  ].includes(runtimeAdapter);
  const checks = {
    no_standalone_contract_binding: contracts.length === 0,
    shared_platform_game_binding:
      binding.mode === "shared" && binding.module_id === "platform-game",
    absorption_descriptor_present:
      absorption !== null && Object.keys(absorption.descriptors ?? {}).length === 9,
    testnet_engine_attachment_present:
      attachment?.status === "attached" &&
      (attachment.descriptors ?? []).length === 9,
    testnet_descriptor_values_match_local:
      expectedDescriptors.length === 9 && matchingDescriptorCount === expectedDescriptors.length,
    platform_game_runtime_routed: platformRouted,
    legacy_direct_reward_calls_absent:
      !["legacy-reward-sdk", "legacy-direct-chain", "mixed"].includes(runtimeAdapter),
    adapter_regression_present:
      runtimeAdapter !== "framework-platform-game-adapter" || frameworkAdapter.regression_present,
    funded_testnet_lifecycle_proven: lifecycleEvidence !== null,
  };
  const migrationComplete = Object.values(checks).every(Boolean);
  const blockers = Object.entries(checks)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  return {
    app_id: appId,
    slug,
    migration_scope: migrationScope,
    source_manifest: sourceManifestPath,
    public_manifest: neoManifestPath,
    binding,
    runtime_adapter: runtimeAdapter,
    transactions_declared: neoManifest.platform?.transactions === true,
    standalone_contract_bindings: contracts.length,
    absorption_generation: absorption?.generation ?? null,
    attachment_status: attachment?.status ?? "not-attached",
    lifecycle_evidence: lifecycleEvidence,
    live_state: {
      ready: liveStateReady,
      status: absorption === null
        ? "not-in-scope"
        : liveStateReady
          ? "ready"
          : liveStateRow
            ? "blocked"
            : "missing",
      source: liveStateReportPath,
      generated_at_utc: liveStateContext.report?.generated_at_utc ?? null,
      descriptor_match_count: liveStateRow?.descriptor_match_count ?? null,
      descriptor_count: liveStateRow?.descriptor_count ?? null,
      blockers: liveStateRow?.blockers ?? (absorption ? ["live_state_evidence_missing"] : []),
    },
    descriptor_count: Object.keys(absorption?.descriptors ?? {}).length,
    live_descriptor_count: matchingDescriptorCount,
    checks,
    migration_complete: migrationComplete,
    blockers,
  };
}

export function buildPlatformGameMigrationLedger({ now = () => new Date() } = {}) {
  const absorption = readJson(absorptionManifestPath);
  const attachment = readJson(attachmentReportPath);
  const attachmentByApp = new Map(
    (attachment.apps ?? []).map((row) => [row.app_id, row]),
  );
  const liveStateReport = readOptionalJson(liveStateReportPath);
  const liveStateContext = {
    report: liveStateReport,
    engineHash: absorption.engine?.testnetHash ?? null,
    byApp: new Map((liveStateReport?.apps ?? []).map((row) => [row.app_id, row])),
  };
  const attachedIds = Object.keys(absorption.apps ?? {}).sort();
  const frameworkAdapter = frameworkAdapterEvidence();
  const lifecycleEvidence = loadLifecycleEvidence({
    repoRoot,
    directory: DEFAULT_LIFECYCLE_EVIDENCE_DIR,
    expectedNetwork: "neo-n3-testnet",
    expectedEngine: absorption.engine?.testnetHash ?? "",
  });
  const lifecycleEvidenceByApp = new Map(
    lifecycleEvidence.reports.map((row) => [row.app_id, row]),
  );
  const attachedApps = attachedIds.map((appId) =>
    appEvidence(
      appId,
      absorption.apps,
      attachmentByApp,
      frameworkAdapter,
      lifecycleEvidenceByApp,
      liveStateContext,
    ));
  const candidates = candidateIds.map((appId) =>
    appEvidence(
      appId,
      absorption.apps,
      attachmentByApp,
      frameworkAdapter,
      lifecycleEvidenceByApp,
      liveStateContext,
    ));
  return {
    generated_at_utc: now().toISOString(),
    engine_id: absorption.engine?.engineId ?? "platform-game",
    engine_hash: absorption.engine?.testnetHash ?? null,
    evidence: {
      absorption_manifest: absorptionManifestPath,
      attachment_report: attachmentReportPath,
      live_state_report: liveStateReportPath,
      framework_adapter: "node_modules/@r3e-network/neo-miniapp-framework/gamefi/platform-game-reward-adapter.ts",
      framework_adapter_regression: "asserted in neo-miniapp-sdk: framework/test/reward-adapter-regression-coverage.test.ts",
      lifecycle_evidence_directory: lifecycleEvidence.directory,
    },
    framework_adapter: frameworkAdapter,
    summary: {
      attached_apps: attachedApps.length,
      attached_with_shared_binding: attachedApps.filter(
        (row) => row.checks.shared_platform_game_binding,
      ).length,
      attached_using_platform_surface: attachedApps.filter(
        (row) => row.runtime_adapter === "platform-game-surface",
      ).length,
      attached_routed_via_framework_adapter: attachedApps.filter(
        (row) => row.runtime_adapter === "framework-platform-game-adapter",
      ).length,
      attached_routed_to_platform_game: attachedApps.filter(
        (row) => row.checks.platform_game_runtime_routed,
      ).length,
      attached_using_legacy_runtime: attachedApps.filter(
        (row) => ["legacy-reward-sdk", "legacy-direct-chain", "mixed"].includes(row.runtime_adapter),
      ).length,
      runtime_migration_complete: attachedApps.filter(
        (row) => row.migration_complete,
      ).length,
      funded_testnet_lifecycle_proven: attachedApps.filter(
        (row) => row.checks.funded_testnet_lifecycle_proven,
      ).length,
      attached_with_live_state_evidence: attachedApps.filter(
        (row) => row.live_state.ready,
      ).length,
      zero_drain_candidates: candidates.length,
      future_local_only_candidates: candidates.filter(
        (row) => row.migration_scope === "future-local-only",
      ).length,
      candidate_runtime_ready: candidates.filter(
        (row) => row.migration_complete,
      ).length,
    },
    attached_apps: attachedApps,
    zero_drain_candidates: candidates,
    boundary:
      "The 11 absorption-cohort apps and five future-local-only candidates are separate tracks. An engine attachment, shared manifest binding, and framework route do not prove funded runtime completion. Completion additionally requires removal of direct clone-shaped calls plus a funded start/finalize/settle/recovery/withdraw testnet lifecycle.",
  };
}

export function renderPlatformGameMigrationMarkdown(ledger) {
  const lines = [
    "# PlatformGame Migration Completeness",
    "",
    `Generated: ${ledger.generated_at_utc}`,
    "",
    "## Summary",
    "",
    `- Attached apps: ${ledger.summary.attached_apps}`,
    `- Attached apps with shared manifest binding: ${ledger.summary.attached_with_shared_binding}/${ledger.summary.attached_apps}`,
    `- Attached apps using app.platformGame directly: ${ledger.summary.attached_using_platform_surface}/${ledger.summary.attached_apps}`,
    `- Attached apps routed through the framework adapter: ${ledger.summary.attached_routed_via_framework_adapter}/${ledger.summary.attached_apps}`,
    `- Attached apps routed to PlatformGame: ${ledger.summary.attached_routed_to_platform_game}/${ledger.summary.attached_apps}`,
    `- Attached apps still using an unadapted legacy runtime: ${ledger.summary.attached_using_legacy_runtime}`,
    `- Runtime migrations complete: ${ledger.summary.runtime_migration_complete}/${ledger.summary.attached_apps}`,
    `- Attached apps with complete funded lifecycle evidence: ${ledger.summary.funded_testnet_lifecycle_proven}/${ledger.summary.attached_apps}`,
    `- Attached apps with current read-only live state evidence: ${ledger.summary.attached_with_live_state_evidence}/${ledger.summary.attached_apps}`,
    `- Zero-drain candidates runtime-ready: ${ledger.summary.candidate_runtime_ready}/${ledger.summary.zero_drain_candidates}`,
    `- Future local-only candidates awaiting a reviewed engine track: ${ledger.summary.future_local_only_candidates}`,
    `- Boundary: ${ledger.boundary}`,
    "",
    "## Attached Apps",
    "",
    "| App | Binding | Runtime adapter | Descriptor/live | Live state | Complete | Blockers |",
    "| --- | --- | --- | ---: | --- | --- | --- |",
  ];
  for (const row of ledger.attached_apps) {
    const liveDescriptor = row.live_state.descriptor_count === null
      ? "-"
      : `${row.live_state.descriptor_match_count}/${row.live_state.descriptor_count}`;
    lines.push(
      `| ${row.app_id} | ${row.binding.mode}:${row.binding.module_id ?? "-"} | ${row.runtime_adapter} | ${row.descriptor_count}/${row.live_descriptor_count} | ${row.live_state.status} (${liveDescriptor}) | ${row.migration_complete ? "yes" : "no"} | ${row.blockers.join(", ") || "none"} |`,
    );
  }
  lines.push(
    "",
    "## Zero-Drain Candidates",
    "",
    "| App | Scope | Standalone contract | Binding | Runtime adapter | Attached | Ready | Blockers |",
    "| --- | --- | ---: | --- | --- | --- | --- | --- |",
  );
  for (const row of ledger.zero_drain_candidates) {
    lines.push(
      `| ${row.app_id} | ${row.migration_scope} | ${row.standalone_contract_bindings} | ${row.binding.mode}:${row.binding.module_id ?? "-"} | ${row.runtime_adapter} | ${row.attachment_status} | ${row.migration_complete ? "yes" : "no"} | ${row.blockers.join(", ") || "none"} |`,
    );
  }
  lines.push(
    "",
    "## Required Next Gate",
    "",
    "1. Keep every attached app free of direct clone-shaped chain calls; route lifecycle writes through `app.game.reward` and use `app.platformGame` only for typed shared snapshots.",
    "2. Keep exact appId-first ABI arguments, prepaid-credit economics, Finalizing/Solved polling, tenant event filtering, and restart recovery locked in framework tests.",
    "3. Keep future-local-only candidates contractless until a product release decision, reviewed descriptor, Morpheus engine wrapper, and framework route exist; only then consider attachment or shared binding.",
    "4. Run a funded testnet start/finalize/settle/withdraw lifecycle before claiming any runtime migration complete.",
  );
  return `${lines.join("\n")}\n`;
}

export function writePlatformGameMigrationLedger({ check = false } = {}) {
  const ledger = buildPlatformGameMigrationLedger();
  const jsonPath = path.join(
    repoRoot,
    "docs/reports/platform-game-migration-completeness-latest.json",
  );
  const markdownPath = path.join(
    repoRoot,
    "docs/reports/platform-game-migration-completeness-latest.md",
  );
  const json = `${JSON.stringify(ledger, null, 2)}\n`;
  const markdown = renderPlatformGameMigrationMarkdown(ledger);
  if (check) {
    const existingJson = withoutGeneratedTimestamps(
      JSON.parse(fs.readFileSync(jsonPath, "utf8")),
    );
    const currentJson = withoutGeneratedTimestamps(JSON.parse(json));
    if (JSON.stringify(existingJson) !== JSON.stringify(currentJson)) {
      throw new Error("PlatformGame migration JSON is stale");
    }
    const existingMarkdown = fs.readFileSync(markdownPath, "utf8")
      .replace(/^Generated: .*$/m, "Generated: <ignored>");
    const currentMarkdown = markdown.replace(
      /^Generated: .*$/m,
      "Generated: <ignored>",
    );
    if (existingMarkdown !== currentMarkdown) {
      throw new Error("PlatformGame migration Markdown is stale");
    }
    return ledger;
  }
  fs.writeFileSync(jsonPath, json);
  fs.writeFileSync(markdownPath, markdown);
  return ledger;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ledger = writePlatformGameMigrationLedger({
    check: process.argv.includes("--check"),
  });
  console.log(
    `PlatformGame migration: ${ledger.summary.runtime_migration_complete}/${ledger.summary.attached_apps} attached runtimes complete; ${ledger.summary.candidate_runtime_ready}/${ledger.summary.zero_drain_candidates} candidates ready.`,
  );
}
