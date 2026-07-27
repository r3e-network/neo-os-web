"use strict";

/**
 * Contract-hash resolution for live validators and fuzz suites (MP-W3-05).
 *
 * Resolves a miniapp's deployed contract hash from its source-of-truth
 * manifest (apps/<slug>/neo-manifest.json) instead of hardcoding it in each
 * script, so redeploys (e.g. the 2026-06-05 Withdraw hardening) are picked up
 * automatically.
 *
 * Unlike lib/neo_network.js getManifestContractHash(manifestObject, network),
 * this module takes the app SLUG and does the file read + validation itself.
 *
 * Override env vars (highest precedence first):
 *   CONTRACT_OVERRIDE_<SLUG>  — per-target, e.g. CONTRACT_OVERRIDE_RED_ENVELOPE=0x…
 *   CONTRACT_OVERRIDE         — process-wide; intended for the single-contract
 *                               live validators, applies to every lookup.
 */

const fs = require("fs");
const path = require("path");
const { getNetworkConfig } = require("./neo_network.js");

const { readAppManifest } = require("./app-manifests.cjs");
const DEFAULT_REGISTRY_PATH = path.resolve(__dirname, "..", "..", "config", "contract-hashes.json");
const CONTRACT_HASH_PATTERN = /^0x[0-9a-f]{40}$/;

function normalizeContractHash(value, source) {
  const raw = String(value || "").trim().toLowerCase();
  const prefixed = raw && !raw.startsWith("0x") ? `0x${raw}` : raw;
  if (!CONTRACT_HASH_PATTERN.test(prefixed)) {
    throw new Error(`${source}: invalid contract hash "${value}" (expected 0x + 40 hex chars)`);
  }
  return prefixed;
}

function contractOverrideEnvKey(name) {
  const normalized = String(name || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return `CONTRACT_OVERRIDE_${normalized}`;
}

function resolveOverride(name, env) {
  const perTargetKey = contractOverrideEnvKey(name);
  const perTarget = String(env[perTargetKey] || "").trim();
  if (perTarget) return normalizeContractHash(perTarget, perTargetKey);
  const processWide = String(env.CONTRACT_OVERRIDE || "").trim();
  if (processWide) return normalizeContractHash(processWide, "CONTRACT_OVERRIDE");
  return "";
}

/**
 * Resolve the deployed contract hash for apps/<appSlug>/neo-manifest.json.
 *
 * @param {string} appSlug   directory name under apps/ (e.g. "red-envelope")
 * @param {object} [options]
 * @param {string} [options.network="testnet"]  "testnet" | "mainnet" (or the
 *                 full neo-n3-* key — normalized by lib/neo_network.js)
 * @param {object} [options.env=process.env]    env source for overrides
 * @param {string} [options.appsDir]            alternate apps/ root (tests)
 * @returns {string} normalized lowercase 0x-prefixed contract hash
 */
function getManifestContractHash(appSlug, options = {}) {
  const { network = "testnet", env = process.env } = options;
  const slug = String(appSlug || "").trim();
  if (!slug || /[\\/]/.test(slug)) {
    throw new Error(`invalid app slug "${appSlug}"`);
  }

  const override = resolveOverride(slug, env);
  if (override) return override;

  // The manifest comes from the committed snapshot: the apps live in their own
  // repos and this one keeps a checked copy of what they publish.
  const manifest = readAppManifest(slug);

  const networkKey = getNetworkConfig(network).key;
  const hash = manifest?.contracts?.[networkKey];
  if (!hash) {
    throw new Error(`${slug} has no contracts["${networkKey}"] entry`);
  }
  return normalizeContractHash(hash, `${slug} contracts["${networkKey}"]`);
}

/**
 * Resolve a contract-only smoke target (no apps/<slug>/ manifest exists) from
 * deploy/config/contract-hashes.json. Honors the same CONTRACT_OVERRIDE_<NAME>
 * / CONTRACT_OVERRIDE env convention as getManifestContractHash.
 */
function getRegistryContractHash(registryKey, options = {}) {
  const { env = process.env, registryPath = DEFAULT_REGISTRY_PATH } = options;
  const key = String(registryKey || "").trim();
  if (!key) throw new Error("registry key is required");

  const override = resolveOverride(key, env);
  if (override) return override;

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot read contract registry ${registryPath}: ${message}`);
  }

  const entry = registry[key.toUpperCase()];
  if (!entry) {
    throw new Error(`deploy/config/contract-hashes.json has no "${key.toUpperCase()}" entry`);
  }
  return normalizeContractHash(entry, `deploy/config/contract-hashes.json["${key.toUpperCase()}"]`);
}

module.exports = {
  getManifestContractHash,
  getRegistryContractHash,
  contractOverrideEnvKey,
  normalizeContractHash,
};
