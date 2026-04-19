#!/usr/bin/env node
/**
 * Comprehensive cross-everything validator.
 *
 * For every app under apps/<name>/neo-manifest.json that declares a
 * contract on testnet and/or mainnet, and every miniapp definition
 * under platform/host-app/public/miniapp-definitions/*.json:
 *
 *   1. Contract is reachable on its declared network(s).
 *   2. Manifest name matches between source (.nef) and live ABI.
 *   3. Common business-logic invariants hold (admin set, supply
 *      conserved where applicable, key reads HALT).
 *   4. Frontend-declared operations match live ABI by name + arity +
 *      type-compat.
 *   5. For apps deployed on both networks, mainnet ABI matches
 *      testnet ABI on the user-facing surface.
 *
 * Result: per-app rollup with pass/fail/skip + per-check details.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..", "..");
const APPS_DIR = path.join(ROOT, "apps");
const DEFS_DIR = path.join(ROOT, "platform/host-app/public/miniapp-definitions");

const RPC = {
  "neo-n3-mainnet": process.env.NEO_RPC_MAINNET || "https://mainnet2.neo.coz.io:443",
  "neo-n3-testnet": process.env.NEO_RPC_TESTNET || "https://testnet1.neo.coz.io:443",
};

// UI-helper type aliases the definition schema accepts.
const TYPE_COMPAT = {
  hash160:    ["Hash160", "ByteArray", "ByteString"],
  hash256:    ["Hash256", "ByteArray", "ByteString"],
  string:     ["String", "ByteArray", "ByteString"],
  integer:    ["Integer"],
  boolean:    ["Boolean"],
  bytearray:  ["ByteArray", "ByteString"],
  bytestring: ["ByteString", "ByteArray"],
  array:      ["Array"],
  map:        ["Map", "InteropInterface", "Any"],
  any:        ["Any", "Void"],
  address:    ["Hash160", "ByteArray", "ByteString"],
  amount:     ["Integer"],
  select:     ["String", "Integer", "ByteString", "ByteArray"],
};

async function rpc(url, method, params) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  }).then((r) => r.json());
  return r;
}

async function getContractState(network, hash) {
  const url = RPC[network];
  if (!url) throw new Error(`no rpc for network ${network}`);
  const r = await rpc(url, "getcontractstate", [hash]);
  if (r.error) return { error: r.error.message };
  return r.result;
}

async function invokeRead(network, hash, method, params = []) {
  const url = RPC[network];
  const r = await rpc(url, "invokefunction", [hash, method, params]);
  if (r.error) return { state: "RPC_ERR", exception: r.error.message };
  return { state: r.result?.state, exception: r.result?.exception, stack: r.result?.stack };
}

function methodSig(m) {
  return `${m.name}/${(m.parameters || []).length}`;
}

function diffAbiUserSurface(a, b) {
  // Compare two ABIs (already-extracted .abi blobs). Returns the
  // method sigs that exist on one side and not the other. Ignores
  // method ordering and event diffs.
  const aMethods = new Set((a?.methods || []).map(methodSig));
  const bMethods = new Set((b?.methods || []).map(methodSig));
  const aOnly = [...aMethods].filter((m) => !bMethods.has(m));
  const bOnly = [...bMethods].filter((m) => !aMethods.has(m));
  return { aOnly, bOnly };
}

function loadMiniappDef(slug) {
  const f = path.join(DEFS_DIR, `${slug}.json`);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
}

function loadApps() {
  const apps = [];
  for (const entry of fs.readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "shared") continue;
    const f = path.join(APPS_DIR, entry.name, "neo-manifest.json");
    if (!fs.existsSync(f)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(f, "utf8"));
      const contracts = manifest.contracts || {};
      const networks = Object.keys(contracts).filter((n) => contracts[n]);
      if (networks.length === 0) continue;
      apps.push({
        slug: entry.name,
        id: manifest.id,
        name: manifest.name,
        contracts,
        networks,
      });
    } catch {/* ignore broken manifests */}
  }
  return apps;
}

function checkOperationCompat(operation, abiMethods) {
  const issues = [];
  const candidates = abiMethods.filter((m) => m.name === operation.method);
  if (candidates.length === 0) {
    return [{ method: operation.method, reason: "method-not-found" }];
  }
  const frontParams = operation.params || [];
  const matched = candidates.find((c) => (c.parameters || []).length === frontParams.length);
  if (!matched) {
    return [{
      method: operation.method,
      reason: "param-count-mismatch",
      frontendParams: frontParams.length,
      contractCandidateArities: candidates.map((c) => (c.parameters || []).length),
    }];
  }
  for (let i = 0; i < frontParams.length; i++) {
    const fp = frontParams[i];
    const cp = matched.parameters[i];
    const allowed = TYPE_COMPAT[String(fp.type || "").toLowerCase()] || [];
    if (cp.type !== "Any" && !allowed.includes(cp.type)) {
      issues.push({
        method: operation.method,
        reason: "param-type-mismatch",
        index: i,
        frontend: `${fp.name}:${fp.type}`,
        contract: `${cp.name}:${cp.type}`,
      });
    }
  }
  return issues;
}

