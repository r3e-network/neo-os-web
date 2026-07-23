#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  defaultRpcCandidates,
  fetchJsonRpc,
  loadPlatformTargets,
  selectTestnetRpc,
} from "./verify_platform_contracts_live.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const gasHash = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const neoHash = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

export function decodeVmInteger(base64) {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) return 0n;
  let value = 0n;
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(bytes[index]);
  }
  if ((bytes[bytes.length - 1] & 0x80) !== 0) {
    value -= 1n << BigInt(bytes.length * 8);
  }
  return value;
}

export function decodeLegacyCreditRows(prefix, rows) {
  return rows.map((row) => {
    const key = Buffer.from(row.key, "base64");
    if (key.length !== 21 || key[0] !== prefix) {
      throw new Error(`unexpected legacy credit key for prefix 0x${prefix.toString(16)}`);
    }
    const accountBytes = key.subarray(1);
    return {
      key_base64: row.key,
      stored_account_bytes: accountBytes.toString("hex"),
      script_hash: `0x${Buffer.from(accountBytes).reverse().toString("hex")}`,
      amount_datoshi: decodeVmInteger(row.value).toString(),
    };
  });
}

function integerStackValue(invocation, label) {
  if (invocation?.state !== "HALT") {
    throw new Error(`${label} did not HALT: ${invocation?.exception ?? invocation?.state}`);
  }
  const item = invocation.stack?.[0];
  if (item?.type !== "Integer" || !/^-?\d+$/.test(String(item.value ?? ""))) {
    throw new Error(`${label} did not return an Integer`);
  }
  return BigInt(item.value);
}

async function findStorageRows(rpcUrl, contractHash, prefix, rpcCall) {
  const prefixBase64 = Buffer.from([prefix]).toString("base64");
  const rows = [];
  let start = null;
  for (;;) {
    const params = start == null
      ? [contractHash, prefixBase64]
      : [contractHash, prefixBase64, start];
    const page = await rpcCall(rpcUrl, "findstorage", params);
    rows.push(...(page.results ?? []));
    if (!page.truncated) return rows;
    start = page.next;
    if (!Number.isInteger(start) || start < 0) {
      throw new Error(`findstorage returned invalid continuation for prefix 0x${prefix.toString(16)}`);
    }
  }
}

async function nativeBalance(rpcUrl, tokenHash, accountHash, rpcCall) {
  const invocation = await rpcCall(rpcUrl, "invokefunction", [
    tokenHash,
    "balanceOf",
    [{ type: "Hash160", value: accountHash }],
  ]);
  return integerStackValue(invocation, `${tokenHash}.balanceOf`);
}

function sumRows(rows) {
  return rows.reduce((total, row) => total + BigInt(row.amount_datoshi), 0n);
}

export async function auditPlatformDeFiLegacyCredits({
  rpcCandidates = defaultRpcCandidates(),
  rpcCall = fetchJsonRpc,
  targets = loadPlatformTargets(),
  now = () => new Date(),
} = {}) {
  const target = targets.find((candidate) => candidate.name === "PlatformDeFi");
  if (!target?.hash) throw new Error("PlatformDeFi testnet target is missing");
  const selected = await selectTestnetRpc(rpcCandidates, rpcCall);
  const [blockCount, neoRawRows, gasRawRows, neoBalance, gasBalance] = await Promise.all([
    rpcCall(selected.rpcUrl, "getblockcount", []),
    findStorageRows(selected.rpcUrl, target.hash, 0x14, rpcCall),
    findStorageRows(selected.rpcUrl, target.hash, 0x15, rpcCall),
    nativeBalance(selected.rpcUrl, neoHash, target.hash, rpcCall),
    nativeBalance(selected.rpcUrl, gasHash, target.hash, rpcCall),
  ]);
  const neoRows = decodeLegacyCreditRows(0x14, neoRawRows);
  const gasRows = decodeLegacyCreditRows(0x15, gasRawRows);
  const neoTotal = sumRows(neoRows);
  const gasTotal = sumRows(gasRows);
  const neoGap = neoBalance - neoTotal;
  const gasGap = gasBalance - gasTotal;
  const hasLegacyRows = neoRows.length > 0 || gasRows.length > 0;
  const underbacked = neoGap < 0n || gasGap < 0n;

  return {
    generated_at_utc: now().toISOString(),
    network: "neo-n3-testnet",
    network_magic: selected.networkMagic,
    rpc_url: selected.rpcUrl,
    block_count: Number(blockCount),
    platform_defi_hash: target.hash,
    legacy_credit_prefixes: {
      neo: {
        prefix: "0x14",
        key_schema: "prefix || payer Hash160",
        rows: neoRows,
        total_datoshi: neoTotal.toString(),
        native_balance_datoshi: neoBalance.toString(),
        backing_gap_datoshi: neoGap.toString(),
      },
      gas: {
        prefix: "0x15",
        key_schema: "prefix || payer Hash160",
        rows: gasRows,
        total_datoshi: gasTotal.toString(),
        native_balance_datoshi: gasBalance.toString(),
        backing_gap_datoshi: gasGap.toString(),
      },
    },
    summary: {
      legacy_credit_rows: neoRows.length + gasRows.length,
      neo_legacy_credit_rows: neoRows.length,
      gas_legacy_credit_rows: gasRows.length,
      has_legacy_credit_rows: hasLegacyRows,
      underbacked,
      migration_status: hasLegacyRows
        ? underbacked
          ? "blocked-nonempty-and-underbacked"
          : "blocked-nonempty"
        : "empty-prefixes-at-snapshot",
      transactions: 0,
    },
    boundary:
      "This is a credential-free read-only RPC snapshot, not an atomic migration lock. A later update still requires deposits to be prevented during an exact final snapshot. Non-empty payer-global rows cannot be assigned to appIds without an explicit reviewed migration.",
  };
}

