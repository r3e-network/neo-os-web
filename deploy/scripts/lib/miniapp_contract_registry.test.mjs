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
