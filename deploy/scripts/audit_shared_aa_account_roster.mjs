#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const defaultReportDirectory = path.join(repoRoot, "deploy", "config");
const outputJsonPath = path.join(
  repoRoot,
  "docs/reports/shared-aa-account-roster-preflight-latest.json",
);
const outputMarkdownPath = path.join(
  repoRoot,
  "docs/reports/shared-aa-account-roster-preflight-latest.md",
);

export const DEFAULT_ABSTRACT_ACCOUNT_TIMELOCK_SECONDS = 2_592_000;
const REGISTRATION_DOMAIN = Buffer.from("aa524701", "hex");
const ZERO_HASH_BYTES = Buffer.alloc(20);
const APP_ID_PATTERN = /^[a-z0-9_.-]{1,64}$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeHash(value, label) {
  const normalized = String(value ?? "").trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error(`${label} must be a 20-byte UInt160 hash`);
  }
  return normalized;
}

function hash160(bytes) {
  const sha256 = crypto.createHash("sha256").update(bytes).digest();
  return crypto.createHash("ripemd160").update(sha256).digest();
}

function uint32LittleEndian(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error("escapeTimelock must be a uint32");
  }
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value, 0);
  return bytes;
}

function displayHashToNeoBytes(hash) {
  return Buffer.from(normalizeHash(hash, "UInt160"), "hex").reverse();
}

/**
 * Mirrors UnifiedSmartWallet.ComputePlatformAccountId plus the Registry's
 * appBinding construction. This is an audit-only preflight; the on-chain
 * Registry remains the address-of-record after materialization.
 */
export function derivePlatformAccountId({
  registryHash,
  appId,
  appAdmin,
  escapeTimelock = DEFAULT_ABSTRACT_ACCOUNT_TIMELOCK_SECONDS,
}) {
  if (!APP_ID_PATTERN.test(String(appId ?? ""))) {
    throw new Error(`invalid appId: ${appId}`);
  }
  const registryBytes = displayHashToNeoBytes(registryHash);
  const backupOwnerBytes = Buffer.from(normalizeHash(appAdmin, "appAdmin"), "hex");
  const appBinding = Buffer.concat([
    registryBytes,
    Buffer.from(appId, "utf8"),
  ]);
  const payload = Buffer.concat([
    REGISTRATION_DOMAIN,
    backupOwnerBytes,
    ZERO_HASH_BYTES,
    ZERO_HASH_BYTES,
    uint32LittleEndian(escapeTimelock),
    appBinding,
  ]);
  return `0x${hash160(payload).toString("hex")}`;
}

// The apps and their neo-manifest.json files are in neo-os-miniapps and
// neo-os-minigames. What this repo has is the committed snapshot the host app
// serves, kept current by scripts/refresh-manifest-snapshot.mjs --check, so the
// roster is read from there rather than from a sibling checkout.
function readManifestRoster() {
  const snapshot = "platform/host-app/public/miniapp-manifests.json";
  const manifests = readJson(path.join(repoRoot, snapshot)).manifests ?? {};
  const roster = Object.entries(manifests)
    .map(([slug, manifest]) => ({
      id: String(manifest.id ?? ""),
      source: `${snapshot}#${slug}`,
    }))
    .filter((entry) => entry.id.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id));

  // An empty roster would make every downstream comparison vacuous.
  if (roster.length === 0) {
    throw new Error(
      `${snapshot} yielded no app ids; run: node scripts/refresh-manifest-snapshot.mjs`,
    );
  }
  return roster;
}

