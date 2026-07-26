#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const liveReportPath = "docs/reports/platform-contract-testnet-live-latest.json";
const platformDeFiLegacyCreditReportPath =
  "docs/reports/platform-defi-legacy-credit-snapshot-latest.json";
const preflightReportPaths = [
  "docs/reports/platform-update-registry-preflight-latest.json",
  "docs/reports/platform-update-shared-admin-preflight-latest.json",
];

const policy = {
  PlatformRegistry: {
    order: 1,
    route: "timelocked-in-place-update",
    readiness: "staged-update-candidate",
    behavior_changes: [
      "spend-threshold raises become timelocked while reductions remain immediate",
      "per-app pause is pushed into an already minted AppAccount",
      "engine-pool funding uses the engine's appId:fund deposit grammar",
    ],
    gates: [
      "add Registry schedule/execute support to the updater",
      "simulate scheduleUpdate with the exact local NEF and manifest",
      "wait the on-chain timelock and re-read the pinned hashes before execution",
      "verify checksum, update counter, Registry rows, artifact checksum, and engine bindings afterward",
    ],
  },
  PlatformDeFi: {
    order: 2,
    route: "direct-in-place-update",
    readiness: "legacy-credit-recovery-bridge-review-required",
    storage_key_changes: [
      {
        prefix: "0x14",
        name: "PREFIX_NEO_CREDIT",
        previous: "payer Hash160",
        current: "appId + payer Hash160",
        risk: "an existing payer-only NEO credit cannot be assigned to a tenant deterministically",
      },
      {
        prefix: "0x15",
        name: "PREFIX_GAS_CREDIT",
        previous: "payer Hash160",
        current: "appId + payer Hash160",
        risk: "an existing payer-only GAS credit cannot be assigned to a tenant deterministically",
      },
    ],
    behavior_changes: [
      "adds lending liquidity, liquidation, fee sweep, abandoned-collateral, pricing, and flash-provider accounting lanes",
      "changes direct NEO and GAS credit ownership from payer-global to appId-and-payer scoped with exact appId:credit routing",
      "adds per-app and global direct-credit liabilities and preserves them across every native-asset payout",
      "adds an auto-paused legacy-credit recovery state machine with exact snapshot initialization, deficit top-up, activation, and payer-witnessed withdrawals",
    ],
    gates: [
      "freeze deposits and enumerate every legacy 0x14 and 0x15 storage row from one exact state snapshot",
      "review the exact payer arrays and 32-byte snapshot hash before initializing the recovery bridge",
      "simulate the exact update and require automatic pause plus recovery state SnapshotRequired before any other action",
      "initialize the snapshot and require the recorded row counts and NEO/GAS liabilities to match the public snapshot exactly",
      "resolve the 134226336 datoshi GAS deficit through a separately approved top-up before activation; no withdrawal or unpause may succeed while underbacked",
      "simulate every legacy payer withdrawal and require zero residual rows and liabilities before recovery completes",
      "prefer a fresh PlatformDeFi v1.2 deployment because the current testnet contract has zero tenant bindings",
      "snapshot native balances, product rows, loans, capsules, flash-loan accounting, and all new liability totals",
      "verify checksum, update counter, old safe reads, every new safe read, and native-balance-versus-liability solvency afterward",
      "run funded lending, capsule, and flash-loan lifecycle probes before binding a live tenant",
    ],
  },
  MiniAppFactory: {
    order: 3,
    route: "direct-in-place-update",
    readiness: "live-abi-and-lifecycle-certification-required",
    behavior_changes: [
      "deployFromTemplate becomes record-only for templates without artifacts and rejects artifact templates",
      "artifact-backed deployment moves to deployArtifactFromTemplate with caller-supplied creator-unique artifacts and a digest over NEF, manifest, and init parameters",
      "caller-supplied NEF must match the governed artifact and the manifest may only vary by its creator-unique contract name",
    ],
    gates: [
      "retain the implemented creator-unique NEF and manifest generator with exact six-argument calls and artifact-digest coverage",
      "register the exact generated FactoryNep17Token and FactoryNep11Collection artifacts under the governed template IDs",
      "verify the live contract exposes deployArtifactFromTemplate(String,String,String,String,ByteArray,String) returning Hash160 through getcontractstate",
      "prove legacy records remain readable and package IDs remain unique",
      "simulate both record-only and unique-artifact flows before updating",
      "verify checksum, update counter, template indexes, deployment indexes, and consumer ABI afterward",
      "execute funded NEP-17 and NEP-11 deployments and verify transaction, event, readback, restart, and recovery behavior",
    ],
  },
  PlatformAnchor: {
    order: 4,
    route: "direct-in-place-update",
    readiness: "abi-deprecation-decision-required",
    behavior_changes: [
      "removes batch agent-account rotation to prevent one-transaction redirection of all agents",
      "removes unused agent-weight mutation and reporting from the manual AA routing model",
      "accepts safe plain-string stake memos without deserializing untrusted transfer data",
    ],
    gates: [
      "decide whether removed public methods need deprecated compatibility stubs",
      "inventory external callers before publishing the reduced ABI",
      "snapshot app, stake, reward, credit, agent, candidate, and selected-agent state",
      "verify checksum, update counter, historical reads, withdrawals, claims, transfers, and votes afterward",
    ],
  },
};

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: options.binary ? null : "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.quiet ? ["ignore", "pipe", "ignore"] : ["ignore", "pipe", "pipe"],
  });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function nefChecksum(bytes) {
  if (bytes.length < 4) throw new Error("invalid NEF artifact");
  return bytes.readUInt32LE(bytes.length - 4);
}

