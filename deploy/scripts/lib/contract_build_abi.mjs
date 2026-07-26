/**
 * Build-manifest ABI source for the mainnet method verifier.
 *
 * The verifier historically derived its "expected methods" only from each app
 * manifest's `runtime.modules[].operations`. Standalone apps (e.g. red-envelope)
 * ship `runtime: {}`, so the verifier had no operations to check and silently
 * passed — an ABI drift in those contracts would go unnoticed.
 *
 * This module loads COMMITTED contract build manifests from the platform repo
 * and any explicitly supplied canonical sibling build directories. It exposes,
 * per deployed contract name, the set of SAFE method signatures the compiled
 * contract is expected to publish. The verifier then asserts the live ABI still
 * exposes every committed safe method, and FAILS for any contract-backed app
 * with no resolvable method source instead of passing on an empty check.
 *
 * Pure / RPC-free so it can be unit-tested in isolation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root: deploy/scripts/lib -> ../../.. */
export function defaultRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

export function buildManifestDir(repoRoot = defaultRepoRoot()) {
  return path.join(repoRoot, "contracts", "build");
}

/** Stable signature key matching the verifier's abiMethodKey: name + arity. */
export function abiMethodSignature(method) {
  const params = Array.isArray(method?.parameters) ? method.parameters.length : 0;
  return `${method?.name}/${params}`;
}

/**
 * Map every committed build manifest's contract name -> its ABI method set.
 * Returns { byName: Map<name, { manifestFile, methods, safeMethods, safeSignatures }> }.
 * `safeMethods` is the list of safe method names; `safeSignatures` is the set of
 * `name/arity` keys. Throws on an unreadable/invalid build manifest so a corrupt
 * artifact is surfaced rather than skipped.
 */
export function loadBuildManifestAbis({ repoRoot = defaultRepoRoot(), additionalDirs = [] } = {}) {
  const byName = new Map();
  const directories = [buildManifestDir(repoRoot), ...additionalDirs]
    .map((dir) => path.resolve(String(dir || "")))
    .filter((dir, index, list) => dir && list.indexOf(dir) === index);

  for (const dir of directories) {
    if (!fs.existsSync(dir)) continue;
    for (const fileName of fs.readdirSync(dir).sort()) {
      if (!fileName.endsWith(".manifest.json")) continue;
      const filePath = path.join(dir, fileName);
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (error) {
        throw new Error(`invalid build manifest ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
      }
      const name = String(manifest?.name || "").trim();
      if (!name || byName.has(name)) continue;
      const methods = Array.isArray(manifest?.abi?.methods) ? manifest.abi.methods : [];
      const safeMethods = methods.filter((method) => method?.safe === true);
      byName.set(name, {
        manifestFile: fileName,
        manifestPath: filePath,
        methods,
        safeMethods: safeMethods.map((method) => String(method.name)),
        safeSignatures: new Set(safeMethods.map((method) => abiMethodSignature(method))),
      });
    }
  }
  return { byName };
}

/**
 * Resolve the committed expected-method source for a deployed contract.
 *
 * `deployedContractName` comes from the live ABI (state.manifest.name); the
 * build manifest with the same `name` is the source of truth for the safe ABI.
 * Returns null when no committed build manifest publishes that name, so the
 * caller can treat a contract-backed app with no method source as a blocker.
 */
export function resolveExpectedMethods(deployedContractName, abis) {
  const name = String(deployedContractName || "").trim();
  if (!name) return null;
  const entry = abis.byName.get(name);
  if (!entry) return null;
  return {
    contractName: name,
    manifestFile: entry.manifestFile,
    manifestPath: entry.manifestPath || null,
    safeMethods: entry.safeMethods,
    safeSignatures: entry.safeSignatures,
  };
}

/**
 * Given a live ABI method list and the committed expected source, return the
 * safe method names the deployed contract is missing (drift). The match is by
 * name (a deployed method that adds parameters but keeps the name still
 * satisfies callers that reference it by name) — this keeps the check focused on
 * "the safe surface the frontends rely on is still published".
 */
export function findMissingSafeMethods(liveMethods, expected) {
  if (!expected) return [];
  const liveNames = new Set(
    (Array.isArray(liveMethods) ? liveMethods : []).map((method) => String(method?.name)),
  );
  return expected.safeMethods.filter((name) => !liveNames.has(name));
}
