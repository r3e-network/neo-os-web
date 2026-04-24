import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const oracleRoot = path.resolve(repoRoot, '..', 'neo-morpheus-oracle');

async function loadCanonicalModule(moduleName, exportName) {
  const modulePath = path.join(oracleRoot, 'scripts', moduleName);
  const module = await import(pathToFileURL(modulePath).href);
  const loader = module[exportName];

  assert.equal(typeof loader, 'function');
  return loader({ oracleRoot });
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

test(
  'generated Morpheus public registry stays synchronized with the canonical oracle export',
  { skip: !fs.existsSync(oracleRoot) },
  async () => {
    const generatedRegistry = parseGeneratedJsonExport(
      path.join(repoRoot, 'apps/shared/constants/generated-morpheus-registry.ts'),
      'MORPHEUS_PUBLIC_REGISTRY'
    );
    const canonicalRegistry = await loadCanonicalModule(
      'lib-public-network-registry.mjs',
      'loadPublicNetworkRegistry'
    );

    assert.deepEqual(generatedRegistry, canonicalRegistry);
  }
);

test(
  'generated Morpheus runtime catalog stays synchronized with the canonical oracle export',
  { skip: !fs.existsSync(oracleRoot) },
  async () => {
    const generatedCatalog = parseGeneratedJsonExport(
      path.join(repoRoot, 'apps/shared/constants/generated-morpheus-runtime-catalog.ts'),
      'MORPHEUS_PUBLIC_RUNTIME_CATALOG'
    );
    const canonicalCatalog = await loadCanonicalModule(
      'lib-public-runtime-catalog.mjs',
      'loadPublicRuntimeCatalog'
    );

    assert.deepEqual(generatedCatalog, canonicalCatalog);
  }
);
