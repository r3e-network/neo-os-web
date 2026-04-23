import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const oracleRoot = path.resolve(repoRoot, '..', 'neo-morpheus-oracle');

function runCanonicalExport(scriptName) {
  const scriptPath = path.join(oracleRoot, 'scripts', scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: oracleRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
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
  () => {
    const generatedRegistry = parseGeneratedJsonExport(
      path.join(repoRoot, 'apps/shared/constants/generated-morpheus-registry.ts'),
      'MORPHEUS_PUBLIC_REGISTRY'
    );
    const canonicalRegistry = runCanonicalExport('export-public-network-registry.mjs');

    assert.deepEqual(generatedRegistry, canonicalRegistry);
  }
);

test(
  'generated Morpheus runtime catalog stays synchronized with the canonical oracle export',
  { skip: !fs.existsSync(oracleRoot) },
  () => {
    const generatedCatalog = parseGeneratedJsonExport(
      path.join(repoRoot, 'apps/shared/constants/generated-morpheus-runtime-catalog.ts'),
      'MORPHEUS_PUBLIC_RUNTIME_CATALOG'
    );
    const canonicalCatalog = runCanonicalExport('export-public-runtime-catalog.mjs');

    assert.deepEqual(generatedCatalog, canonicalCatalog);
  }
);
