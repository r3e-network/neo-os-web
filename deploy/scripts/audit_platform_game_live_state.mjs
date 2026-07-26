#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

export const ABSORPTION_MANIFEST_PATH =
  "deploy/config/rewardgame-absorption-manifest.json";
export const ATTACHMENT_REPORT_PATH =
  "deploy/config/engine-attach-testnet-2026-07-19.json";
export const DEFAULT_JSON_REPORT_PATH =
  "docs/reports/platform-game-live-state-latest.json";
export const DEFAULT_MARKDOWN_REPORT_PATH =
  "docs/reports/platform-game-live-state-latest.md";
export const REWARD_GAME_TYPE = "5";
export const REWARD_DESCRIPTOR_PARAMS = [
  "limitMs0",
  "limitMs1",
  "limitMs2",
  "minSolveMs0",
  "minSolveMs1",
  "minSolveMs2",
  "targetScore0",
  "targetScore1",
  "targetScore2",
];

const P_S = (value) => ({ type: "String", value });

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function normalizeHash(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return normalized.startsWith("0x") ? normalized : `0x${normalized}`;
}

function firstStackValue(stack) {
  return Array.isArray(stack) ? stack[0] ?? null : null;
}

export function decodeRpcValue(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (entry.type === "Integer") return String(entry.value ?? "0");
  if (entry.type === "Boolean") return entry.value === true || entry.value === "true";
  if (entry.type === "Hash160" || entry.type === "Hash256") {
    return normalizeHash(entry.value);
  }
  if (entry.type === "ByteArray") {
    const encoded = typeof entry.value === "string" ? entry.value : "";
    let byteLength = null;
    try {
      byteLength = Buffer.from(encoded, "base64").length;
    } catch {
      byteLength = null;
    }
    return { type: entry.type, byte_length: byteLength };
  }
  if (entry.type === "ByteString") {
    const encoded = typeof entry.value === "string" ? entry.value : "";
    try {
      const bytes = Buffer.from(encoded, "base64");
      if (bytes.length === 20) {
        return `0x${Buffer.from(bytes).reverse().toString("hex")}`;
      }
      return { type: entry.type, byte_length: bytes.length };
    } catch {
      return { type: entry.type, byte_length: null };
    }
  }
  if (entry.type === "Any" || entry.type === "Null") return null;
  return { type: entry.type ?? "unknown", value: entry.value ?? null };
}