export function extractStoragePrefixes(source) {
  const prefixes = {};
  const pattern = /(PREFIX_[A-Z0-9_]+)\s*=\s*new byte\[\]\s*\{([^}]+)\}/g;
  for (const match of source.matchAll(pattern)) {
    prefixes[match[1]] = match[2].replace(/\s+/g, "").toLowerCase();
  }
  return prefixes;
}

export function extractStoredRecordLayouts(source) {
  const layouts = {};
  const typePattern = /public\s+(?:class|struct)\s+([A-Za-z0-9_]+)\s*\{/g;
  for (const match of source.matchAll(typePattern)) {
    let cursor = match.index + match[0].length;
    let depth = 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === "{") depth += 1;
      if (source[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    const body = source.slice(match.index + match[0].length, cursor - 1);
    const fields = [...body.matchAll(
      /public\s+([A-Za-z0-9_<>,\[\]?]+)\s+([A-Za-z0-9_]+)\s*;/g,
    )].map((field) => `${field[1]} ${field[2]}`);
    if (fields.length > 0) layouts[match[1]] = fields;
  }
  return layouts;
}

function filesAtRevision(revision, directory) {
  return String(git(["ls-tree", "-r", "--name-only", revision, "--", directory]))
    .trim()
    .split(/\r?\n/)
    .filter((file) => file.endsWith(".cs"));
}

function sourceAtRevision(name, revision) {
  const directory = `contracts/platform/${name}`;
  return filesAtRevision(revision, directory)
    .map((file) => git(["show", `${revision}:${file}`]))
    .join("\n");
}

function currentSource(name) {
  const directory = path.join(repoRoot, "contracts", "platform", name);
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".cs"))
    .sort()
    .map((file) => fs.readFileSync(path.join(directory, file), "utf8"))
    .join("\n");
}

function manifestAtRevision(name, revision) {
  return JSON.parse(git(["show", `${revision}:contracts/build/${name}.manifest.json`]));
}

function currentManifest(name) {
  return readJson(`contracts/build/${name}.manifest.json`);
}

function currentNefChecksum(name) {
  return nefChecksum(
    fs.readFileSync(path.join(repoRoot, "contracts", "build", `${name}.nef`)),
  );
}

function methodNames(manifest) {
  return [...new Set((manifest.abi?.methods ?? []).map((method) => method.name))].sort();
}

