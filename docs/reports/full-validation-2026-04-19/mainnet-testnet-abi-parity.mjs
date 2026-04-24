#!/usr/bin/env node
/**
 * For every flagship, fetch the deployed contract manifest from BOTH
 * mainnet and testnet and compare the frontend-declared user operation
 * surface. Admin/operator helper drift is reported as non-fatal context;
 * only user-facing operation incompatibility fails this read-only probe.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const APPS_DIR = path.join(ROOT, "apps");
const DEFS_DIR = path.join(ROOT, "platform/host-app/public/miniapp-definitions");

const MAINNET_RPC = process.env.NEO_RPC_MAINNET || "https://mainnet2.neo.coz.io:443";
const TESTNET_RPC = process.env.NEO_RPC_TESTNET || "https://testnet1.neo.coz.io:443";

const FLAGSHIPS = [
  "daily-checkin",
  "neo-pay",
  "last-survivor",
  "self-loan",
  "fogplay",
  "gasbox",
  "red-envelope",
];

const TYPE_COMPAT = {
  address: ["Hash160", "ByteArray", "ByteString"],
  amount: ["Integer"],
  any: ["Any", "Void"],
  array: ["Array"],
  boolean: ["Boolean"],
  bytearray: ["ByteArray", "ByteString"],
  bytestring: ["ByteString", "ByteArray"],
  hash160: ["Hash160", "ByteArray", "ByteString"],
  hash256: ["Hash256", "ByteArray", "ByteString"],
  integer: ["Integer"],
  map: ["Map", "InteropInterface", "Any"],
  select: ["String", "Integer", "ByteString", "ByteArray"],
  string: ["String", "ByteArray", "ByteString"],
};

function describeError(err) {
  const parts = [];
  let current = err;
  while (current) {
    const message = current?.message || String(current);
    if (message && !parts.includes(message)) parts.push(message);
    current = current?.cause;
  }
  return parts.join(": ") || "unknown error";
}

async function rpc(url, method, params) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(`${method}: ${data.error.message}`);
      return data.result;
    } catch (err) {
      lastError = err;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw new Error(`${method} ${url}: ${describeError(lastError)}`);
}

function methodKey(m) {
  return `${m.name}/${(m.params || m.parameters || []).length}`;
}

function manifestSig(manifest) {
  const abi = manifest?.abi || {};
  const methods = (abi.methods || [])
    .map((m) => ({
      name: m.name,
      params: (m.parameters || []).map((p) => ({ name: p.name, type: p.type })),
      returntype: m.returntype,
      safe: !!m.safe,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) ||
      (a.params.length - b.params.length));
  const events = (abi.events || [])
    .map((e) => ({
      name: e.name,
      params: (e.parameters || []).map((p) => ({ name: p.name, type: p.type })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { methods, events };
}

function diffSig(a, b, options = {}) {
  const ignoreMethods = options.ignoreMethods || new Set();
  const issues = [];
  const aMethodNames = new Set(a.methods.map(methodKey).filter((m) => !ignoreMethods.has(m)));
  const bMethodNames = new Set(b.methods.map(methodKey).filter((m) => !ignoreMethods.has(m)));
  for (const k of aMethodNames) if (!bMethodNames.has(k)) issues.push(`mainnet has method ${k}, testnet missing`);
  for (const k of bMethodNames) if (!aMethodNames.has(k)) issues.push(`testnet has method ${k}, mainnet missing`);

  const aEventNames = new Set(a.events.map((e) => `${e.name}/${e.params.length}`));
  const bEventNames = new Set(b.events.map((e) => `${e.name}/${e.params.length}`));
  for (const k of aEventNames) if (!bEventNames.has(k)) issues.push(`mainnet has event ${k}, testnet missing`);
  for (const k of bEventNames) if (!aEventNames.has(k)) issues.push(`testnet has event ${k}, mainnet missing`);

  // Same name+arity but different param types or returntype:
  for (const m of a.methods) {
    if (ignoreMethods.has(methodKey(m))) continue;
    const peer = b.methods.find((x) => x.name === m.name && x.params.length === m.params.length);
    if (!peer) continue;
    if (peer.returntype !== m.returntype) {
      issues.push(`${m.name}: returntype differs (mainnet=${m.returntype} testnet=${peer.returntype})`);
    }
    for (let i = 0; i < m.params.length; i++) {
      if (m.params[i].type !== peer.params[i].type) {
        issues.push(`${m.name}#${i} '${m.params[i].name}': type differs (mainnet=${m.params[i].type} testnet=${peer.params[i].type})`);
      }
    }
  }
  return issues;
}

function loadMiniappDef(app) {
  const file = path.join(DEFS_DIR, `${app}.json`);
  if (!fs.existsSync(file)) return { operations: [], missing: true };
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readManifestHashes(app) {
  const f = path.join(APPS_DIR, app, "neo-manifest.json");
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  return {
    mainnet: j?.contracts?.["neo-n3-mainnet"] || "",
    testnet: j?.contracts?.["neo-n3-testnet"] || "",
  };
}

function findOperationMethod(sig, operation) {
  const params = operation.params || [];
  return sig.methods.find((m) => m.name === operation.method && m.params.length === params.length);
}

function checkFrontendCompatibility(network, operation, method) {
  if (!method) return [];
  const issues = [];
  const frontParams = operation.params || [];
  for (let i = 0; i < frontParams.length; i++) {
    const frontend = frontParams[i];
    const contract = method.params[i];
    const allowed = TYPE_COMPAT[String(frontend.type || "").toLowerCase()] || [];
    if (contract.type !== "Any" && !allowed.includes(contract.type)) {
      issues.push({
        network,
        method: operation.method,
        reason: "frontend-param-type-mismatch",
        index: i,
        frontend: `${frontend.name}:${frontend.type}`,
        contract: `${contract.name}:${contract.type}`,
      });
    }
  }
  return issues;
}

function compareUserOperations(app, operations, mainSig, testSig) {
  const issues = [];
  const checked = [];

  for (const operation of operations) {
    const key = `${operation.method}/${(operation.params || []).length}`;
    const mainMethod = findOperationMethod(mainSig, operation);
    const testMethod = findOperationMethod(testSig, operation);

    if (!mainMethod) {
      issues.push({ app, method: key, network: "mainnet", reason: "operation-missing" });
      continue;
    }
    if (!testMethod) {
      issues.push({ app, method: key, network: "testnet", reason: "operation-missing" });
      continue;
    }

    issues.push(...checkFrontendCompatibility("mainnet", operation, mainMethod));
    issues.push(...checkFrontendCompatibility("testnet", operation, testMethod));

    if (mainMethod.returntype !== testMethod.returntype) {
      issues.push({
        app,
        method: key,
        reason: "returntype-diff",
        mainnet: mainMethod.returntype,
        testnet: testMethod.returntype,
      });
    }
    if (mainMethod.safe !== testMethod.safe) {
      issues.push({
        app,
        method: key,
        reason: "safe-flag-diff",
        mainnet: mainMethod.safe,
        testnet: testMethod.safe,
      });
    }
    for (let i = 0; i < mainMethod.params.length; i++) {
      if (mainMethod.params[i].type !== testMethod.params[i].type) {
        issues.push({
          app,
          method: key,
          reason: "param-type-diff",
          index: i,
          mainnet: `${mainMethod.params[i].name}:${mainMethod.params[i].type}`,
          testnet: `${testMethod.params[i].name}:${testMethod.params[i].type}`,
        });
      }
    }

    checked.push(key);
  }

  return { checked, issues };
}

async function checkOne(app) {
  const hashes = readManifestHashes(app);
  if (!hashes.mainnet || !hashes.testnet) {
    return { app, status: "missing-hash", hashes };
  }
  const [mainState, testState] = await Promise.all([
    rpc(MAINNET_RPC, "getcontractstate", [hashes.mainnet]),
    rpc(TESTNET_RPC, "getcontractstate", [hashes.testnet]),
  ]);
  const mainSig = manifestSig(mainState?.manifest);
  const testSig = manifestSig(testState?.manifest);
  const def = loadMiniappDef(app);
  if (def.missing) {
    return {
      app,
      mainnet: { hash: hashes.mainnet, name: mainState?.manifest?.name, methods: mainSig.methods.length, events: mainSig.events.length },
      testnet: { hash: hashes.testnet, name: testState?.manifest?.name, methods: testSig.methods.length, events: testSig.events.length },
      status: "missing-definition",
      issues: [{ app, reason: "missing-frontend-definition" }],
    };
  }
  const operations = Array.isArray(def.operations) ? def.operations : [];
  const userSurface = compareUserOperations(app, operations, mainSig, testSig);
  const nonUserSurfaceIssues = diffSig(mainSig, testSig, { ignoreMethods: new Set(userSurface.checked) });
  return {
    app,
    mainnet: { hash: hashes.mainnet, name: mainState?.manifest?.name, methods: mainSig.methods.length, events: mainSig.events.length },
    testnet: { hash: hashes.testnet, name: testState?.manifest?.name, methods: testSig.methods.length, events: testSig.events.length },
    user_operations_checked: userSurface.checked,
    status: userSurface.issues.length ? "diff" : "pass",
    issues: userSurface.issues,
    non_user_surface_status: nonUserSurfaceIssues.length ? "admin_or_operator_drift" : "aligned",
    non_user_surface_issues: nonUserSurfaceIssues,
  };
}

async function main() {
  const results = [];
  for (const app of FLAGSHIPS) {
    process.stderr.write(`comparing ${app}…\n`);
    try {
      results.push(await checkOne(app));
    } catch (err) {
      results.push({ app, status: "error", error: describeError(err) });
    }
  }
  const failed = results.filter((r) => r.status !== "pass");
  console.log(JSON.stringify({
    mainnet_rpc: MAINNET_RPC,
    testnet_rpc: TESTNET_RPC,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