export function decodeRpcInteger(entry) {
  const value = decodeRpcValue(entry);
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function decodeRpcBoolean(entry) {
  return decodeRpcValue(entry) === true;
}

export async function preflightDescriptorUpdates({
  live,
  registryHash,
  appId,
  appRow,
  expectedDescriptors,
  descriptorValues,
}) {
  const mismatches = Object.entries(expectedDescriptors).filter(
    ([param]) => descriptorValues[param]?.matches !== true,
  );
  if (mismatches.length === 0) {
    return {
      status: "not-needed",
      signer: normalizeHash(appRow?.[2]),
      attempted: 0,
      results: [],
      chain_writes_performed: false,
    };
  }
  const signer = normalizeHash(appRow?.[2]);
  if (!registryHash || !signer || typeof live?.testInvoke !== "function") {
    return {
      status: "blocked",
      signer,
      attempted: mismatches.length,
      results: [],
      chain_writes_performed: false,
      error: "registry hash, public app-admin identity, or testInvoke is unavailable",
    };
  }
  const account = { scriptHash: signer.slice(2) };
  const results = [];
  for (const [param, target] of mismatches) {
    try {
      const result = await live.testInvoke(account, registryHash, "setDescriptor", [
        P_S(appId),
        P_S(`platform-game:${param}`),
        { type: "Integer", value: String(target) },
      ]);
      results.push({
        param,
        target: String(target),
        state: result?.state ?? null,
        gasconsumed: result?.gasconsumed ?? null,
        exception: result?.exception ?? "",
      });
    } catch (error) {
      results.push({
        param,
        target: String(target),
        state: null,
        gasconsumed: null,
        exception: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    status: results.every((result) => result.state === "HALT") ? "eligible" : "blocked",
    signer,
    attempted: mismatches.length,
    results,
    chain_writes_performed: false,
  };
}

export function checkLiveState({
  expectedEngine,
  attachment,
  appId,
  reads,
  expectedDescriptors = {},
  descriptorReads = {},
}) {
  const attachmentRow = attachment ?? null;
  const appRow = Array.isArray(attachmentRow?.app_row)
    ? attachmentRow.app_row
    : [];
  const expectedAdmin = normalizeHash(appRow[2]);
  const engine = normalizeHash(expectedEngine);
  const gameType = decodeRpcInteger(firstStackValue(reads.getGameType?.stack));
  const gameActive = decodeRpcValue(firstStackValue(reads.isGameActive?.stack));
  const gameAdmin = normalizeHash(decodeRpcValue(firstStackValue(reads.getGameAdmin?.stack)));
  const pool = decodeRpcInteger(firstStackValue(reads.poolBalance?.stack));
  const reserved = decodeRpcInteger(firstStackValue(reads.reservedPool?.stack));
  const free = decodeRpcInteger(firstStackValue(reads.freePool?.stack));
  const held = decodeRpcInteger(firstStackValue(reads.heldForApp?.stack));
  const descriptorEntries = Object.entries(expectedDescriptors);
  const descriptorValues = Object.fromEntries(
    descriptorEntries.map(([param, target]) => {
      const result = descriptorReads[param];
      const current = decodeRpcInteger(firstStackValue(result?.stack));
      return [param, {
        expected: String(target),
        current: current?.toString() ?? null,
        read_ok: result?.ok === true,
        matches: current?.toString() === String(target),
      }];
    }),
  );
  const descriptorsRequired = descriptorEntries.length > 0;
  const descriptorReadsComplete = descriptorEntries.every(
    ([param]) => descriptorReads[param]?.ok === true &&
      decodeRpcInteger(firstStackValue(descriptorReads[param]?.stack)) !== null,
  );
  const descriptorValuesMatch = descriptorEntries.every(
    ([param, target]) => decodeRpcInteger(firstStackValue(descriptorReads[param]?.stack))?.toString() === String(target),
  );

  const readOk = (name) => reads[name]?.ok === true;
  const values = {
    game_type: gameType?.toString() ?? null,
    game_active: decodeRpcValue(firstStackValue(reads.isGameActive?.stack)),
    paused: decodeRpcValue(firstStackValue(reads.isPaused?.stack)),
    game_admin: gameAdmin,
    game_config: decodeRpcValue(firstStackValue(reads.getGameConfig?.stack)),
    pool_balance: pool?.toString() ?? null,
    reserved_pool: reserved?.toString() ?? null,
    free_pool: free?.toString() ?? null,
    held_for_app: held?.toString() ?? null,
    descriptors: descriptorValues,
  };

  const checks = {
    attachment_status_attached: attachmentRow?.status === "attached",
    app_row_engine_match:
      appRow[0] === "platform-game" && normalizeHash(appRow[1]) === engine,
    app_row_active: appRow[5] === true,
    game_type_reward_game: readOk("getGameType") && gameType?.toString() === REWARD_GAME_TYPE,
    game_active: readOk("isGameActive") && gameActive === true,
    app_not_paused: readOk("isPaused") && decodeRpcBoolean(firstStackValue(reads.isPaused?.stack)) === false,
    game_admin_readable: readOk("getGameAdmin") && gameAdmin !== null,
    game_admin_matches_attachment:
      readOk("getGameAdmin") && expectedAdmin !== null && gameAdmin === expectedAdmin,
    game_config_readable: readOk("getGameConfig"),
    pool_values_readable:
      readOk("poolBalance") &&
      readOk("reservedPool") &&
      readOk("freePool") &&
      readOk("heldForApp") &&
      pool !== null &&
      reserved !== null &&
      free !== null &&
      held !== null,
    pool_values_nonnegative:
      pool !== null && reserved !== null && free !== null && held !== null &&
      pool >= 0n && reserved >= 0n && free >= 0n && held >= 0n,
    pool_accounting: pool !== null && reserved !== null && free !== null && pool === reserved + free,
    held_for_app_covers_pool: held !== null && pool !== null && held >= pool,
    descriptor_reads_complete: !descriptorsRequired || descriptorReadsComplete,
    descriptor_values_match_manifest: !descriptorsRequired || descriptorValuesMatch,
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    app_id: appId,
    expected_admin: expectedAdmin,
    descriptor_count: descriptorEntries.length,
    descriptor_match_count: Object.values(descriptorValues).filter((row) => row.matches).length,
    descriptor_values: descriptorValues,
    values,
    reads: Object.fromEntries(
      Object.entries(reads).map(([method, result]) => [method, {
        ok: result.ok === true,
        error: result.ok === true ? null : result.error,
      }]),
    ),
    checks,
    live_state_ready: blockers.length === 0,
    blockers,
  };
}

async function readSafely(live, engine, method, params) {
  try {
    return { ok: true, stack: await live.readStack(engine, method, params) };
  } catch (error) {
    return {
      ok: false,
      stack: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function auditPlatformGameLiveState({
  live,
  engine,
  absorptionManifest,
  attachmentReport,
  now = () => new Date(),
}) {
  const expectedEngine = engine ?? absorptionManifest.engine?.testnetHash;
  if (!expectedEngine) throw new Error("PlatformGame engine hash is required");
  const attachmentByApp = new Map(
    (attachmentReport.apps ?? []).map((row) => [row.app_id, row]),
  );
  const appIds = Object.keys(absorptionManifest.apps ?? {}).sort();
  const contractMethods = [
    "admin",
    "oracle",
    "abstractAccount",
    "registry",
    "isContractPaused",
  ];
  const contractReads = {};
  for (const method of contractMethods) {
    contractReads[method] = await readSafely(live, expectedEngine, method, []);
  }
  const contractValues = Object.fromEntries(
    Object.entries(contractReads).map(([method, result]) => [
      method,
      decodeRpcValue(firstStackValue(result.stack)),
    ]),
  );
  const registryHash = normalizeHash(contractValues.registry);

  const apps = [];
  const appMethods = [
    ["getGameType", []],
    ["isGameActive", []],
    ["isPaused", []],
    ["getGameAdmin", []],
    ["getGameConfig", []],
    ["poolBalance", []],
    ["reservedPool", []],
    ["freePool", []],
    ["heldForApp", []],
  ];
  for (const appId of appIds) {
    const reads = {};
    for (const [method] of appMethods) {
      reads[method] = await readSafely(live, expectedEngine, method, [P_S(appId)]);
    }
    const expectedDescriptors = absorptionManifest.apps?.[appId]?.descriptors ?? {};
    const descriptorReads = {};
    for (const param of REWARD_DESCRIPTOR_PARAMS) {
      const key = `platform-game:${param}`;
      descriptorReads[param] = registryHash
        ? await readSafely(live, registryHash, "getDescriptor", [P_S(appId), P_S(key)])
        : { ok: false, stack: [], error: "registry hash unavailable" };
    }
    const appState = checkLiveState({
      expectedEngine,
      attachment: attachmentByApp.get(appId),
      appId,
      reads,
      expectedDescriptors,
      descriptorReads,
    });
    appState.descriptor_update_preflight = await preflightDescriptorUpdates({
      live,
      registryHash,
      appId,
      appRow: attachmentByApp.get(appId)?.app_row,
      expectedDescriptors,
      descriptorValues: appState.descriptor_values,
    });
    apps.push(appState);
  }
  const contractChecks = {
    contract_reads_complete: contractMethods.every((method) => contractReads[method].ok),
    contract_admin_readable:
      contractReads.admin.ok && normalizeHash(contractValues.admin) !== null,
    contract_oracle_readable:
      contractReads.oracle.ok && normalizeHash(contractValues.oracle) !== null,
    contract_abstract_account_readable:
      contractReads.abstractAccount.ok && normalizeHash(contractValues.abstractAccount) !== null,
    contract_registry_readable:
      contractReads.registry.ok && normalizeHash(contractValues.registry) !== null,
    contract_pause_readable: contractReads.isContractPaused.ok,
    contract_not_paused:
      contractReads.isContractPaused.ok && contractValues.isContractPaused === false,
  };
  const contractBlockers = Object.entries(contractChecks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const allAppsReady = apps.length > 0 && apps.every((app) => app.live_state_ready);
  const report = {
    generated_at_utc: now().toISOString(),
    network: "neo-n3-testnet",
    network_magic: 894710606,
    read_only: true,
    chain_writes_performed: false,
    write_methods_used: [],
    engine: {
      engine_id: absorptionManifest.engine?.engineId ?? "platform-game",
      expected_hash: expectedEngine,
      contract_reads: Object.fromEntries(
        Object.entries(contractReads).map(([method, result]) => [method, {
          ok: result.ok,
          error: result.ok ? null : result.error,
        }]),
      ),
      values: contractValues,
      checks: contractChecks,
      blockers: contractBlockers,
    },
    evidence: {
      absorption_manifest: ABSORPTION_MANIFEST_PATH,
      attachment_report: ATTACHMENT_REPORT_PATH,
      scope: "live PlatformGame and Registry read surfaces; no funded lifecycle or wallet proof",
      descriptor_namespace: "platform-game:<param>",
    },
    summary: {
      apps_checked: apps.length,
      apps_live_state_ready: apps.filter((app) => app.live_state_ready).length,
      apps_with_blockers: apps.filter((app) => !app.live_state_ready).length,
      descriptor_mismatch_apps: apps.filter(
        (app) => app.descriptor_match_count < app.descriptor_count,
      ).length,
      descriptor_update_preflight_eligible_apps: apps.filter(
        (app) => app.descriptor_update_preflight.status === "eligible",
      ).length,
      contract_state_ready: contractBlockers.length === 0,
      live_state_ready: contractBlockers.length === 0 && allAppsReady,
    },
    apps,
    boundary:
      "This read-only audit proves current ABI reads, app registration/activation, pause state, admin identity, pool counters, and Registry descriptor values. It does not prove funded start/finalize/settle/withdraw lifecycle completion.",
  };
  return report;
}

function markdownReport(report) {
  const lines = [
    "# PlatformGame Live State Audit",
    "",
    `- Generated: ${report.generated_at_utc}`,
    `- Network: ${report.network} (magic ${report.network_magic})`,
    `- Engine: ${report.engine.expected_hash}`,
    "- Mode: read-only; chain writes performed: false",
    "",
    "## Summary",
    "",
    `- Apps checked: ${report.summary.apps_checked}`,
    `- Live-state ready: ${report.summary.apps_live_state_ready}`,
    `- Apps with blockers: ${report.summary.apps_with_blockers}`,
    `- Descriptor mismatches: ${report.summary.descriptor_mismatch_apps}`,
    `- Mismatched apps with HALT update preflight: ${report.summary.descriptor_update_preflight_eligible_apps}`,
    `- Contract state ready: ${report.summary.contract_state_ready}`,
    `- Overall live-state ready: ${report.summary.live_state_ready}`,
    "",
    "## Apps",
    "",
    "| App | Game type | Active | Paused | Pool | Reserved | Free | Held | Descriptors | Ready | Blockers |",
    "| --- | ---: | :---: | :---: | ---: | ---: | ---: | ---: | ---: | :---: | --- |",
  ];
  for (const app of report.apps) {
    const value = app.values;
    lines.push(`| ${app.app_id} | ${value.game_type ?? "—"} | ${value.game_active ?? "—"} | ${value.paused ?? "—"} | ${value.pool_balance ?? "—"} | ${value.reserved_pool ?? "—"} | ${value.free_pool ?? "—"} | ${value.held_for_app ?? "—"} | ${app.descriptor_match_count}/${app.descriptor_count} | ${app.live_state_ready} | ${app.blockers.join(", ") || "—"} |`);
  }
  lines.push(
    "",
    "## Boundary",
    "",
    report.boundary,
    "",
  );
  return `${lines.join("\n")}\n`;
}

async function main() {
  const absorptionManifest = readJson(ABSORPTION_MANIFEST_PATH);
  const attachmentReport = readJson(ATTACHMENT_REPORT_PATH);
  const engine = process.env.PLATFORM_GAME_ENGINE_HASH || absorptionManifest.engine?.testnetHash;
  const live = createLiveRpc({ network: "testnet", label: "audit_platform_game_live_state" });
  const report = await auditPlatformGameLiveState({
    live,
    engine,
    absorptionManifest,
    attachmentReport,
  });
  const jsonPath = process.env.PLATFORM_GAME_LIVE_STATE_JSON || DEFAULT_JSON_REPORT_PATH;
  const markdownPath = process.env.PLATFORM_GAME_LIVE_STATE_MD || DEFAULT_MARKDOWN_REPORT_PATH;
  for (const [relativePath, contents] of [
    [jsonPath, `${JSON.stringify(report, null, 2)}\n`],
    [markdownPath, markdownReport(report)],
  ]) {
    const absolutePath = path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
    console.log(`report: ${relativePath}`);
  }
  console.log(JSON.stringify(report.summary, null, 2));
  if (!report.summary.live_state_ready) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
