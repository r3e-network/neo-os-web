import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const generatorPath = path.join(repoRoot, 'scripts/generate-miniapp-contract-registry.mjs');
const generatedPath = path.join(repoRoot, 'apps/shared/constants/generated-miniapp-contracts.ts');

async function loadGenerator() {
  const module = await import(pathToFileURL(generatorPath).href);
  assert.equal(typeof module.buildMiniAppContractRegistry, 'function');
  assert.equal(typeof module.renderGeneratedTs, 'function');
  return module;
}

function parseGeneratedJsonExport(filePath, exportName) {
  const source = fs.readFileSync(filePath, 'utf8');
  const marker = `export const ${exportName} = `;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing export marker for ${exportName}`);

  const afterMarker = source.slice(start + marker.length);
  const asConstMarker = '\n} as const;';
  const end = afterMarker.indexOf(asConstMarker);
  assert.notEqual(end, -1, `missing export terminator for ${exportName}`);

  return JSON.parse(`${afterMarker.slice(0, end + 2)}`);
}

test('generated MINIAPP_CONTRACTS registry stays synchronized with the app manifests', async () => {
  const { buildMiniAppContractRegistry, renderGeneratedTs } = await loadGenerator();

  const canonical = buildMiniAppContractRegistry({ repoRoot });
  const generated = parseGeneratedJsonExport(generatedPath, 'GENERATED_MINIAPP_CONTRACTS');

  // Any hand-edit of the generated file (or a manifest change without a
  // re-run of the generator) diverges from the canonical manifest-built
  // registry and fails here.
  assert.deepEqual(generated, canonical);

  // The full rendered text must match too, so formatting drift is caught.
  assert.equal(fs.readFileSync(generatedPath, 'utf8'), renderGeneratedTs(canonical));
});

test('generated registry entries are well-formed lowercase script hashes', async () => {
  const generated = parseGeneratedJsonExport(generatedPath, 'GENERATED_MINIAPP_CONTRACTS');

  for (const network of ['mainnet', 'testnet']) {
    const entries = Object.entries(generated[network] ?? {});
    assert.ok(entries.length > 0, `${network} registry must not be empty`);
    for (const [appId, hash] of entries) {
      assert.match(appId, /^miniapp-[a-z0-9-]+$/, `unexpected app id key: ${appId}`);
      assert.match(hash, /^0x[0-9a-f]{40}$/, `${network}/${appId} hash must be lowercase 0x + 40 hex`);
    }
  }
});

test('shared rpc constants consume the generated registry (no hand-maintained map)', () => {
  const rpcSource = fs.readFileSync(path.join(repoRoot, 'apps/shared/constants/rpc.ts'), 'utf8');
  assert.ok(
    rpcSource.includes("from './generated-miniapp-contracts'"),
    'rpc.ts must import the generated miniapp contract registry'
  );
  assert.ok(
    rpcSource.includes('GENERATED_MINIAPP_CONTRACTS.mainnet') &&
      rpcSource.includes('GENERATED_MINIAPP_CONTRACTS.testnet'),
    'MINIAPP_CONTRACTS must be built from the generated registry'
  );
});

test('gas-lucky-pool manifest declares its deployed contracts (registry coverage)', async () => {
  const { buildMiniAppContractRegistry } = await loadGenerator();
  const canonical = buildMiniAppContractRegistry({ repoRoot });

  assert.equal(
    canonical.mainnet['miniapp-gas-lucky-pool'],
    '0x5f371cc50116bb13d79554d96ccdd6e246cd5d59'
  );
  assert.equal(
    canonical.testnet['miniapp-gas-lucky-pool'],
    '0xfa1b7240fead2a63999c02defa3aec5eb274a919'
  );
});

// ---------------------------------------------------------------------------
// Contract-address single-source-of-truth drift guard.
//
// The deployed contract for an app is the canonical manifest-built registry
// entry (generated from apps/<app>/neo-manifest.json `contracts`). Two OTHER
// stores historically drifted from it and silently routed reads/writes to a
// dead kernel contract:
//   1. each manifest's `runtime.modules[].networks[net].contract_hash`
//      (both the apps/<app>/neo-manifest.json AND the served
//      public/miniapp-definitions/*.json `manifest.runtime`), and
//   2. the served definitions' `manifest.contracts`.
// These guards fail when either disagrees with the canonical registry, and
// forbid hardcoded contract-hash literals in the host contract-queries map.
// ---------------------------------------------------------------------------

const NETWORK_MANIFEST_KEYS = {
  mainnet: ['neo-n3-mainnet', 'mainnet'],
  testnet: ['neo-n3-testnet', 'testnet'],
};

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeHash(value) {
  return String(value ?? '').trim().toLowerCase();
}

function readNetworkContractHash(contracts, network) {
  const obj = asObject(contracts);
  for (const key of NETWORK_MANIFEST_KEYS[network]) {
    const raw = obj[key];
    if (!raw) continue;
    if (typeof raw === 'string') return normalizeHash(raw);
    const nested = asObject(raw);
    const candidate = nested.contract_hash ?? nested.hash ?? nested.address;
    if (candidate) return normalizeHash(candidate);
  }
  return '';
}

function collectPlatformModuleHashes(manifest, network) {
  const runtime = asObject(asObject(manifest).runtime);
  if (String(runtime.mode ?? '').trim() !== 'platform') return [];
  const modules = Array.isArray(runtime.modules) ? runtime.modules : [];
  const hashes = [];
  for (const rawModule of modules) {
    const networks = asObject(asObject(rawModule).networks);
    const hash = readNetworkContractHash(networks, network);
    if (hash) hashes.push(hash);
  }
  return hashes;
}

test('app manifest platform runtime module hashes equal the canonical registry', async () => {
  const { buildMiniAppContractRegistry } = await loadGenerator();
  const canonical = buildMiniAppContractRegistry({ repoRoot });
  const appsDir = path.join(repoRoot, 'apps');

  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(appsDir, entry.name, 'neo-manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const appId = String(manifest.app_id || manifest.id || '').trim();

    for (const network of ['mainnet', 'testnet']) {
      const registryHash = normalizeHash(canonical[network][appId] || '');
      for (const moduleHash of collectPlatformModuleHashes(manifest, network)) {
        assert.equal(
          moduleHash,
          registryHash,
          `${appId} ${network}: runtime module hash ${moduleHash} != deployed contract ${registryHash || '(none in registry)'} (apps/${entry.name}/neo-manifest.json)`
        );
      }
    }
  }
});

test('served miniapp-definitions contracts/runtime equal the canonical registry', async () => {
  const { buildMiniAppContractRegistry } = await loadGenerator();
  const canonical = buildMiniAppContractRegistry({ repoRoot });
  const definitionsDir = path.join(repoRoot, 'platform/host-app/public/miniapp-definitions');

  for (const fileName of fs.readdirSync(definitionsDir)) {
    if (!fileName.endsWith('.json')) continue;
    if (fileName.endsWith('.schema.json')) continue;
    const def = JSON.parse(fs.readFileSync(path.join(definitionsDir, fileName), 'utf8'));
    const appId = String(def.app_id || '').trim();
    if (!appId) continue;
    const manifest = asObject(def.manifest);
    // Only apps that have a deployed standalone contract in the registry are
    // covered; shared/kernel apps (no registry entry) are skipped.
    for (const network of ['mainnet', 'testnet']) {
      const registryHash = normalizeHash(canonical[network][appId] || '');
      if (!registryHash) continue;

      const manifestContracts = readNetworkContractHash(manifest.contracts, network);
      if (manifestContracts) {
        assert.equal(
          manifestContracts,
          registryHash,
          `${appId} ${network}: served manifest.contracts ${manifestContracts} != deployed ${registryHash} (${fileName})`
        );
      }

      for (const moduleHash of collectPlatformModuleHashes(manifest, network)) {
        assert.equal(
          moduleHash,
          registryHash,
          `${appId} ${network}: served runtime module hash ${moduleHash} != deployed ${registryHash} (${fileName})`
        );
      }
    }
  }
});

test('host contract-queries.ts has no hardcoded contract-hash literals', () => {
  const queriesPath = path.join(repoRoot, 'platform/host-app/lib/chain/contract-queries.ts');
  const source = fs.readFileSync(queriesPath, 'utf8');
  // 0x + 40 hex is a Neo N3 script hash. The flagship contracts must be
  // resolved from the shared registry, never pinned here (the old hardcoded
  // CONTRACTS/TESTNET_CONTRACTS maps had silently gone stale).
  const literals = source.match(/0x[0-9a-fA-F]{40}/g) || [];
  // The PlatformAnchor fallback is intentionally allowed: that shared contract
  // backs several anchor app ids that are not 1:1 with a registry entry.
  const allowed = new Set([
    '0x02beeef6f65c6989a121c0a0e6b23190333edb98',
    '0xeb6b3725d47d0941f36a834bdbd12f1427977604',
  ]);
  const disallowed = literals.filter((hash) => !allowed.has(hash.toLowerCase()));
  assert.deepEqual(
    disallowed,
    [],
    `contract-queries.ts must not pin contract-hash literals (found: ${disallowed.join(', ')})`
  );
});
