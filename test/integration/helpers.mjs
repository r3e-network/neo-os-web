/**
 * Shared helpers for cross-repo integration tests.
 *
 * Wraps the existing deploy-script RPC helpers and neo_network config
 * so every test file uses one consistent interface.  All calls are
 * read-only — no transactions are ever broadcast.
 */

import { createRequire } from "node:module";
import path from "node:path";
import url from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..", "..");

// Re-export stack helpers from the existing deploy-scripts lib.
const liveNeo = require("../../deploy/scripts/lib/live_neo.js");
export const { stackValue, stackBytes } = liveNeo;

// Re-export network config.
const {
  getNetworkConfig,
  getTargetNetwork,
  getManifestContractHash,
} = require("../../deploy/scripts/lib/neo_network.js");
export { getNetworkConfig, getTargetNetwork, getManifestContractHash };

// ── Constants ──────────────────────────────────────────────────────────────

const NETWORK = getNetworkConfig("testnet");
export const RPC_URL = NETWORK.rpcUrl;
export const ORACLE_HASH = NETWORK.oracleHash;
export const AA_CORE_HASH =
  process.env.AA_CORE_HASH_TESTNET ||
  "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2";

// Canonical UInt160 zero — 20 zero bytes as a script-hash.
export const UINT160_ZERO = "0x" + "00".repeat(20);

// ── Raw JSON-RPC caller ───────────────────────────────────────────────────

export async function rpcCall(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || `rpc ${method} failed`);
  }
  return data.result;
}

// ── Read-only invoke helpers ──────────────────────────────────────────────

/**
 * invokefunction wrapper — returns the full RPC result object
 * (state, stack[], gasconsumed, …).
 */
export async function invokeRead(contractHash, operation, args = []) {
  return rpcCall("invokefunction", [contractHash, operation, args]);
}

/**
 * getcontractstate wrapper — returns the full contract state including
 * manifest, nef, hash, id, etc.
 */
export async function getContractState(contractHash) {
  return rpcCall("getcontractstate", [contractHash]);
}

// ── Typed param builders (match neo-rpc.mjs conventions) ──────────────────

export function intParam(value) {
  return { type: "Integer", value: String(value) };
}

export function strParam(value) {
  return { type: "String", value };
}

export function hashParam(value) {
  return { type: "Hash160", value: String(value).replace(/^0x/, "") };
}

export function boolParam(value) {
  return { type: "Boolean", value };
}

// ── Convenience extractors ────────────────────────────────────────────────

/** Return true when the VM finished without fault. */
export function isHalt(result) {
  return String(result?.state || "").toUpperCase() === "HALT";
}

/** Extract the first stack item, decoded via stackValue. */
export function firstStack(result) {
  return stackValue(result?.stack?.[0]);
}

/** Parse a stack item that is expected to be a 20-byte script-hash. */
export function stackHash160(item) {
  const bytes = stackBytes(item);
  if (bytes.length === 20) {
    return "0x" + Buffer.from(bytes).reverse().toString("hex");
  }
  return null;
}

/** Read a neo-manifest.json from apps/<slug>. */
export function readManifest(slug) {
  const fs = require("fs");
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, "apps", slug, "neo-manifest.json"), "utf8"),
  );
}