function compareMaps(previous, current) {
  const added = Object.keys(current)
    .filter((key) => !(key in previous))
    .sort()
    .map((key) => ({ name: key, value: current[key] }));
  const removed = Object.keys(previous)
    .filter((key) => !(key in current))
    .sort()
    .map((key) => ({ name: key, value: previous[key] }));
  const changed = Object.keys(current)
    .filter((key) => key in previous)
    .filter((key) => JSON.stringify(current[key]) !== JSON.stringify(previous[key]))
    .sort()
    .map((key) => ({ name: key, previous: previous[key], current: current[key] }));
  return { added, removed, changed };
}

function findArtifactHistory(name, checksum) {
  const nefPath = `contracts/build/${name}.nef`;
  const revisions = String(git(["rev-list", "--all", "--", nefPath]))
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const matches = [];
  for (const revision of revisions) {
    try {
      const bytes = git(["show", `${revision}:${nefPath}`], { binary: true, quiet: true });
      if (nefChecksum(bytes) !== checksum) continue;
      const metadata = String(
        git(["show", "-s", "--format=%H%x09%aI%x09%s", revision]),
      ).trim().split("\t");
      matches.push({ revision: metadata[0], authored_at: metadata[1], subject: metadata[2] });
    } catch {
      // The path may not exist in all merge-parent histories returned by rev-list.
    }
  }
  if (matches.length === 0) {
    throw new Error(`no Git revision matches ${name} checksum ${checksum}`);
  }
  return matches;
}

function buildContractReadiness(live, preflightByContract) {
  const contractPolicy = policy[live.name];
  if (!contractPolicy) throw new Error(`missing upgrade policy for ${live.name}`);
  const historyMatches = findArtifactHistory(live.name, live.on_chain_nef_checksum);
  const deployedRevision = historyMatches[0];
  const previousSource = sourceAtRevision(live.name, deployedRevision.revision);
  const nextSource = currentSource(live.name);
  const prefixDelta = compareMaps(
    extractStoragePrefixes(previousSource),
    extractStoragePrefixes(nextSource),
  );
  const recordDelta = compareMaps(
    extractStoredRecordLayouts(previousSource),
    extractStoredRecordLayouts(nextSource),
  );
  const previousMethods = methodNames(manifestAtRevision(live.name, deployedRevision.revision));
  const currentMethods = methodNames(currentManifest(live.name));
  const addedMethods = currentMethods.filter((method) => !previousMethods.includes(method));
  const removedMethods = previousMethods.filter((method) => !currentMethods.includes(method));
  const prefixValuesChanged = prefixDelta.changed.length > 0;
  const storedRecordsChanged = recordDelta.changed.length > 0 || recordDelta.removed.length > 0;
  const storageKeyChanges = contractPolicy.storage_key_changes ?? [];
  const preflight = preflightByContract.get(live.name) ?? null;

  return {
    name: live.name,
    order: contractPolicy.order,
    hash: live.hash,
    admin: live.admin,
    route: contractPolicy.route,
    readiness: contractPolicy.readiness,
    deployed_artifact: {
      checksum: live.on_chain_nef_checksum,
      update_counter: live.update_counter,
      source_revision: deployedRevision,
      matching_revisions: historyMatches,
    },
    candidate_artifact: {
      checksum: currentNefChecksum(live.name),
    },
    preflight,
    abi: {
      previous_methods: previousMethods.length,
      current_methods: currentMethods.length,
      added: addedMethods,
      removed: removedMethods,
      compatibility: removedMethods.length === 0 ? "additive-or-equal" : "breaking-removals",
    },
    storage: {
      prefixes: prefixDelta,
      stored_records: recordDelta,
      key_schemas: storageKeyChanges,
      prefix_values_changed: prefixValuesChanged,
      stored_record_layouts_changed: storedRecordsChanged,
      compatibility: storageKeyChanges.length > 0
        ? "breaking-key-schema-change"
        : prefixValuesChanged || storedRecordsChanged
        ? "blocked-layout-change"
        : prefixDelta.removed.length > 0
          ? "review-orphaned-prefixes"
          : "additive-or-unchanged",
    },
    behavior_changes: contractPolicy.behavior_changes,
    required_gates: contractPolicy.gates,
  };
}

