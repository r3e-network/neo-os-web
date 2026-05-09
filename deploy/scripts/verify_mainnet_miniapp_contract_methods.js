#!/usr/bin/env node

/**
 * Mainnet miniapp contract method verifier.
 *
 * This is intentionally read-only. It verifies every miniapp manifest that
 * declares a Neo N3 mainnet contract:
 *   - the configured RPC is really Neo N3 mainnet;
 *   - the contract exists on mainnet;
 *   - runtime-declared operations exist in the live ABI;
 *   - safe ABI methods can be invoked with deterministic smoke parameters.
 *
 * Some entity lookups are expected to fault when the sampled id does not exist;
 * those are reported as non-blocking expected faults. Zero-argument reads and
 * app-scoped core reads are treated as production blockers if they fail.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { MAINNET_MAGIC } = require("./lib/neo_network");

const ROOT = path.resolve(__dirname, "../..");
const APPS_DIR = path.join(ROOT, "apps");
const DEFS_DIR = path.join(ROOT, "platform", "host-app", "public", "miniapp-definitions");
const OUTPUT_PATH = process.env.MAINNET_MINIAPP_CONTRACT_METHOD_REPORT_PATH
  || path.join(ROOT, "docs", "reports", "mainnet-miniapp-contract-methods-latest.json");
const MAINNET_KEY = "neo-n3-mainnet";
const PUBLIC_ACCOUNT = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
const ZERO_HASH160 = "0x0000000000000000000000000000000000000000";
const ZERO_HASH256 = `0x${"0".repeat(64)}`;
const SAMPLE_BYTES = Buffer.from("yiwu-mainnet-read-smoke", "utf8").toString("base64");
const SAMPLE_PUBLIC_KEY = Buffer.from(`02${"1".repeat(64)}`, "hex").toString("base64");
const RPC_TIMEOUT_MS = parsePositiveInt(process.env.MAINNET_MINIAPP_METHOD_RPC_TIMEOUT_MS, 8_000, 1_000, 60_000);
const METHOD_CONCURRENCY = parsePositiveInt(process.env.MAINNET_MINIAPP_METHOD_CONCURRENCY, 6, 1, 24);
const PROGRESS_EVERY = parsePositiveInt(process.env.MAINNET_MINIAPP_METHOD_PROGRESS_EVERY, 10, 1, 500);
const MAX_SAFE_READS = parsePositiveInt(process.env.MAINNET_MINIAPP_METHOD_MAX_SAFE_READS, 0, 0, 10_000);
const PROGRESS_ENABLED = process.env.MAINNET_MINIAPP_METHOD_PROGRESS !== "0";

const RPC_CANDIDATES = [
  process.env.NEO_RPC_MAINNET,
  process.env.NEO_MAINNET_RPC_URL,
  process.env.NEO_N3_MAINNET_RPC_URL,
  "https://mainnet2.neo.coz.io:443",
  "https://api.n3index.dev/mainnet",
]
  .map((value) => String(value || "").trim())
  .filter(Boolean)
  .filter((value, index, list) => list.indexOf(value) === index);

const CORE_APP_SCOPED_READS = new Set([
  "abstractAccount",
  "admin",
  "calculateCountdownKeyCost",
  "getAnchorStats",
  "getAppAdmin",
  "getAppMode",
  "getCoinFlipBetLimits",
  "getCountdownStatus",
  "getCredit",
  "getDiceBetLimits",
  "getDirectGasCredit",
  "getGameAdmin",
  "getGameConfig",
  "getGameType",
  "getLendingStats",
  "getPendingRewards",
  "getPlatformStats",
  "getProfitAnchor",
  "getRewardPerNeo",
  "getRewardRemainder",
  "getRewardReserve",
  "getSelectedAgentId",
  "getSelectedCandidate",
  "getTotalGasCredit",
  "getTotalRewardReserve",
  "getTotalStaked",
  "getTotalStakers",
  "getUserStake",
  "isAppPaused",
  "isContractPaused",
  "isGameActive",
  "isPaused",
  "oracle",
]);

const EXPECTED_EMPTY_STATE = /not found|does not exist|missing|invalid|not registered|unknown|no .+ found|index out of range|out of range|empty|uninitialized/i;

function parsePositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function logProgress(message) {
  if (!PROGRESS_ENABLED) return;
  console.error(`[mainnet-methods ${new Date().toISOString()}] ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeHash(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.startsWith("0x") ? raw.toLowerCase() : `0x${raw.toLowerCase()}`;
}

function safeString(value) {
  return String(value == null ? "" : value);
}

async function fetchJsonRpc(rpcUrl, method, params = [], { timeoutMs = RPC_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!text.trim()) {
      throw new Error(`${rpcUrl}: empty response for ${method} (${response.status})`);
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`${rpcUrl}: non-json response for ${method}: ${text.slice(0, 120)}`);
    }
    if (json.error) {
      throw new Error(`${rpcUrl}: ${json.error.message || json.error.code || "rpc error"}`);
    }
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

async function rpc(method, params = []) {
  const errors = [];
  for (const rpcUrl of RPC_CANDIDATES) {
    try {
      return {
        rpcUrl,
        result: await fetchJsonRpc(rpcUrl, method, params),
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join("; "));
}

function getVersionMagic(version) {
  return Number(
    version?.protocol?.network
      || version?.network
      || version?.tcpport && version?.nonce
      || 0,
  );
}

async function selectMainnetRpc() {
  const errors = [];
  logProgress(`selecting mainnet RPC from ${RPC_CANDIDATES.length} candidate(s), timeout=${RPC_TIMEOUT_MS}ms`);
  for (const rpcUrl of RPC_CANDIDATES) {
    try {
      const version = await fetchJsonRpc(rpcUrl, "getversion", []);
      const magic = getVersionMagic(version);
      if (magic !== MAINNET_MAGIC) {
        throw new Error(`network magic mismatch: expected ${MAINNET_MAGIC}, got ${magic || "unknown"}`);
      }
      logProgress(`selected RPC ${rpcUrl} magic=${magic}`);
      return { rpcUrl, version, magic };
    } catch (error) {
      errors.push(`${rpcUrl}: ${error instanceof Error ? error.message : String(error)}`);
      logProgress(`RPC candidate rejected: ${rpcUrl} (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  throw new Error(`No usable Neo N3 mainnet RPC. ${errors.join("; ")}`);
}

async function rpcOn(rpcUrl, method, params = [], options = {}) {
  return fetchJsonRpc(rpcUrl, method, params, {
    timeoutMs: options.timeoutMs || RPC_TIMEOUT_MS,
  });
}

function loadApps() {
  const rows = [];
  for (const entry of fs.readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "shared") continue;
    const filePath = path.join(APPS_DIR, entry.name, "neo-manifest.json");
    if (!fs.existsSync(filePath)) continue;
    const manifest = readJson(filePath);
    rows.push({
      slug: entry.name,
      appId: String(manifest.id || `miniapp-${entry.name}`),
      name: String(manifest.name || entry.name),
      manifestPath: path.relative(ROOT, filePath),
      manifest,
      mainnetHash: normalizeHash(manifest.contracts?.[MAINNET_KEY]),
    });
  }
  return rows.sort((a, b) => a.appId.localeCompare(b.appId));
}

function loadDefinition(slug) {
  const filePath = path.join(DEFS_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function extractRuntimeOperations(manifest) {
  const operations = [];
  const modules = Array.isArray(manifest?.runtime?.modules) ? manifest.runtime.modules : [];
  modules.forEach((module, moduleIndex) => {
    const raw = module?.operations;
    if (!raw) return;
    if (Array.isArray(raw)) {
      raw.forEach((entry, index) => {
        const method = typeof entry === "string" ? entry : entry?.method;
        if (method) {
          operations.push({
            source: `runtime.modules[${moduleIndex}].operations[${index}]`,
            alias: typeof entry === "string" ? entry : entry.name || entry.alias || method,
            method: String(method),
            required: true,
          });
        }
      });
    } else if (typeof raw === "object") {
      Object.entries(raw).forEach(([alias, method]) => {
        if (method) {
          operations.push({
            source: `runtime.modules[${moduleIndex}].operations.${alias}`,
            alias,
            method: String(method),
            required: true,
          });
        }
      });
    }
  });
  return operations;
}

function extractUiOperations(app, definition) {
  const operations = [];
  const fromManifest = app.manifest?.operation_panel?.operations || app.manifest?.operations || [];
  const fromDefinition = definition?.operations || definition?.frontend_spec?.operation_panel?.operations || [];
  for (const [source, list] of [
    ["manifest.operation_panel", fromManifest],
    ["definition.operations", fromDefinition],
  ]) {
    if (!Array.isArray(list)) continue;
    list.forEach((entry, index) => {
      if (entry?.method) {
        operations.push({
          source: `${source}[${index}]`,
          name: String(entry.name || entry.method),
          method: String(entry.method),
          params: Array.isArray(entry.params) ? entry.params.length : 0,
        });
      }
    });
  }
  return operations;
}

function abiMethodKey(method) {
  return `${method.name}/${Array.isArray(method.parameters) ? method.parameters.length : 0}`;
}

function firstAbiMethod(methods, name) {
  return methods.find((method) => method.name === name);
}

function numberForParam(methodName, paramName, index) {
  const name = paramName.toLowerCase();
  if (name.includes("agent")) return "1";
  if (name.includes("candidate")) return "0";
  if (name.includes("type") && /record|resolve/i.test(methodName)) return "16";
  if (name.includes("type") || name.includes("mode")) return "1";
  if (name.includes("count") || name.includes("limit")) return "1";
  if (name.includes("key")) return "1";
  if (name.includes("face") || name.includes("number") || name.includes("dice")) return "6";
  if (name.includes("duration") || name.includes("deadline") || name.includes("expiry")) return "3600";
  if (name.includes("amount") || name.includes("value") || name.includes("fee") || name.includes("price")) return "1000000";
  if (name.includes("index")) return "0";
  if (name.endsWith("id") || name.includes("id")) return index === 0 ? "0" : "1";
  return "0";
}

function stringForParam(app, methodName, paramName) {
  const name = paramName.toLowerCase();
  if (name.includes("appid") || name === "app") return app.appId;
  if (name.includes("domain")) return `${app.slug}.miniapp.neo`;
  if (name === "name" || name.includes("name")) return /resolve|record/i.test(methodName) ? "neo" : app.name;
  if (name.includes("symbol")) return "GAS";
  if (name.includes("asset")) return "GAS";
  if (name.includes("url") || name.includes("uri")) return "https://neomini.app";
  if (name.includes("key")) return "mainnet-read-smoke";
  return app.appId;
}

function buildParam(app, methodName, param, index) {
  const type = String(param?.type || "Any");
  const name = String(param?.name || "");
  switch (type) {
    case "String":
      return { type, value: stringForParam(app, methodName, name) };
    case "Integer":
      return { type, value: numberForParam(methodName, name, index) };
    case "Boolean":
      return { type, value: false };
    case "Hash160":
      return { type, value: PUBLIC_ACCOUNT || ZERO_HASH160 };
    case "Hash256":
      return { type, value: ZERO_HASH256 };
    case "ByteArray":
    case "ByteString":
    case "Signature":
      return { type, value: SAMPLE_BYTES };
    case "PublicKey":
      return { type, value: SAMPLE_PUBLIC_KEY };
    case "Array":
      return { type, value: [] };
    case "Map":
      return { type, value: [] };
    case "Any":
      return { type, value: null };
    default:
      return { type: "Any", value: null, unsupportedSourceType: type };
  }
}

function buildArgs(app, method) {
  return (method.parameters || []).map((param, index) => buildParam(app, method.name, param, index));
}

function isHardRead(app, method) {
  const params = method.parameters || [];
  if (params.length === 0) return true;
  if (!CORE_APP_SCOPED_READS.has(method.name)) return false;
  return params.every((param) => {
    const name = String(param.name || "").toLowerCase();
    const type = String(param.type || "");
    return (
      type === "String"
      || type === "Integer"
      || type === "Hash160"
      || name.includes("app")
      || name.includes("agent")
      || name.includes("key")
      || name.includes("count")
      || name.includes("candidate")
    );
  });
}

function summarizeStack(result) {
  const first = Array.isArray(result?.stack) ? result.stack[0] : null;
  return {
    stackType: first?.type || null,
    stackItems: Array.isArray(result?.stack) ? result.stack.length : 0,
  };
}

async function verifySafeMethod(rpcUrl, app, hash, method) {
  const args = buildArgs(app, method);
  const hard = isHardRead(app, method);
  const base = {
    method: method.name,
    signature: abiMethodKey(method),
    safe: true,
    hard,
    args: args.map((arg) => ({ type: arg.type })),
  };

  try {
    const result = await rpcOn(rpcUrl, "invokefunction", [hash, method.name, args]);
    const state = String(result?.state || "unknown").toUpperCase();
    if (state === "HALT") {
      return {
        ...base,
        status: "halt",
        vmstate: state,
        ...summarizeStack(result),
      };
    }

    const exception = safeString(result?.exception || "unknown fault");
    const status = hard ? "failure" : EXPECTED_EMPTY_STATE.test(exception) ? "expected_fault" : "sample_fault";
    return {
      ...base,
      status,
      vmstate: state,
      exception,
    };
  } catch (error) {
    const exception = error instanceof Error ? error.message : String(error);
    return {
      ...base,
      status: hard ? "failure" : "rpc_or_sample_error",
      exception,
    };
  }
}

async function withConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

async function main() {
  logProgress(`starting mainnet method verifier concurrency=${METHOD_CONCURRENCY} timeout=${RPC_TIMEOUT_MS}ms`);
  const selectedRpc = await selectMainnetRpc();
  const apps = loadApps();
  const contractApps = apps.filter((app) => app.mainnetHash);
  const uniqueHashes = [...new Set(contractApps.map((app) => app.mainnetHash))].sort();
  const contractStates = new Map();
  const contractErrors = new Map();

  logProgress(`loaded ${apps.length} miniapp(s), ${contractApps.length} contract-backed, ${uniqueHashes.length} unique contract(s)`);
  await withConcurrency(uniqueHashes, METHOD_CONCURRENCY, async (hash, index) => {
    logProgress(`contract state ${index + 1}/${uniqueHashes.length}: ${hash}`);
    try {
      contractStates.set(hash, await rpcOn(selectedRpc.rpcUrl, "getcontractstate", [hash]));
    } catch (error) {
      contractErrors.set(hash, error instanceof Error ? error.message : String(error));
    }
  });

  const rows = [];
  const blockers = [];
  let safeMethodsDiscovered = 0;
  let safeInvocationsAttempted = 0;
  let safeInvocationsSkipped = 0;
  let haltCount = 0;
  let expectedFaultCount = 0;
  let sampleFaultCount = 0;

  for (const [appIndex, app] of apps.entries()) {
    logProgress(`app ${appIndex + 1}/${apps.length}: ${app.appId}`);
    const definition = loadDefinition(app.slug);
    const row = {
      appId: app.appId,
      slug: app.slug,
      name: app.name,
      manifestPath: app.manifestPath,
      mainnetHash: app.mainnetHash || null,
      contractBacked: Boolean(app.mainnetHash),
      contractName: null,
      status: app.mainnetHash ? "pending" : "frontend-or-server-only",
      runtimeOperations: [],
      uiOperations: extractUiOperations(app, definition),
      safeMethodSummary: null,
      failures: [],
    };

    if (!app.mainnetHash) {
      rows.push(row);
      continue;
    }

    const state = contractStates.get(app.mainnetHash);
    const stateError = contractErrors.get(app.mainnetHash);
    if (!state || stateError) {
      row.status = "missing-contract";
      row.failures.push(`mainnet contract not reachable: ${stateError || "missing state"}`);
      blockers.push(`${app.appId}: mainnet contract not reachable`);
      rows.push(row);
      continue;
    }

    const methods = Array.isArray(state?.manifest?.abi?.methods) ? state.manifest.abi.methods : [];
    const methodNames = new Set(methods.map((method) => method.name));
    const safeMethods = methods.filter((method) => method.safe === true);
    safeMethodsDiscovered += safeMethods.length;
    row.contractName = String(state?.manifest?.name || "");
    row.contractUpdateMethod = methodNames.has("update");
    row.methodCount = methods.length;
    row.safeMethodCount = safeMethods.length;
    row.status = "deployed";

    const runtimeOperations = extractRuntimeOperations(app.manifest);
    row.runtimeOperations = runtimeOperations.map((operation) => ({
      ...operation,
      existsInAbi: methodNames.has(operation.method),
    }));
    for (const operation of row.runtimeOperations) {
      if (!operation.existsInAbi) {
        row.failures.push(`runtime operation ${operation.source} -> ${operation.method} missing from live ABI`);
      }
    }

    const uiOperationRows = row.uiOperations.map((operation) => ({
      ...operation,
      existsInAbi: methodNames.has(operation.method),
      classification: methodNames.has(operation.method) ? "contract" : "client-or-server-action",
    }));
    row.uiOperations = uiOperationRows;

    const remainingSafeReadBudget = MAX_SAFE_READS > 0 ? Math.max(0, MAX_SAFE_READS - safeInvocationsAttempted) : safeMethods.length;
    const safeMethodsToInvoke = safeMethods.slice(0, remainingSafeReadBudget);
    safeInvocationsSkipped += safeMethods.length - safeMethodsToInvoke.length;

    const safeResults = await withConcurrency(safeMethodsToInvoke, METHOD_CONCURRENCY, async (method) => {
      const result = await verifySafeMethod(selectedRpc.rpcUrl, app, app.mainnetHash, method);
      safeInvocationsAttempted += 1;
      if (safeInvocationsAttempted === 1 || safeInvocationsAttempted % PROGRESS_EVERY === 0) {
        logProgress(`safe reads ${safeInvocationsAttempted}/${MAX_SAFE_READS > 0 ? MAX_SAFE_READS : "all"} latest=${app.appId}.${abiMethodKey(method)} status=${result.status}`);
      }
      if (result.status === "halt") haltCount += 1;
      if (result.status === "expected_fault") expectedFaultCount += 1;
      if (result.status === "sample_fault" || result.status === "rpc_or_sample_error") sampleFaultCount += 1;
      if (result.status === "failure") {
        row.failures.push(`safe read ${result.signature} failed: ${result.exception || result.vmstate || "unknown"}`);
      }
      return result;
    });

    row.safeMethodSummary = {
      total: safeResults.length,
      discovered: safeMethods.length,
      skippedByLimit: safeMethods.length - safeResults.length,
      halt: safeResults.filter((result) => result.status === "halt").length,
      expectedFault: safeResults.filter((result) => result.status === "expected_fault").length,
      sampleFault: safeResults.filter((result) => result.status === "sample_fault").length,
      rpcOrSampleError: safeResults.filter((result) => result.status === "rpc_or_sample_error").length,
      hardFailures: safeResults.filter((result) => result.status === "failure").length,
      hardChecked: safeResults.filter((result) => result.hard).map((result) => result.signature),
    };
    row.safeMethodResults = safeResults;

    if (row.failures.length > 0) {
      row.status = "failed";
      blockers.push(...row.failures.map((failure) => `${app.appId}: ${failure}`));
    } else {
      row.status = "passed";
    }

    rows.push(row);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    network: MAINNET_KEY,
    rpcUrl: selectedRpc.rpcUrl,
    networkMagic: selectedRpc.magic,
    totalMiniapps: apps.length,
    mainnetContractApps: contractApps.length,
    frontendOrServerOnlyApps: apps.length - contractApps.length,
    uniqueMainnetContracts: uniqueHashes.length,
    contractStateErrors: contractErrors.size,
    safeMethodsDiscovered,
    safeInvocationsAttempted,
    safeInvocationsSkipped,
    haltCount,
    expectedFaultCount,
    sampleFaultCount,
    blockerCount: blockers.length,
    blockers,
    rows,
    verifier: {
      timeoutMs: RPC_TIMEOUT_MS,
      concurrency: METHOD_CONCURRENCY,
      progressEvery: PROGRESS_EVERY,
      maxSafeReads: MAX_SAFE_READS,
    },
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(JSON.stringify({
    report: path.relative(ROOT, OUTPUT_PATH),
    network: summary.network,
    rpcUrl: summary.rpcUrl,
    totalMiniapps: summary.totalMiniapps,
    mainnetContractApps: summary.mainnetContractApps,
    frontendOrServerOnlyApps: summary.frontendOrServerOnlyApps,
    uniqueMainnetContracts: summary.uniqueMainnetContracts,
    safeMethodsDiscovered: summary.safeMethodsDiscovered,
    safeInvocationsAttempted: summary.safeInvocationsAttempted,
    safeInvocationsSkipped: summary.safeInvocationsSkipped,
    timeoutMs: summary.verifier.timeoutMs,
    concurrency: summary.verifier.concurrency,
    haltCount: summary.haltCount,
    expectedFaultCount: summary.expectedFaultCount,
    sampleFaultCount: summary.sampleFaultCount,
    blockerCount: summary.blockerCount,
    blockers: summary.blockers,
  }, null, 2));

  logProgress(`finished with blockerCount=${summary.blockerCount}, contractStateErrors=${summary.contractStateErrors}, report=${path.relative(ROOT, OUTPUT_PATH)}`);

  if (summary.blockerCount > 0 || summary.contractStateErrors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
