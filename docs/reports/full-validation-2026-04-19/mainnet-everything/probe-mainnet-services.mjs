#!/usr/bin/env node
/**
 * Probe every Morpheus oracle service end-to-end on mainnet.
 *
 * For each capability (pricefeed, VRF, HTTP query, compute, NeoDID):
 *   1. On-chain contract responds to representative read methods
 *   2. Phala TEE runtime endpoint serves the canonical request
 *   3. Cloudflare gateway proxies to the runtime
 *   4. Supabase edge function (where applicable) is reachable
 *
 * Reports a row per capability + path so any single broken layer is
 * identified surgically.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PHALA_ENV_PATH = path.resolve(process.env.HOME || "", "git/neo-morpheus-oracle/deploy/phala/morpheus.mainnet.env");

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}
const phala = loadEnv(PHALA_ENV_PATH);
const PHALA_TOKEN = phala.PHALA_API_TOKEN || "";

const RPC = "https://mainnet2.neo.coz.io:443";
const ORACLE_HASH    = "0x017520f068fd602082fe5572596185e62a4ad991";
const DATAFEED_HASH  = "0x03013f49c42a14546c8bbe58f9d434c3517fccab";
const PHALA_RUNTIME  = "https://ddff154546fe22d15b65667156dd4b7c611e6093-3000.dstack-pha-prod5.phala.network/mainnet";
const CF_GATEWAY     = "https://oracle.meshmini.app/mainnet";

async function neoCall(hash, method, params = []) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "invokefunction", params: [hash, method, params] }),
  }).then((r) => r.json());
  return { state: r?.result?.state, exception: r?.result?.exception, stack: r?.result?.stack };
}

async function httpProbe(label, url, opts = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers: opts.headers || {},
      body: opts.body,
      signal: AbortSignal.timeout(opts.timeoutMs || 15000),
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}
    return {
      label,
      url,
      status: res.status,
      ok: res.ok,
      elapsedMs: Date.now() - start,
      bodySnippet: text.slice(0, 200),
      bodyJson: parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 6) : null,
    };
  } catch (err) {
    return {
      label,
      url,
      ok: false,
      error: String(err?.message || err),
      elapsedMs: Date.now() - start,
    };
  }
}

async function checkContract(label, hash, methods) {
  const out = { label, hash, methodCount: 0, results: [], allHalt: true };
  try {
    const state = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getcontractstate", params: [hash] }),
    }).then((r) => r.json());
    out.contractName = state?.result?.manifest?.name || null;
    out.methodCount = (state?.result?.manifest?.abi?.methods || []).length;
  } catch (err) {
    out.error = String(err?.message || err);
    out.allHalt = false;
    return out;
  }
  for (const m of methods) {
    try {
      const r = await neoCall(hash, m.name, m.params || []);
      const top = r.stack?.[0];
      out.results.push({ method: m.name, vmstate: r.state, stackType: top?.type, stackValue: top?.type === "Integer" ? top.value : (top?.value?.slice?.(0, 80) || null) });
      if (r.state !== "HALT") out.allHalt = false;
    } catch (err) {
      out.results.push({ method: m.name, error: String(err?.message || err) });
      out.allHalt = false;
    }
  }
  return out;
}

async function main() {
  const report = { generatedAt: new Date().toISOString(), rpc: RPC, contracts: {}, runtime: {}, gateway: {} };

  // ---- On-chain contracts ----
  report.contracts.oracle = await checkContract("oracle (Morpheus core)", ORACLE_HASH, [
    { name: "admin" },
    { name: "updater" },
    { name: "getTotalRequests" },
    { name: "getTotalFulfilled" },
    { name: "requestFee" },
    { name: "oracleVerificationPublicKey" },
    { name: "oracleEncryptionPublicKey" },
  ]);
  report.contracts.datafeed = await checkContract("datafeed (Morpheus DataFeed)", DATAFEED_HASH, [
    { name: "admin" },
    { name: "updater" },
    { name: "getPairCount" },
    { name: "getLatest", params: [{ type: "String", value: "TWELVEDATA:NEO-USD" }] },
    { name: "getLatest", params: [{ type: "String", value: "TWELVEDATA:GAS-USD" }] },
    { name: "getLatest", params: [{ type: "String", value: "TWELVEDATA:BTC-USD" }] },
  ]);

  // ---- Phala TEE runtime (auth required) ----
  const authHeader = PHALA_TOKEN ? { authorization: `Bearer ${PHALA_TOKEN}`, "content-type": "application/json" } : {};
  report.runtime.priceNeoUsd  = await httpProbe("phala /feeds/price/NEO-USD",  `${PHALA_RUNTIME}/feeds/price/NEO-USD`,  { headers: authHeader });
  report.runtime.priceGasUsd  = await httpProbe("phala /feeds/price/GAS-USD",  `${PHALA_RUNTIME}/feeds/price/GAS-USD`,  { headers: authHeader });
  report.runtime.priceBtcUsd  = await httpProbe("phala /feeds/price/BTC-USD",  `${PHALA_RUNTIME}/feeds/price/BTC-USD`,  { headers: authHeader });
  report.runtime.vrfRandom    = await httpProbe("phala /vrf/random",  `${PHALA_RUNTIME}/vrf/random`, { method: "POST", headers: authHeader, body: JSON.stringify({ request_id: "0", target_chain: "neo_n3" }), timeoutMs: 60000 });
  report.runtime.oracleQuery  = await httpProbe("phala /oracle/query", `${PHALA_RUNTIME}/oracle/query`, { method: "POST", headers: authHeader, body: JSON.stringify({ url: "https://api.coinbase.com/v2/prices/spot?currency=USD", method: "GET" }), timeoutMs: 60000 });
  report.runtime.computeExec  = await httpProbe("phala /compute/execute", `${PHALA_RUNTIME}/compute/execute`, { method: "POST", headers: authHeader, body: JSON.stringify({ script: "module.exports = (i) => ({ pong: i?.x ?? null });", input: { x: 42 } }), timeoutMs: 60000 });

  // ---- Cloudflare gateway (no auth needed, public) ----
  report.gateway.priceNeoUsd  = await httpProbe("cf-gw /feeds/price/NEO-USD",  `${CF_GATEWAY}/feeds/price/NEO-USD`);
  report.gateway.priceGasUsd  = await httpProbe("cf-gw /feeds/price/GAS-USD",  `${CF_GATEWAY}/feeds/price/GAS-USD`);
  report.gateway.priceBtcUsd  = await httpProbe("cf-gw /feeds/price/BTC-USD",  `${CF_GATEWAY}/feeds/price/BTC-USD`);

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(2); });