export function buildUpgradeReadinessLedger({ now = () => new Date() } = {}) {
  const liveReport = readJson(liveReportPath);
  const preflightByContract = new Map();
  for (const reportPath of preflightReportPaths) {
    const report = readJson(reportPath);
    for (const target of report.targets ?? []) {
      preflightByContract.set(target.name, {
        report: reportPath,
        generated_at_utc: report.generated_at_utc,
        signer_hash: report.signer_hash,
        signer_input: report.signer_input,
        dry_run: report.dry_run,
        admin_matches_signer: target.admin_matches_signer,
        method: target.preflight_method,
        state: target.preflight_state,
        gas_consumed: target.preflight_gas,
        transactions: report.transactions?.length ?? 0,
      });
    }
  }
  const drifted = liveReport.contracts.filter(
    (contract) => contract.kind === "contract" && contract.status === "live-artifact-drift",
  );
  const contracts = drifted
    .map((contract) => buildContractReadiness(contract, preflightByContract))
    .sort((left, right) => left.order - right.order);
  const platformDeFiLegacyCreditReport = fs.existsSync(
    path.join(repoRoot, platformDeFiLegacyCreditReportPath),
  )
    ? readJson(platformDeFiLegacyCreditReportPath)
    : null;
  const platformDeFi = contracts.find((contract) => contract.name === "PlatformDeFi");
  if (platformDeFiLegacyCreditReport && platformDeFi) {
    if (
      platformDeFiLegacyCreditReport.platform_defi_hash !== platformDeFi.hash ||
      platformDeFiLegacyCreditReport.network_magic !== liveReport.network_magic
    ) {
      throw new Error("PlatformDeFi legacy credit snapshot target does not match live evidence");
    }
    platformDeFi.storage.live_snapshot = {
      report: platformDeFiLegacyCreditReportPath,
      generated_at_utc: platformDeFiLegacyCreditReport.generated_at_utc,
      block_count: platformDeFiLegacyCreditReport.block_count,
      legacy_credit_rows:
        platformDeFiLegacyCreditReport.summary.legacy_credit_rows,
      neo_legacy_credit_rows:
        platformDeFiLegacyCreditReport.summary.neo_legacy_credit_rows,
      gas_legacy_credit_rows:
        platformDeFiLegacyCreditReport.summary.gas_legacy_credit_rows,
      gas_legacy_credit_total_datoshi:
        platformDeFiLegacyCreditReport.legacy_credit_prefixes.gas.total_datoshi,
      gas_native_balance_datoshi:
        platformDeFiLegacyCreditReport.legacy_credit_prefixes.gas.native_balance_datoshi,
      gas_backing_gap_datoshi:
        platformDeFiLegacyCreditReport.legacy_credit_prefixes.gas.backing_gap_datoshi,
      migration_status:
        platformDeFiLegacyCreditReport.summary.migration_status,
      transactions: platformDeFiLegacyCreditReport.summary.transactions,
    };
  }
  return {
    generated_at_utc: now().toISOString(),
    network: liveReport.network,
    network_magic: liveReport.network_magic,
    live_evidence: liveReportPath,
    summary: {
      drifted_contracts: contracts.length,
      historical_artifacts_resolved: contracts.filter(
        (contract) => contract.deployed_artifact.matching_revisions.length > 0,
      ).length,
      additive_or_equal_abi: contracts.filter(
        (contract) => contract.abi.compatibility === "additive-or-equal",
      ).length,
      breaking_abi_removals: contracts.filter(
        (contract) => contract.abi.compatibility === "breaking-removals",
      ).length,
      unchanged_serialized_record_layouts: contracts.filter(
        (contract) => !contract.storage.stored_record_layouts_changed,
      ).length,
      changed_prefix_values: contracts.filter(
        (contract) => contract.storage.prefix_values_changed,
      ).length,
      breaking_storage_key_schemas: contracts.filter(
        (contract) => contract.storage.key_schemas.length > 0,
      ).length,
      blocking_legacy_credit_rows:
        platformDeFi?.storage.live_snapshot?.legacy_credit_rows ?? null,
      underbacked_legacy_credit_contracts: contracts.filter(
        (contract) =>
          contract.storage.live_snapshot?.migration_status ===
          "blocked-nonempty-and-underbacked",
      ).length,
      staged_update_candidates: contracts.filter(
        (contract) => contract.readiness === "staged-update-candidate",
      ).length,
      preflight_halt: contracts.filter(
        (contract) => contract.preflight?.state === "HALT",
      ).length,
      preflight_transactions: contracts.reduce(
        (total, contract) => total + (contract.preflight?.transactions ?? 0),
        0,
      ),
    },
    admin_domains: liveReport.admin_domains,
    contracts,
    ordered_plan: [
      "PlatformRegistry: add timelocked updater support, schedule exact candidate hashes, wait, execute, then reconcile all Registry and AppAccount-artifact invariants.",
      "PlatformDeFi: review and simulate the v1.2 auto-paused recovery bridge against the exact public legacy-credit snapshot, separately resolve the GAS deficit, prove all payer withdrawals, and because bindings are zero still prefer a fresh deployment before funded product lifecycles and tenant binding.",
      "MiniAppFactory: retain the completed creator-artifact builder and fail-closed consumer cutover, then certify the exact live ABI, governed artifacts, and funded transaction/event/readback recovery lifecycle before updating.",
      "PlatformAnchor: make an explicit public-ABI deprecation decision before removing setAgentAccounts and setAgentWeight on-chain.",
      "PlatformSocial: treat first deployment or retirement as a separate architecture decision, not part of this update batch.",
    ],
    boundary:
      "This ledger proves artifact provenance and static ABI/storage deltas, including declared storage-key schema changes that prefix-byte comparison cannot detect. It does not authorize a chain write or prove stateful upgrade safety; exact pre/post state snapshots and funded lifecycle probes remain mandatory.",
  };
}

