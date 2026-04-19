#!/usr/bin/env node
/**
 * Per-app frontend call-site validator.
 *
 * For each app with source code under apps/<name>/src/, grep for live
 * contract invocations (`.invoke("methodName", [...])` or similar) and
 * verify each method exists on the live contract ABI for the target
 * network. Catches the situation where a frontend UI calls an arity
 * that exists on mainnet but not on testnet (or vice versa) — a
 * problem revealed in the prior tier 19 sweep where ~9 apps had user-
 * facing arity drift.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..", "..");
const APPS_DIR = path.join(ROOT, "apps");

const RPC = {
  "neo-n3-mainnet": process.env.NEO_RPC_MAINNET || "https://mainnet2.neo.coz.io:443",
  "neo-n3-testnet": process.env.NEO_RPC_TESTNET || "https://testnet1.neo.coz.io:443",
};

async function getAbiMethods(network, hash) {
  const url = RPC[network];
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getcontractstate", params: [hash] }),
    signal: AbortSignal.timeout(15000),
  }).then((r) => r.json());
  if (r.error) return null;
  return r.result?.manifest?.abi?.methods || [];
}

// Exclude `transfer` — universally called on GAS contract, not the app's
// own contract. False-positive otherwise.
const EXCLUDE_METHODS = new Set(["transfer", "balanceOf", "decimals", "symbol", "totalSupply"]);

function extractInvokeCalls(srcDir) {
  if (!fs.existsSync(srcDir)) return [];
  let files;
  try {
    files = execSync(
      `grep -rl --include="*.ts" --include="*.tsx" --include="*.vue" -E "\\.invoke\\(" ${srcDir} 2>/dev/null || true`,
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    ).split("\n").filter(Boolean);
  } catch {
    return [];
  }
  const seen = new Set();
  for (const file of files) {
    let src;
    try { src = fs.readFileSync(file, "utf8"); } catch { continue; }
    // Strip block comments (/* ... */) and line comments (// ...)
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const re = /\.invoke\s*\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g;
    let m;
    while ((m = re.exec(stripped)) !== null) {
      if (!EXCLUDE_METHODS.has(m[1])) seen.add(m[1]);
    }
  }
  return [...seen].sort();
}

function loadAppManifest(slug) {
  const f = path.join(APPS_DIR, slug, "neo-manifest.json");
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
}

async function checkApp(slug) {
  const manifest = loadAppManifest(slug);
  if (!manifest) return { app: slug, skipped: true, reason: "no-manifest" };
  const contracts = manifest.contracts || {};
  const networks = Object.keys(contracts).filter((n) => contracts[n]);
  if (networks.length === 0) return { app: slug, skipped: true, reason: "no-contract" };

  const srcDir = path.join(APPS_DIR, slug, "src");
  const calls = extractInvokeCalls(srcDir);
  if (calls.length === 0) return { app: slug, skipped: true, reason: "no-invoke-calls" };

  const result = { app: slug, callsFound: calls, networks: {} };
  for (const network of networks) {
    const methods = await getAbiMethods(network, contracts[network]);
    if (!methods) {
      result.networks[network] = { error: "abi-fetch-failed" };
      continue;
    }
    const abiNames = new Set(methods.map((m) => m.name));
    const missing = calls.filter((c) => !abiNames.has(c));
    result.networks[network] = {
      hash: contracts[network],
      abiMethodCount: methods.length,
      missingMethods: missing,
    };
  }
  result.allOk = networks.every((n) => result.networks[n]?.missingMethods?.length === 0);
  return result;
}

async function main() {
  const apps = fs.readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "shared")
    .map((e) => e.name)
    .sort();

  process.stderr.write(`scanning ${apps.length} apps for frontend invoke calls…\n`);
  const results = [];
  for (const slug of apps) {
    process.stderr.write(`  ${slug}…\n`);
    try { results.push(await checkApp(slug)); }
    catch (err) { results.push({ app: slug, error: String(err?.message || err) }); }
  }

  const checked = results.filter((r) => !r.skipped && !r.error);
  const failed  = results.filter((r) => r.allOk === false);
  console.log(JSON.stringify({
    totalApps: results.length,
    checked: checked.length,
    skipped: results.length - checked.length,
    failed: failed.length,
    rpc: RPC,
    results,
  }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
