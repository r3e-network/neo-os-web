/**
 * ABI grounding for the fuzz/sim suites (MP-W3-06).
 *
 * - Contract hashes come from apps/<slug>/neo-manifest.json via
 *   deploy/scripts/lib/miniapp_manifest_hash.js (CONTRACT_OVERRIDE_* aware),
 *   so the suites always target the deployments the apps actually use.
 * - Method lists are validated against the compiled ABI in
 *   contracts/build/<Contract>.manifest.json. Any listed method that does not
 *   exist fails FAST with an "ABI drift" error BEFORE any live invocation.
 * - FUZZ_DRY_RUN=1 (or --dry-run) prints the resolved plan (contract, hash,
 *   methods) and exits 0 without touching the network — the offline CI gate
 *   that proves the suites produce zero method-not-found findings.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(LIB_DIR, "..", "..", "..");
const BUILD_DIR = path.join(ROOT, "contracts", "build");

const { getManifestContractHash } = await import(
  path.join(ROOT, "deploy", "scripts", "lib", "miniapp_manifest_hash.js")
);

/** Parse contracts/build/<contractName>.manifest.json into a method map. */
export function loadBuildAbi(contractName) {
  const manifestPath = path.join(BUILD_DIR, `${contractName}.manifest.json`);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot read compiled ABI ${manifestPath}: ${message}`);
  }
  const methods = new Map();
  for (const method of manifest?.abi?.methods || []) {
    methods.set(method.name, {
      parameters: (method.parameters || []).map((p) => p.type),
      safe: Boolean(method.safe),
      returnType: method.returntype,
    });
  }
  return { name: manifest?.name || contractName, methods };
}

/**
 * Resolve fuzz targets: hash from the app manifest + ABI from the compiled
 * build manifest.
 *
 * @param {Record<string, {appSlug: string, contractName: string}>} specs
 * @param {{network?: string}} [options]
 * @returns {Record<string, {key, appSlug, contractName, hash, abi}>}
 */
export function resolveFuzzTargets(specs, { network = "testnet" } = {}) {
  const targets = {};
  for (const [key, spec] of Object.entries(specs)) {
    targets[key] = {
      key,
      appSlug: spec.appSlug,
      contractName: spec.contractName,
      hash: getManifestContractHash(spec.appSlug, { network }),
      abi: loadBuildAbi(spec.contractName),
    };
  }
  return targets;
}

/**
 * @param {object} targets   from resolveFuzzTargets
 * @param {Array<{contract: string, method: string}>} plannedCalls
 * @returns {string[]} "ABI drift: …" findings (empty when clean)
 */
export function findAbiDrift(targets, plannedCalls) {
  const drift = [];
  const seen = new Set();
  for (const call of plannedCalls) {
    const target = targets[call.contract];
    if (!target) {
      const id = `?:${call.contract}`;
      if (!seen.has(id)) {
        seen.add(id);
        drift.push(`ABI drift: unknown fuzz target "${call.contract}"`);
      }
      continue;
    }
    const id = `${call.contract}.${call.method}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!target.abi.methods.has(call.method)) {
      drift.push(
        `ABI drift: ${target.contractName}.${call.method} is not in ` +
          `contracts/build/${target.contractName}.manifest.json (deployed target ${target.hash})`
      );
    }
  }
  return drift;
}

export function isDryRun(env = process.env, argv = process.argv) {
  return String(env.FUZZ_DRY_RUN || "").trim() === "1" || argv.includes("--dry-run");
}

/**
 * Fail fast on ABI drift (exit 2 before any live invocation); in dry-run mode
 * print the resolved plan and exit 0. Returns normally only when the plan is
 * drift-free and a live run was requested.
 */
export function enforceAbiOrExit(suiteName, targets, plannedCalls, { env = process.env, argv = process.argv } = {}) {
  const drift = findAbiDrift(targets, plannedCalls);
  if (drift.length > 0) {
    console.error(`[${suiteName}] ${drift.length} ABI drift finding(s) — refusing to fuzz a stale target list:`);
    for (const line of drift) console.error(`  ${line}`);
    process.exit(2);
  }

  const methodCount = new Set(plannedCalls.map((c) => `${c.contract}.${c.method}`)).size;
  console.log(
    `[${suiteName}] ABI check ✓ — ${Object.keys(targets).length} contracts, ` +
      `${methodCount} distinct methods all present in contracts/build manifests`
  );

  if (isDryRun(env, argv)) {
    for (const target of Object.values(targets)) {
      const methods = [...new Set(
        plannedCalls.filter((c) => c.contract === target.key).map((c) => c.method)
      )];
      console.log(`  [dry-run] ${target.key} ${target.hash} (${target.contractName}): ${methods.join(", ")}`);
    }
    console.log(`[${suiteName}] dry-run: 0 method-not-found findings; no live invocations performed.`);
    process.exit(0);
  }
}