export function renderUpgradeReadinessMarkdown(ledger) {
  const lines = [
    "# Platform Contract Upgrade Readiness",
    "",
    `Generated: ${ledger.generated_at_utc}`,
    "",
    "## Summary",
    "",
    `- Drifted contracts: ${ledger.summary.drifted_contracts}`,
    `- Historical artifacts resolved to Git: ${ledger.summary.historical_artifacts_resolved}/${ledger.summary.drifted_contracts}`,
    `- Additive/equal ABI: ${ledger.summary.additive_or_equal_abi}`,
    `- ABI-breaking removals: ${ledger.summary.breaking_abi_removals}`,
    `- Unchanged serialized record layouts: ${ledger.summary.unchanged_serialized_record_layouts}/${ledger.summary.drifted_contracts}`,
    `- Changed storage-prefix values: ${ledger.summary.changed_prefix_values}`,
    `- Breaking storage-key schemas: ${ledger.summary.breaking_storage_key_schemas}`,
    `- Blocking legacy credit rows: ${ledger.summary.blocking_legacy_credit_rows ?? "not scanned"}`,
    `- Underbacked legacy-credit contracts: ${ledger.summary.underbacked_legacy_credit_contracts}`,
    `- Staged update candidates: ${ledger.summary.staged_update_candidates}`,
    `- Exact update preflights HALT: ${ledger.summary.preflight_halt}/${ledger.summary.drifted_contracts}`,
    `- Preflight transactions broadcast: ${ledger.summary.preflight_transactions}`,
    `- Distinct admin domains: ${ledger.admin_domains.length}`,
    `- Boundary: ${ledger.boundary}`,
    "",
    "## Readiness Ledger",
    "",
    "| Order | Contract | Deployed revision | ABI delta | Storage delta | Route | Readiness |",
    "| ---: | --- | --- | --- | --- | --- | --- |",
  ];
  for (const contract of ledger.contracts) {
    const abiDelta = `+${contract.abi.added.length}/-${contract.abi.removed.length}`;
    const storageDelta = `prefix +${contract.storage.prefixes.added.length}/-${contract.storage.prefixes.removed.length}/~${contract.storage.prefixes.changed.length}; records ~${contract.storage.stored_records.changed.length}; keys ~${contract.storage.key_schemas.length}`;
    lines.push(
      `| ${contract.order} | ${contract.name} | ${contract.deployed_artifact.source_revision.revision.slice(0, 12)} | ${abiDelta} (${contract.abi.compatibility}) | ${storageDelta} (${contract.storage.compatibility}) | ${contract.route} | ${contract.readiness} |`,
    );
  }
  lines.push("", "## Contract Gates", "");
  for (const contract of ledger.contracts) {
    lines.push(`### ${contract.name}`, "");
    lines.push(`- Admin: ${contract.admin}`);
    lines.push(`- Deployed checksum: ${contract.deployed_artifact.checksum}`);
    lines.push(`- Candidate checksum: ${contract.candidate_artifact.checksum}`);
    lines.push(`- Exact preflight: ${contract.preflight?.method ?? "missing"} ${contract.preflight?.state ?? "missing"}, gas ${contract.preflight?.gas_consumed ?? "n/a"}, transactions ${contract.preflight?.transactions ?? "n/a"}`);
    lines.push(`- ABI added: ${contract.abi.added.length ? contract.abi.added.join(", ") : "none"}`);
    lines.push(`- ABI removed: ${contract.abi.removed.length ? contract.abi.removed.join(", ") : "none"}`);
    lines.push(`- Added storage prefixes: ${contract.storage.prefixes.added.length ? contract.storage.prefixes.added.map((entry) => entry.name).join(", ") : "none"}`);
    lines.push(`- Removed storage prefixes: ${contract.storage.prefixes.removed.length ? contract.storage.prefixes.removed.map((entry) => entry.name).join(", ") : "none"}`);
    lines.push(`- Changed storage-key schemas: ${contract.storage.key_schemas.length ? contract.storage.key_schemas.map((entry) => `${entry.name} ${entry.previous} -> ${entry.current} (${entry.risk})`).join("; ") : "none"}`);
    lines.push(`- Live storage snapshot: ${contract.storage.live_snapshot ? `${contract.storage.live_snapshot.report}, block count ${contract.storage.live_snapshot.block_count}, legacy rows ${contract.storage.live_snapshot.legacy_credit_rows}, status ${contract.storage.live_snapshot.migration_status}, transactions ${contract.storage.live_snapshot.transactions}` : "none"}`);
    lines.push(`- Behavior changes: ${contract.behavior_changes.join("; ")}`);
    lines.push(`- Required gates: ${contract.required_gates.join("; ")}`);
    lines.push("");
  }
  lines.push("## Ordered Plan", "");
  ledger.ordered_plan.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  return `${lines.join("\n")}\n`;
}

export function writeUpgradeReadinessLedger(ledger) {
  const jsonPath = path.join(repoRoot, "docs", "reports", "platform-contract-upgrade-readiness-latest.json");
  const markdownPath = path.join(repoRoot, "docs", "reports", "platform-contract-upgrade-readiness-latest.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(ledger, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderUpgradeReadinessMarkdown(ledger));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ledger = buildUpgradeReadinessLedger();
  writeUpgradeReadinessLedger(ledger);
  console.log(
    `Platform upgrade readiness: ${ledger.summary.historical_artifacts_resolved}/${ledger.summary.drifted_contracts} artifacts resolved; ${ledger.summary.staged_update_candidates} staged candidates; ${ledger.summary.breaking_abi_removals} ABI-breaking candidate.`,
  );
}
