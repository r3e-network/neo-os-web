#!/usr/bin/env node
/**
 * For every flagship, fetch the deployed contract manifest from BOTH
 * mainnet and testnet and compare the ABI surface (methods + events).
 * Same source compile produces identical hashes/sigs, so a parity-pass
 * means the testnet user-flow proof transfers to mainnet without
 * needing to broadcast txs against the live mainnet contract.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const APPS_DIR = path.join(ROOT, "apps");

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

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`${method}: ${data.error.message}`);
  return data.result;
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

function diffSig(a, b) {
  const issues = [];
  const aMethodNames = new Set(a.methods.map((m) => `${m.name}/${m.params.length}`));
  const bMethodNames = new Set(b.methods.map((m) => `${m.name}/${m.params.length}`));
  for (const k of aMethodNames) if (!bMethodNames.has(k)) issues.push(`mainnet has method ${k}, testnet missing`);
  for (const k of bMethodNames) if (!aMethodNames.has(k)) issues.push(`testnet has method ${k}, mainnet missing`);

  const aEventNames = new Set(a.events.map((e) => `${e.name}/${e.params.length}`));
  const bEventNames = new Set(b.events.map((e) => `${e.name}/${e.params.length}`));
  for (const k of aEventNames) if (!bEventNames.has(k)) issues.push(`mainnet has event ${k}, testnet missing`);
  for (const k of bEventNames) if (!aEventNames.has(k)) issues.push(`testnet has event ${k}, mainnet missing`);

  // Same name+arity but different param types or returntype:
  for (const m of a.methods) {
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

function readManifestHashes(app) {
  const f = path.join(APPS_DIR, app, "neo-manifest.json");
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  return {
    mainnet: j?.contracts?.["neo-n3-mainnet"] || "",
    testnet: j?.contracts?.["neo-n3-testnet"] || "",
  };
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
  const issues = diffSig(mainSig, testSig);
  return {
    app,
    mainnet: { hash: hashes.mainnet, name: mainState?.manifest?.name, methods: mainSig.methods.length, events: mainSig.events.length },
    testnet: { hash: hashes.testnet, name: testState?.manifest?.name, methods: testSig.methods.length, events: testSig.events.length },
    status: issues.length ? "diff" : "pass",
    issues,
  };
}

async function main() {
  const results = [];
  for (const app of FLAGSHIPS) {
    process.stderr.write(`comparing ${app}…\n`);
    try {
      results.push(await checkOne(app));
    } catch (err) {
      results.push({ app, status: "error", error: String(err?.message || err) });
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
