#!/usr/bin/env node
/**
 * Generate the MINIAPP_CONTRACTS registry from the per-app neo-manifest.json
 * files (the canonical source of truth for deployed contract hashes).
 *
 * Emits apps/shared/constants/generated-miniapp-contracts.ts following the
 * generated-morpheus-registry pattern in the same directory. Run after any
 * app manifest's `contracts` entry changes:
 *
 *   node scripts/generate-miniapp-contract-registry.mjs
 *
 * The drift guard (deploy/scripts/lib/miniapp_contract_registry.test.mjs)
 * fails when the checked-in generated file diverges from the manifests.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_HASH_RE = /^0x[0-9a-fA-F]{40}$/;

/** Networks the registry covers, keyed by the manifest contracts entry. */
const NETWORK_MANIFEST_KEYS = {
  mainnet: ['neo-n3-mainnet', 'mainnet'],
  testnet: ['neo-n3-testnet', 'testnet'],
};

export function defaultRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

/**
 * Build { mainnet: { appId: hash }, testnet: { appId: hash } } from every
 * apps/<dir>/neo-manifest.json that declares a Neo N3 contract hash. Keys are
 * sorted for deterministic output; values are normalized to lowercase.
 */
export function buildMiniAppContractRegistry({ repoRoot = defaultRepoRoot() } = {}) {
  const appsDir = path.join(repoRoot, 'apps');
  const registry = { mainnet: {}, testnet: {} };
  const seenIds = new Set();

  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(appsDir, entry.name, 'neo-manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const appId = String(manifest.app_id || manifest.id || '').trim();
    if (!appId) {
      throw new Error(`Manifest missing id: ${manifestPath}`);
    }
    if (seenIds.has(appId)) {
      throw new Error(`Duplicate miniapp id "${appId}" (second copy in ${manifestPath})`);
    }
    seenIds.add(appId);

    const contracts = manifest.contracts ?? {};
    for (const [network, keys] of Object.entries(NETWORK_MANIFEST_KEYS)) {
      const raw = keys.map((key) => contracts[key]).find((value) => Boolean(value));
      if (!raw) continue;
      const hash = String(raw).trim();
      if (!SCRIPT_HASH_RE.test(hash)) {
        throw new Error(
          `Invalid ${network} contract hash "${hash}" for ${appId} in ${manifestPath}`
        );
      }
      registry[network][appId] = hash.toLowerCase();
    }
  }

  return {
    mainnet: sortByKey(registry.mainnet),
    testnet: sortByKey(registry.testnet),
  };
}

function sortByKey(record) {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

export function renderGeneratedTs(registry) {
  return [
    '/* eslint-disable */',
    '// Generated from scripts/generate-miniapp-contract-registry.mjs.',
    '// Do not edit manually; the per-app neo-manifest.json files are the source',
    '// of truth — re-run the generator after changing any manifest contracts.',
    '',
    `export const GENERATED_MINIAPP_CONTRACTS = ${JSON.stringify(registry, null, 2)} as const;`,
    '',
    'export type GeneratedMiniAppContracts = typeof GENERATED_MINIAPP_CONTRACTS;',
    '',
  ].join('\n');
}

export function generatedTargetPath(repoRoot = defaultRepoRoot()) {
  return path.join(repoRoot, 'apps/shared/constants/generated-miniapp-contracts.ts');
}

function main() {
  const repoRoot = defaultRepoRoot();
  const registry = buildMiniAppContractRegistry({ repoRoot });
  const targetPath = generatedTargetPath(repoRoot);
  fs.writeFileSync(targetPath, renderGeneratedTs(registry), 'utf8');
  const counts = `mainnet=${Object.keys(registry.mainnet).length}, testnet=${Object.keys(registry.testnet).length}`;
  console.log(`Generated ${path.relative(repoRoot, targetPath)} (${counts})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
