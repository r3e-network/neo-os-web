#!/usr/bin/env node
/**
 * Cross-check: for every flagship miniapp definition, verify each
 * declared frontend operation matches the live on-chain ABI:
 *   • method exists on the deployed contract
 *   • frontend param count matches contract param count
 *   • frontend param types map to compatible contract types
 *
 * Reads frontend definitions from
 *   platform/host-app/public/miniapp-definitions/*.json
 * and the live ABI from getcontractstate over JSON-RPC.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const DEFS_DIR = path.join(ROOT, "platform/host-app/public/miniapp-definitions");
// The frontend definitions carry a single canonical contract_hash that points
// to the production (mainnet) deployment. Validate against mainnet ABI by
// default; allow testnet via env override for parity checks.
const RPC_MAINNET = process.env.NEO_RPC_MAINNET || "https://mainnet2.neo.coz.io:443";
const RPC_URL = process.env.NEO_RPC_URL || RPC_MAINNET;

// Map definition param "type" → set of acceptable Neo ContractParameterType
// strings the contract may declare. Keep loose: definitions use UI-friendly
// labels (string, integer, hash160, hash256) while contracts may say
// String/Integer/Hash160/ByteArray etc.
const TYPE_COMPAT = {
  hash160: ["Hash160", "ByteArray", "ByteString"],
  hash256: ["Hash256", "ByteArray", "ByteString"],
  string:  ["String", "ByteArray", "ByteString"],
  integer: ["Integer"],
  boolean: ["Boolean"],
  bytearray: ["ByteArray", "ByteString"],
  bytestring: ["ByteString", "ByteArray"],
  array:   ["Array"],
  map:     ["Map", "InteropInterface", "Any"],
  any:     ["Any", "Void"],
  // UI-helper aliases the definition schema accepts (see miniapp-config.schema.json):
  // 'address' is rendered as text but submitted as Hash160; 'amount' is a
  // GAS-style decimal scaled to Integer at invoke time; 'select' is one of
  // string/integer depending on the option list.
  address: ["Hash160", "ByteArray", "ByteString"],
  amount:  ["Integer"],
  select:  ["String", "Integer", "ByteString", "ByteArray"],
};

const FLAGSHIP_DEFS = [
  "daily-checkin.json",
  "neo-pay.json",
  "last-survivor.json",
  "self-loan.json",
  "fogplay.json",
  "gasbox.json",
  "red-envelope.json",
];

async function rpcGetContractState(hash) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getcontractstate",
      params: [hash],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

function loadDefinition(file) {
  const full = path.join(DEFS_DIR, file);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function getContractHash(def) {
  return def?.contract?.contract_hash || "";
}

async function checkDefinition(file) {
  const def = loadDefinition(file);
  const ops = def.operations || [];
  const contractHash = getContractHash(def);
  if (!contractHash || !contractHash.startsWith("0x")) {
    return { file, status: "no-contract-hash", contractHash };
  }

  let abiMethods = [];
  try {
    const state = await rpcGetContractState(contractHash);
    abiMethods = state?.manifest?.abi?.methods || [];
  } catch (err) {
    return { file, status: "abi-fetch-failed", contractHash, error: String(err.message || err) };
  }

  const issues = [];
  const okOps = [];
  const abiByName = new Map();
  for (const m of abiMethods) {
    if (!abiByName.has(m.name)) abiByName.set(m.name, []);
    abiByName.get(m.name).push(m);
  }

  for (const op of ops) {
    const methodName = op.method;
    if (!methodName) {
      issues.push({ method: "(unnamed)", reason: "operation missing method" });
      continue;
    }
    const candidates = abiByName.get(methodName) || [];
    if (candidates.length === 0) {
      issues.push({
        method: methodName,
        reason: "method not present in contract ABI",
        availableMethods: [...abiByName.keys()].slice(0, 25),
      });
      continue;
    }
    const frontParams = op.params || [];
    // Pick the abi candidate whose param count matches the frontend's;
    // contracts can have overloads (rare in NEP-17, but keep flexible).
    let matched = candidates.find((c) => (c.parameters || []).length === frontParams.length);
    if (!matched) {
      issues.push({
        method: methodName,
        reason: "param-count mismatch",
        frontendParams: frontParams.map((p) => `${p.name}:${p.type}`),
        contractCandidates: candidates.map((c) => `(${(c.parameters || []).map((p) => `${p.name}:${p.type}`).join(", ")})`),
      });
      continue;
    }

    const typeIssues = [];
    for (let i = 0; i < frontParams.length; i++) {
      const fp = frontParams[i];
      const cp = matched.parameters[i];
      const allowed = TYPE_COMPAT[String(fp.type || "").toLowerCase()] || [];
      if (!allowed.includes(cp.type) && cp.type !== "Any") {
        typeIssues.push(`#${i} '${fp.name}': frontend=${fp.type} contract=${cp.type}`);
      }
    }
    if (typeIssues.length) {
      issues.push({ method: methodName, reason: "param-type mismatch", details: typeIssues });
      continue;
    }
    okOps.push(methodName);
  }

  return {
    file,
    contractHash,
    status: issues.length ? "fail" : "pass",
    okOps,
    issues,
  };
}

async function main() {
  const results = [];
  for (const f of FLAGSHIP_DEFS) {
    process.stderr.write(`checking ${f}…\n`);
    results.push(await checkDefinition(f));
  }
  const failed = results.filter((r) => r.status !== "pass");
  console.log(JSON.stringify({
    rpc: RPC_URL,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