export function renderPlatformDeFiLegacyCreditsMarkdown(report) {
  const neo = report.legacy_credit_prefixes.neo;
  const gas = report.legacy_credit_prefixes.gas;
  const deficitSummary = [
    ["NEO", neo.backing_gap_datoshi],
    ["GAS", gas.backing_gap_datoshi],
  ]
    .filter(([, gap]) => BigInt(gap) < 0n)
    .map(([asset, gap]) => `${asset} ${-BigInt(gap)} datoshi`)
    .join(", ");
  return [
    "# PlatformDeFi Legacy Credit Snapshot",
    "",
    `Generated: ${report.generated_at_utc}`,
    "",
    "## Summary",
    "",
    `- Network: ${report.network} (magic ${report.network_magic})`,
    `- RPC block count: ${report.block_count}`,
    `- PlatformDeFi: ${report.platform_defi_hash}`,
    `- Legacy credit rows: ${report.summary.legacy_credit_rows}`,
    `- NEO prefix 0x14: ${report.summary.neo_legacy_credit_rows} rows, total ${neo.total_datoshi}, native balance ${neo.native_balance_datoshi}, gap ${neo.backing_gap_datoshi}`,
    `- GAS prefix 0x15: ${report.summary.gas_legacy_credit_rows} rows, total ${gas.total_datoshi}, native balance ${gas.native_balance_datoshi}, gap ${gas.backing_gap_datoshi}`,
    `- Migration status: ${report.summary.migration_status}`,
    `- Transactions broadcast: ${report.summary.transactions}`,
    `- Boundary: ${report.boundary}`,
    "",
    "## Decision",
    "",
    report.summary.has_legacy_credit_rows
      ? report.summary.underbacked
        ? `Do not execute the live PlatformDeFi v1.2 update yet. The local candidate has an auto-paused exact-snapshot recovery bridge, but the legacy credit total exceeds native backing. First separately approve and simulate the reported deficit top-up (${deficitSummary}), exact snapshot initialization, activation, and every payer withdrawal. With zero tenant bindings, still prefer a fresh v1.2 deployment.`
        : "Do not execute the live PlatformDeFi v1.2 update yet. Review and simulate the local auto-paused exact-snapshot recovery bridge, activation, and every payer withdrawal; with zero tenant bindings, still prefer a fresh v1.2 deployment."
      : "The legacy prefixes were empty at this snapshot, but an in-place update still requires a deposit freeze and an exact final re-check.",
    "",
  ].join("\n");
}

export function writePlatformDeFiLegacyCreditsReport(report) {
  const jsonPath = path.join(
    repoRoot,
    "docs",
    "reports",
    "platform-defi-legacy-credit-snapshot-latest.json",
  );
  const markdownPath = path.join(
    repoRoot,
    "docs",
    "reports",
    "platform-defi-legacy-credit-snapshot-latest.md",
  );
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderPlatformDeFiLegacyCreditsMarkdown(report));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await auditPlatformDeFiLegacyCredits();
  writePlatformDeFiLegacyCreditsReport(report);
  console.log(
    `PlatformDeFi legacy credits: ${report.summary.legacy_credit_rows} rows; status=${report.summary.migration_status}; transactions=0.`,
  );
}
