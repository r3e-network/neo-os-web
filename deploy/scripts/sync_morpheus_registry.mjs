#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const defaultOracleRoot = path.resolve(repoRoot, '..', 'neo-morpheus-oracle');
const oracleRoot = process.env.MORPHEUS_ORACLE_ROOT
  ? path.resolve(process.env.MORPHEUS_ORACLE_ROOT)
  : defaultOracleRoot;

// Confidential-envelope drift guard. The canonical client implementation
// lives in the oracle workspace; this repo vendors a browser copy in
// apps/shared/utils/morpheus-confidential-envelope.ts. When the canonical
// file changes, its hash changes and this sync fails until the vendored
// copy is re-verified (apps/shared/test/morpheus-confidential-envelope.test.ts)
// and the pin below is updated.
const CANONICAL_ENVELOPE_RELATIVE_PATH = 'packages/shared/src/confidential-envelope.js';
const CANONICAL_ENVELOPE_SHA256 =
  '33fd895327ad670b1fa1119396c865afa98bbd7ab773fc2ca115b49114beb943';
const LOCAL_ENVELOPE_RELATIVE_PATH = 'apps/shared/utils/morpheus-confidential-envelope.ts';

async function loadOracleModule(moduleName, exportName) {
  const modulePath = path.join(oracleRoot, 'scripts', moduleName);
  if (!fs.existsSync(modulePath)) {
    throw new Error(`Missing canonical module: ${modulePath}`);
  }

  const module = await import(pathToFileURL(modulePath).href);
  const loader = module[exportName];
  if (typeof loader !== 'function') {
    throw new Error(`Missing export ${exportName} in ${modulePath}`);
  }

  return loader({ oracleRoot });
}

function writeGeneratedTs(targetPath, exportName, typeName, value, commentLine, options = {}) {
  const body = [
    ...(options.eslintDisable === false ? [] : ['/* eslint-disable */']),
    commentLine,
    '// Do not edit manually; re-export from the Morpheus canonical oracle workspace.',
    '',
    `export const ${exportName} = ${JSON.stringify(value, null, 2)} as const;`,
    '',
    `export type ${typeName} = typeof ${exportName};`,
    '',
  ].join('\n');

  fs.writeFileSync(targetPath, body, 'utf8');
}

function loadPublicSignerRegistry() {
  const signerPath = path.join(oracleRoot, 'config', 'signer-identities.json');
  if (!fs.existsSync(signerPath)) {
    throw new Error(`Missing canonical signer registry: ${signerPath}`);
  }
  const source = JSON.parse(fs.readFileSync(signerPath, 'utf8'));
  const result = {};
  for (const network of ['mainnet', 'testnet']) {
    const roles = source?.neo_n3?.[network]?.roles ?? {};
    const role = (name) => {
      const value = roles[name] ?? {};
      const publicKey = String(value.public_key ?? '').trim().toLowerCase();
      if (!/^(02|03)[0-9a-f]{64}$/.test(publicKey)) {
        throw new Error(`Invalid ${network} ${name} public key in ${signerPath}`);
      }
      return {
        address: String(value.address ?? '').trim(),
        scriptHash: String(value.script_hash ?? '').trim().toLowerCase(),
        publicKey,
      };
    };
    result[network] = {
      worker: role('worker'),
      oracleVerifier: role('oracle_verifier'),
    };
  }
  return result;
}

async function assertConfidentialEnvelopeParity() {
  const canonicalPath = path.join(oracleRoot, CANONICAL_ENVELOPE_RELATIVE_PATH);
  if (!fs.existsSync(canonicalPath)) {
    throw new Error(`Missing canonical module: ${canonicalPath}`);
  }

  const canonicalSha256 = createHash('sha256').update(fs.readFileSync(canonicalPath)).digest('hex');
  if (canonicalSha256 !== CANONICAL_ENVELOPE_SHA256) {
    throw new Error(
      [
        `Canonical confidential envelope drift detected: ${canonicalPath}`,
        `expected sha256 ${CANONICAL_ENVELOPE_SHA256}`,
        `actual   sha256 ${canonicalSha256}`,
        `Re-verify ${LOCAL_ENVELOPE_RELATIVE_PATH} against the canonical implementation,`,
        'run `npx vitest run test/morpheus-confidential-envelope.test.ts` in apps/shared,',
        'then update CANONICAL_ENVELOPE_SHA256 in this script.',
      ].join('\n')
    );
  }

  const canonical = await import(pathToFileURL(canonicalPath).href);
  const localPath = path.join(repoRoot, LOCAL_ENVELOPE_RELATIVE_PATH);
  if (!fs.existsSync(localPath)) {
    throw new Error(`Missing vendored envelope copy: ${localPath}`);
  }
  const localSource = fs.readFileSync(localPath, 'utf8');
  const requiredPins = [
    { name: 'ENVELOPE_INFO', test: localSource.includes(canonical.CONFIDENTIAL_ENVELOPE_INFO) },
    {
      name: 'ENVELOPE_ALGORITHM',
      test: localSource.includes(canonical.CONFIDENTIAL_ENVELOPE_ALGORITHM),
    },
    {
      name: 'ENVELOPE_VERSION',
      test: new RegExp(
        `ENVELOPE_VERSION\\s*=\\s*${canonical.CONFIDENTIAL_ENVELOPE_VERSION}\\b`
      ).test(localSource),
    },
    {
      name: 'AES_GCM_TAG_LENGTH_BYTES',
      test: new RegExp(
        `AES_GCM_TAG_LENGTH_BYTES\\s*=\\s*${canonical.AES_GCM_TAG_LENGTH_BYTES}\\b`
      ).test(localSource),
    },
  ];
  const missing = requiredPins.filter((pin) => !pin.test).map((pin) => pin.name);
  if (missing.length > 0) {
    throw new Error(
      `Vendored envelope copy ${LOCAL_ENVELOPE_RELATIVE_PATH} drifted from canonical literals: ${missing.join(', ')}`
    );
  }
}

async function main() {
  await assertConfidentialEnvelopeParity();

  const registry = await loadOracleModule('lib-public-network-registry.mjs', 'loadPublicNetworkRegistry');
  const catalog = await loadOracleModule('lib-public-runtime-catalog.mjs', 'loadPublicRuntimeCatalog');
  const signers = loadPublicSignerRegistry();

  writeGeneratedTs(
    path.join(repoRoot, 'apps/shared/constants/generated-morpheus-registry.ts'),
    'MORPHEUS_PUBLIC_REGISTRY',
    'MorpheusPublicRegistry',
    registry,
    '// Generated from neo-morpheus-oracle/scripts/export-public-network-registry.mjs.'
  );

  writeGeneratedTs(
    path.join(repoRoot, 'apps/shared/constants/generated-morpheus-runtime-catalog.ts'),
    'MORPHEUS_PUBLIC_RUNTIME_CATALOG',
    'MorpheusPublicRuntimeCatalog',
    catalog,
    '// Generated from neo-morpheus-oracle/scripts/export-public-runtime-catalog.mjs.'
  );

  writeGeneratedTs(
    path.join(repoRoot, 'apps/shared/constants/generated-morpheus-signer-registry.ts'),
    'MORPHEUS_PUBLIC_SIGNER_REGISTRY',
    'MorpheusPublicSignerRegistry',
    signers,
    '// Generated from neo-morpheus-oracle/config/signer-identities.json.',
    { eslintDisable: false }
  );

  console.log(`Synced Morpheus generated config from ${oracleRoot}`);
  console.log('Confidential envelope parity verified against the canonical oracle module');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
