#!/usr/bin/env node

/**
 * Bind configured contract domains in NeoNS.
 *
 * This script is intentionally separate from the read-only audit. It only
 * submits mainnet transactions when --execute is passed and a domain-owner WIF
 * is provided through a local secret env var. WIF values are never printed.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const Neon = require("@cityofzion/neon-js");
const { MAINNET_MAGIC } = require("./lib/neo_network");

const ROOT = path.resolve(__dirname, "../..");
const COVERAGE_REPORT = path.join(ROOT, "docs", "reports", "contract-domain-coverage-latest.json");
const OUTPUT_PATH = process.env.NEONS_BIND_REPORT_PATH
  || path.join(ROOT, "docs", "reports", "contract-domain-bind-latest.json");

const NNS_CONTRACT_HASH = "0x50ac1c37690cc2cfc594472833cf57505d5f46de";
const RECORD_TYPE_CONTRACT_ADDRESS = 16;
const DEFAULT_RPC = process.env.NEO_RPC_MAINNET
  || process.env.NEO_MAINNET_RPC_URL
  || process.env.NEO_N3_MAINNET_RPC_URL
  || "https://mainnet2.neo.coz.io:443";
const WIF_ENV_KEYS = [
  "NEONS_DOMAIN_OWNER_WIF",
  "NEO_NNS_DOMAIN_OWNER_WIF",
  "DOMAIN_OWNER_WIF",
  "NEO_MAINNET_DOMAIN_OWNER_WIF",
  "MINIAPP_DOMAIN_OWNER_WIF",
];

function hasArg(name) {
  return process.argv.includes(name);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function parsePositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function reverseHex(hex) {
  return String(hex || "").replace(/^0x/i, "").match(/../g).reverse().join("");
}

function signerForRpc(account) {
  return `0x${account.scriptHash}`;
}

function findOwnerWif() {
  for (const key of WIF_ENV_KEYS) {
    const value = String(process.env[key] || "").trim();
    if (value) return { key, value };
  }
  return null;
}

function dedupeActionable(records) {
  const seen = new Set();
  const out = [];
  for (const record of records) {
    const key = `${record.domain}|${record.expected_address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  return out;
}

function loadActionable() {
  if (!fs.existsSync(COVERAGE_REPORT)) {
    throw new Error(`Missing ${path.relative(ROOT, COVERAGE_REPORT)}. Run npm run -s audit:contract-domains first.`);
  }
  const report = loadJson(COVERAGE_REPORT);
  const records = Array.isArray(report.actionable)
    ? report.actionable
    : (report.records || []).filter((record) => record.status === "chain_missing" || record.status === "chain_mismatch");
  return dedupeActionable(records)
    .filter((record) => record.domain && record.expected_address)
    .sort((a, b) => String(a.domain).localeCompare(String(b.domain)));
}

async function fetchJsonRpc(rpcUrl, method, params, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    const json = await response.json();
    if (json.error) throw new Error(json.error.message || json.error.code || "rpc error");
    return json.result;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${rpcUrl}: ${method} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function assertMainnet(rpcUrl) {
  const version = await fetchJsonRpc(rpcUrl, "getversion", []);
  const magic = Number(version?.protocol?.network || version?.network || 0);
  if (magic !== MAINNET_MAGIC) {
    throw new Error(`RPC network magic mismatch: expected ${MAINNET_MAGIC}, got ${magic || "unknown"}`);
  }
  return magic;
}

function buildSetRecordArgs(record) {
  return [
    { type: "String", value: record.domain },
    { type: "Integer", value: String(RECORD_TYPE_CONTRACT_ADDRESS) },
    { type: "String", value: record.expected_address },
  ];
}

async function simulateSetRecord(rpcUrl, account, record) {
  const result = await fetchJsonRpc(rpcUrl, "invokefunction", [
    NNS_CONTRACT_HASH,
    "setRecord",
    buildSetRecordArgs(record),
    [{ account: signerForRpc(account), scopes: "CalledByEntry" }],
  ]);
  return {
    state: String(result?.state || "unknown").toUpperCase(),
    exception: result?.exception || null,
    gasConsumed: String(result?.gasconsumed || "0"),
  };
}

async function sendSetRecord(rpcUrl, account, record, gasConsumed) {
  const client = new Neon.rpc.RPCClient(rpcUrl);
  const signers = [{ account: account.scriptHash, scopes: "CalledByEntry" }];
  const script = Neon.sc.createScript({
    scriptHash: NNS_CONTRACT_HASH,
    operation: "setRecord",
    args: buildSetRecordArgs(record),
  });
  const height = await client.getBlockCount();
  const validUntilBlock = height + 100;
  const systemFee = Neon.u.BigInteger.fromNumber(gasConsumed);

  const feeProbe = new Neon.tx.Transaction({
    signers,
    validUntilBlock,
    script,
    systemFee,
    networkFee: Neon.u.BigInteger.fromNumber(0),
  });
  feeProbe.sign(account, MAINNET_MAGIC);
  const networkFee = await client.calculateNetworkFee(feeProbe);

  const tx = new Neon.tx.Transaction({
    signers,
    validUntilBlock,
    script,
    systemFee,
    networkFee: Neon.u.BigInteger.fromNumber(networkFee),
  });
  tx.sign(account, MAINNET_MAGIC);
  return client.sendRawTransaction(tx);
}

async function main() {
  const execute = hasArg("--execute") || process.env.NEONS_BIND_EXECUTE === "1";
  const limit = parsePositiveInt(argValue("--limit") || process.env.NEONS_BIND_LIMIT, 0, 0, 500);
  const onlyDomain = String(argValue("--domain") || "").trim().toLowerCase();
  const rpcUrl = String(argValue("--rpc") || DEFAULT_RPC).trim();
  const magic = await assertMainnet(rpcUrl);
  let actions = loadActionable();
  if (onlyDomain) actions = actions.filter((record) => String(record.domain).toLowerCase() === onlyDomain);
  if (limit > 0) actions = actions.slice(0, limit);

  const ownerSecret = findOwnerWif();
  const account = ownerSecret ? new Neon.wallet.Account(ownerSecret.value) : null;
  const rows = [];
  const startedAt = new Date().toISOString();

  if (!account) {
    const report = {
      generated_at: new Date().toISOString(),
      started_at: startedAt,
      network: "neo-n3-mainnet",
      rpc_url: rpcUrl,
      network_magic: magic,
      execute,
      signer_status: "missing",
      required_env_keys: WIF_ENV_KEYS,
      action_count: actions.length,
      actions: actions.map((record) => ({
        domain: record.domain,
        expected_address: record.expected_address,
        current_status: record.status,
        resolved_address: record.resolved_address || "",
        parent_domain: record.parent_domain || "",
        parent_owner_address: record.parent_owner_address || "",
        status: "blocked_missing_signer",
      })),
    };
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({
      report: path.relative(ROOT, OUTPUT_PATH),
      execute,
      signerStatus: report.signer_status,
      actionCount: actions.length,
      requiredEnvKeys: WIF_ENV_KEYS,
    }, null, 2));
    if (execute && actions.length > 0) process.exitCode = 1;
    return;
  }

  console.error(`[neons-bind] signer key=${ownerSecret.key} address=${account.address} actions=${actions.length} execute=${execute}`);
  for (const [index, record] of actions.entries()) {
    const row = {
      index: index + 1,
      domain: record.domain,
      expected_address: record.expected_address,
      previous_status: record.status,
      previous_resolved_address: record.resolved_address || "",
      parent_domain: record.parent_domain || "",
      parent_owner_address: record.parent_owner_address || "",
      signer_address: account.address,
      simulation: null,
      status: "pending",
      tx_hash: "",
      error: "",
    };
    console.error(`[neons-bind] ${row.index}/${actions.length} simulate ${row.domain} -> ${row.expected_address}`);
    try {
      const simulation = await simulateSetRecord(rpcUrl, account, record);
      row.simulation = simulation;
      if (simulation.state !== "HALT") {
        row.status = "blocked_simulation_fault";
        row.error = simulation.exception || `VM state ${simulation.state}`;
      } else if (!execute) {
        row.status = "dry_run_ready";
      } else {
        console.error(`[neons-bind] ${row.index}/${actions.length} send ${row.domain}`);
        row.tx_hash = await sendSetRecord(rpcUrl, account, record, simulation.gasConsumed);
        row.status = "submitted";
      }
    } catch (error) {
      row.status = "error";
      row.error = error instanceof Error ? error.message : String(error);
    }
    rows.push(row);
  }

  const report = {
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    network: "neo-n3-mainnet",
    rpc_url: rpcUrl,
    network_magic: magic,
    execute,
    signer_status: "configured",
    signer_address: account.address,
    action_count: actions.length,
    submitted_count: rows.filter((row) => row.status === "submitted").length,
    ready_count: rows.filter((row) => row.status === "dry_run_ready").length,
    blocked_count: rows.filter((row) => row.status.startsWith("blocked")).length,
    error_count: rows.filter((row) => row.status === "error").length,
    rows,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    report: path.relative(ROOT, OUTPUT_PATH),
    execute,
    signerStatus: report.signer_status,
    signerAddress: report.signer_address,
    actionCount: report.action_count,
    submittedCount: report.submitted_count,
    readyCount: report.ready_count,
    blockedCount: report.blocked_count,
    errorCount: report.error_count,
  }, null, 2));

  if (report.blocked_count > 0 || report.error_count > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