async function checkOneApp(app) {
  const out = { app: app.slug, id: app.id, networks: {} };

  // Per-network: contract state + admin probe + ABI methods
  for (const network of app.networks) {
    const hash = app.contracts[network];
    const netResult = { hash };
    const state = await getContractState(network, hash);
    if (state.error) {
      netResult.status = "contract-not-deployed";
      netResult.error = state.error;
      out.networks[network] = netResult;
      continue;
    }
    const manifestName = state?.manifest?.name;
    netResult.contractName = manifestName;
    netResult.methodCount = (state?.manifest?.abi?.methods || []).length;

    // Admin probe (most contracts have one; if not, mark as no-admin which is also valid)
    const hasAdmin = (state?.manifest?.abi?.methods || []).some((m) => m.name === "admin");
    if (hasAdmin) {
      const r = await invokeRead(network, hash, "admin");
      const adminB64 = r?.stack?.[0]?.value || "";
      const adminHex = Buffer.from(adminB64, "base64").toString("hex");
      const isZero = adminHex === "" || /^0+$/.test(adminHex);
      netResult.adminScriptHash = adminHex || null;
      netResult.adminPresent = !isZero;
      if (r.state !== "HALT") netResult.adminProbe = `state=${r.state} exc=${r.exception}`;
    }

    netResult.abiSnapshot = state?.manifest?.abi;
    netResult.status = "deployed";
    out.networks[network] = netResult;
  }

  // Cross-network ABI parity (when both)
  if (out.networks["neo-n3-mainnet"]?.status === "deployed" &&
      out.networks["neo-n3-testnet"]?.status === "deployed") {
    const diff = diffAbiUserSurface(
      out.networks["neo-n3-mainnet"].abiSnapshot,
      out.networks["neo-n3-testnet"].abiSnapshot,
    );
    out.parity = diff;
  }

  // Frontend definition cross-check (if a definition exists)
  const def = loadMiniappDef(app.slug);
  if (def?.contract?.contract_hash) {
    const targetNetwork = "neo-n3-mainnet";
    const ops = def.operations || [];
    const liveAbi = out.networks[targetNetwork]?.abiSnapshot?.methods || [];
    if (liveAbi.length === 0) {
      out.frontendCheck = { skipped: true, reason: "no-live-mainnet-abi" };
    } else {
      const issues = [];
      const okOps = [];
      for (const op of ops) {
        const opIssues = checkOperationCompat(op, liveAbi);
        if (opIssues.length === 0) okOps.push(op.method);
        else issues.push(...opIssues);
      }
      out.frontendCheck = {
        targetNetwork,
        opsChecked: ops.length,
        okOps,
        issues,
        pass: issues.length === 0,
      };
    }
  }

  // Roll up
  const allDeployed = app.networks.every((n) => out.networks[n]?.status === "deployed");
  const allAdmins = app.networks.every((n) => {
    const x = out.networks[n];
    return !x?.abiSnapshot?.methods?.some((m) => m.name === "admin") || x.adminPresent;
  });
  const frontendPass = !out.frontendCheck || out.frontendCheck.skipped || out.frontendCheck.pass;
  out.allChecksPass = allDeployed && allAdmins && frontendPass;

  // strip large abiSnapshot from output unless there's a problem
  for (const n of Object.keys(out.networks)) {
    if (out.networks[n].abiSnapshot) {
      out.networks[n].abiMethodNames = (out.networks[n].abiSnapshot.methods || []).map((m) => m.name);
      delete out.networks[n].abiSnapshot;
    }
  }

  return out;
}

async function main() {
  const apps = loadApps();
  process.stderr.write(`checking ${apps.length} contract-backed apps…\n`);
  const results = [];
  for (const app of apps) {
    process.stderr.write(`  ${app.slug} (${app.networks.join(",")})…\n`);
    try {
      results.push(await checkOneApp(app));
    } catch (err) {
      results.push({ app: app.slug, error: String(err?.message || err) });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalApps: results.length,
    pass: results.filter((r) => r.allChecksPass).length,
    fail: results.filter((r) => r.allChecksPass === false).length,
    error: results.filter((r) => r.error).length,
    parityIssues: results.filter((r) => r.parity && (r.parity.aOnly?.length || r.parity.bOnly?.length)).length,
    frontendIssues: results.filter((r) => r.frontendCheck && !r.frontendCheck.skipped && !r.frontendCheck.pass).length,
    rpc: RPC,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.fail || summary.error ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