function defaultRosterReportPath() {
  const candidates = fs.readdirSync(defaultReportDirectory)
    .filter((name) => /^cohort0-account-materialization-testnet-\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort();
  const name = candidates.at(-1);
  if (!name) {
    throw new Error("no cohort0 account-materialization report found");
  }
  return path.join(defaultReportDirectory, name);
}

function reportAppMap(sourceReport) {
  const rows = new Map();
  for (const record of sourceReport.apps ?? []) {
    if (rows.has(record.app_id)) {
      throw new Error(`duplicate app_id in source report: ${record.app_id}`);
    }
    rows.set(record.app_id, record);
  }
  return rows;
}

export function buildSharedAaAccountRoster({
  manifests,
  sourceReport,
  registryHash = sourceReport.registry ?? sourceReport.platform_registry,
  escapeTimelock = DEFAULT_ABSTRACT_ACCOUNT_TIMELOCK_SECONDS,
}) {
  const normalizedRegistryHash = `0x${normalizeHash(registryHash, "registryHash")}`;
  const sourceRows = reportAppMap(sourceReport);
  const records = manifests.map((manifest) => {
    const source = sourceRows.get(manifest.id);
    const appRow = source?.app_row;
    const appAdmin = appRow?.[2];
    const record = {
      app_id: manifest.id,
      source_manifest: manifest.source,
      source_report_status: source?.status ?? "missing",
      app_admin: typeof appAdmin === "string" ? appAdmin : null,
      predicted_account_id: null,
      status: "unresolved",
      reason: "missing active Registry app-admin evidence",
    };
    if (!source) return record;
    if (!Array.isArray(appRow) || appRow[5] !== true) {
      record.reason = "source report does not prove an active Registry app row";
      return record;
    }
    if (typeof appAdmin !== "string") {
      record.reason = "source report has no app-admin hash";
      return record;
    }
    try {
      record.predicted_account_id = derivePlatformAccountId({
        registryHash: normalizedRegistryHash,
        appId: manifest.id,
        appAdmin,
        escapeTimelock,
      });
      record.status = "derived";
      record.reason = "deterministic local preflight; not materialized on-chain";
    } catch (error) {
      record.reason = error instanceof Error ? error.message : String(error);
    }
    return record;
  });

  const ownersByAccount = new Map();
  const duplicateAccountIds = [];
  for (const record of records) {
    if (!record.predicted_account_id) continue;
    const previous = ownersByAccount.get(record.predicted_account_id);
    if (previous) {
      duplicateAccountIds.push({
        account_id: record.predicted_account_id,
        app_ids: [previous, record.app_id],
      });
    } else {
      ownersByAccount.set(record.predicted_account_id, record.app_id);
    }
  }
  for (const duplicate of duplicateAccountIds) {
    for (const appId of duplicate.app_ids) {
      const record = records.find((row) => row.app_id === appId);
      if (record) {
        record.status = "duplicate";
        record.reason = `predicted account id duplicates ${duplicate.app_ids.find((id) => id !== appId)}`;
      }
    }
  }

  const appIds = records.map((record) => record.app_id);
  const duplicateAppIds = [...new Set(appIds.filter((id, index) => appIds.indexOf(id) !== index))].sort();
  const manifestAppIds = new Set(appIds);
  const sourceOnlyAppIds = [...sourceRows.keys()]
    .filter((appId) => !manifestAppIds.has(appId))
    .sort();
  const unresolved = records.filter((record) => record.status === "unresolved");
  const derived = records.filter((record) => record.status === "derived");
  return {
    schema: "shared-aa-account-roster-preflight-v1",
    source: {
      registry_hash: normalizedRegistryHash,
      roster_report: sourceReport.__source_path ?? null,
      roster_report_generated_at_utc: sourceReport.generated_at_utc ?? null,
      escape_timelock_seconds: escapeTimelock,
    },
    summary: {
      roster_total: records.length,
      source_rows: sourceRows.size,
      derived_account_ids: derived.length,
      unresolved_account_ids: unresolved.length,
      unique_predicted_account_ids: ownersByAccount.size,
      duplicate_predicted_account_ids: duplicateAccountIds.length,
      duplicate_app_ids: duplicateAppIds.length,
      source_only_app_ids: sourceOnlyAppIds.length,
      complete:
        unresolved.length === 0 &&
        duplicateAccountIds.length === 0 &&
        duplicateAppIds.length === 0 &&
        sourceOnlyAppIds.length === 0,
    },
    records,
    duplicate_app_ids: duplicateAppIds,
    duplicate_account_ids: duplicateAccountIds,
    source_only_app_ids: sourceOnlyAppIds,
    boundary:
      "Predicted IDs prove only deterministic local derivation and roster uniqueness. They do not prove Registry/AA deployment, account materialization, virtual proxy activation, funding, or any chain write.",
  };
}

export function renderSharedAaAccountRosterMarkdown(report) {
  const lines = [
    "# Shared AA Account Roster Preflight",
    "",
    `- Registry hash: \`${report.source.registry_hash}\``,
    `- Source roster report: \`${report.source.roster_report ?? "unknown"}\``,
    `- Escape timelock: ${report.source.escape_timelock_seconds} seconds`,
    "",
    "## Summary",
    "",
    `- Roster rows: ${report.summary.roster_total}`,
    `- Deterministic account IDs: ${report.summary.derived_account_ids}`,
    `- Unique predicted account IDs: ${report.summary.unique_predicted_account_ids}`,
    `- Unresolved rows: ${report.summary.unresolved_account_ids}`,
    `- Duplicate predicted IDs: ${report.summary.duplicate_predicted_account_ids}`,
    `- Source-only rows: ${report.summary.source_only_app_ids}`,
    `- Complete local preflight: ${report.summary.complete ? "yes" : "no"}`,
    "",
    "## Predicted IDs",
    "",
    "| App | App admin | Predicted account ID | Status |",
    "| --- | --- | --- | --- |",
  ];
  for (const record of report.records) {
    lines.push(
      `| ${record.app_id} | ${record.app_admin ?? "-"} | ${record.predicted_account_id ?? "-"} | ${record.status} |`,
    );
  }
  lines.push(
    "",
    "## Boundary",
    "",
    report.boundary,
    "",
  );
  return lines.join("\n");
}

function resolveSourceReport() {
  const configured = process.env.PLATFORM_REGISTRY_ROSTER_REPORT?.trim();
  return configured ? path.resolve(repoRoot, configured) : defaultRosterReportPath();
}

export function buildCurrentSharedAaAccountRoster() {
  const sourcePath = resolveSourceReport();
  const sourceReport = readJson(sourcePath);
  sourceReport.__source_path = path.relative(repoRoot, sourcePath);
  return buildSharedAaAccountRoster({
    manifests: readManifestRoster(),
    sourceReport,
  });
}

export function writeSharedAaAccountRosterPreflight({ check = false } = {}) {
  const report = buildCurrentSharedAaAccountRoster();
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = `${renderSharedAaAccountRosterMarkdown(report)}\n`;
  if (check) {
    const currentJson = fs.readFileSync(outputJsonPath, "utf8");
    const currentMarkdown = fs.readFileSync(outputMarkdownPath, "utf8");
    if (currentJson !== json || currentMarkdown !== markdown) {
      throw new Error("shared AA account roster preflight is stale; rerun the audit");
    }
  } else {
    fs.writeFileSync(outputJsonPath, json);
    fs.writeFileSync(outputMarkdownPath, markdown);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = writeSharedAaAccountRosterPreflight({ check: process.argv.includes("--check") });
  console.log(
    `Shared AA roster preflight: ${report.summary.derived_account_ids}/${report.summary.roster_total} derived; ${report.summary.unique_predicted_account_ids} unique; complete=${report.summary.complete}`,
  );
}
