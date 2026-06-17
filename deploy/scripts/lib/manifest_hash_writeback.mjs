/**
 * Post-deploy manifest hash writeback.
 *
 * A successful contract deploy prints a hash but historically required a manual
 * edit of the owning app's neo-manifest.json (the documented drift source). This
 * module writes the deployed hash into the matching app manifest's network-scoped
 * contract field (and any platform runtime module's networks[net].contract_hash,
 * so the registry drift guard stays green), then the deploy scripts re-run the
 * registry generator.
 *
 * Idempotent: writing a hash that already matches is a no-op (returns
 * changed:false and never rewrites the file), so re-deploying the same hash does
 * not churn the working tree.
 *
 * Pure filesystem helpers (no RPC, no neon-js) so they can be unit-tested in
 * isolation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root: deploy/scripts/lib -> ../../.. */
export function defaultRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

/** Network key aliases that an app manifest may use for a given network. */
export const NETWORK_CONTRACT_KEYS = {
  mainnet: ["neo-n3-mainnet", "mainnet"],
  testnet: ["neo-n3-testnet", "testnet"],
};

function normalizeHash(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  return lower.startsWith("0x") ? lower : `0x${lower}`;
}

function isScriptHash(value) {
  return /^0x[0-9a-f]{40}$/.test(normalizeHash(value));
}

/** Read an app manifest; throws (rather than skipping) on malformed JSON. */
function readManifest(manifestPath) {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(
      `cannot read manifest ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Serialize a manifest preserving the repo convention (2-space indent + trailing
 * newline). Returns true if the file content actually changed.
 */
function writeManifestIfChanged(manifestPath, manifest) {
  const next = `${JSON.stringify(manifest, null, 2)}\n`;
  const current = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, "utf8") : "";
  if (current === next) return false;
  fs.writeFileSync(manifestPath, next, "utf8");
  return true;
}

/** Resolve the existing network-scoped contract hash declared by a manifest. */
export function readManifestContractHash(manifest, network) {
  const keys = NETWORK_CONTRACT_KEYS[network];
  if (!keys) throw new Error(`unknown network: ${network}`);
  const contracts = manifest?.contracts && typeof manifest.contracts === "object" ? manifest.contracts : {};
  for (const key of keys) {
    if (contracts[key]) return normalizeHash(contracts[key]);
  }
  return "";
}

/**
 * Apply the deployed hash to a single manifest object in memory.
 *
 * Updates the network-scoped `contracts` field (preferring an existing key,
 * else the canonical `neo-n3-<network>` key) and every platform runtime module's
 * `networks[net].contract_hash` (only ones that already carry a hash, to avoid
 * inventing module networks). Returns the list of field paths actually mutated.
 */
export function applyHashToManifest(manifest, network, hash) {
  const keys = NETWORK_CONTRACT_KEYS[network];
  if (!keys) throw new Error(`unknown network: ${network}`);
  const normalized = normalizeHash(hash);
  if (!isScriptHash(normalized)) throw new Error(`invalid script hash: ${hash}`);

  const changes = [];
  if (!manifest.contracts || typeof manifest.contracts !== "object") manifest.contracts = {};

  const existingKey = keys.find((key) => manifest.contracts[key]);
  const targetKey = existingKey || keys[0];
  if (normalizeHash(manifest.contracts[targetKey]) !== normalized) {
    manifest.contracts[targetKey] = normalized;
    changes.push(`contracts.${targetKey}`);
  }

  const runtime = manifest.runtime && typeof manifest.runtime === "object" ? manifest.runtime : null;
  const modules = runtime && Array.isArray(runtime.modules) ? runtime.modules : [];
  modules.forEach((module, moduleIndex) => {
    const networks = module?.networks && typeof module.networks === "object" ? module.networks : null;
    if (!networks) return;
    for (const key of keys) {
      const net = networks[key];
      if (!net || typeof net !== "object") continue;
      if (!("contract_hash" in net)) continue;
      if (normalizeHash(net.contract_hash) !== normalized) {
        net.contract_hash = normalized;
        changes.push(`runtime.modules[${moduleIndex}].networks.${key}.contract_hash`);
      }
    }
  });

  return changes;
}

/**
 * Enumerate the apps whose manifest the deploy should write the hash into.
 *
 * Selection (any match is included):
 *   - explicit ids/slugs (from --app flags or MINIAPP_DEPLOY_APP_IDS), or
 *   - apps that already declare this exact hash on the deploy network (idempotent
 *     re-deploys / replacements of a known contract).
 *
 * Returns the matched app entries with their manifest path; throws when an
 * explicit id/slug does not resolve to a manifest.
 */
export function selectTargetApps({
  repoRoot = defaultRepoRoot(),
  network,
  hash,
  explicitTargets = [],
} = {}) {
  if (!NETWORK_CONTRACT_KEYS[network]) throw new Error(`unknown network: ${network}`);
  const normalized = normalizeHash(hash);
  const appsDir = path.join(repoRoot, "apps");
  if (!fs.existsSync(appsDir)) return [];

  const wanted = new Set(explicitTargets.map((value) => String(value).trim()).filter(Boolean));
  const all = [];
  for (const slug of fs.readdirSync(appsDir).sort()) {
    if (slug === "shared") continue;
    const manifestPath = path.join(appsDir, slug, "neo-manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = readManifest(manifestPath);
    const appId = String(manifest.id || manifest.app_id || "").trim();
    all.push({ slug, appId, manifestPath, manifest });
  }

  const resolvedExplicit = new Set();
  const selected = [];
  const seenPaths = new Set();
  for (const app of all) {
    const matchesExplicit = wanted.has(app.slug) || (app.appId && wanted.has(app.appId));
    const matchesHash =
      isScriptHash(normalized) && readManifestContractHash(app.manifest, network) === normalized;
    if (matchesExplicit) {
      resolvedExplicit.add(app.slug);
      if (app.appId) resolvedExplicit.add(app.appId);
    }
    if ((matchesExplicit || matchesHash) && !seenPaths.has(app.manifestPath)) {
      seenPaths.add(app.manifestPath);
      selected.push(app);
    }
  }

  const unresolved = [...wanted].filter((value) => !resolvedExplicit.has(value));
  if (unresolved.length > 0) {
    throw new Error(`unknown app id/slug(s): ${unresolved.join(", ")}`);
  }

  return selected;
}

/**
 * Write the deployed hash into all selected apps' manifests. Idempotent.
 * Returns a report: { network, hash, written: [{slug, manifestPath, changes}],
 * unchanged: [slug], targets: number }.
 */
export function writebackDeployedHash({
  repoRoot = defaultRepoRoot(),
  network,
  hash,
  explicitTargets = [],
} = {}) {
  const normalized = normalizeHash(hash);
  if (!isScriptHash(normalized)) throw new Error(`invalid script hash: ${hash}`);

  const targets = selectTargetApps({ repoRoot, network, hash: normalized, explicitTargets });
  const written = [];
  const unchanged = [];
  for (const app of targets) {
    const changes = applyHashToManifest(app.manifest, network, normalized);
    if (changes.length === 0) {
      unchanged.push(app.slug);
      continue;
    }
    const didWrite = writeManifestIfChanged(app.manifestPath, app.manifest);
    if (didWrite) {
      written.push({ slug: app.slug, manifestPath: app.manifestPath, changes });
    } else {
      unchanged.push(app.slug);
    }
  }

  return {
    network,
    hash: normalized,
    targets: targets.length,
    written,
    unchanged,
  };
}
