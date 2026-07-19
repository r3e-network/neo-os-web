#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import pkg from '@cityofzion/neon-js';

const { wallet } = pkg;

export const TESTNET_RPC = 'https://api.n3index.dev/testnet';
export const TESTNET_ORACLE = '0xf54d8584ef82315c1800373272ab08ae0db2d5ef';
export const TESTNET_MAGIC = 894710606;
export const MAX_SUPPORTED_FEE = 10_000_000;

const expectedRequestFromCallback = [
  ['requester', 'Hash160'],
  ['requestType', 'String'],
  ['payload', 'ByteArray'],
  ['callbackContract', 'Hash160'],
  ['callbackMethod', 'String'],
];

function requireMethod(methods, name, parameterTypes, returntype, safe) {
  const method = methods.get(name);
  if (!method) throw new Error(`required Morpheus ABI method missing: ${name}`);
  const actualTypes = method.parameters.map(({ type }) => type);
  if (JSON.stringify(actualTypes) !== JSON.stringify(parameterTypes)) {
    throw new Error(`${name} parameter ABI drift: ${JSON.stringify(actualTypes)}`);
  }
  if (method.returntype !== returntype || method.safe !== safe) {
    throw new Error(`${name} return/safe flags drifted`);
  }
  return method;
}

export function classifyMorpheusManifest(manifest) {
  if (!manifest?.abi?.methods || !Array.isArray(manifest.abi.methods)) {
    throw new Error('invalid Morpheus manifest');
  }
  const methods = new Map(manifest.abi.methods.map((method) => [method.name, method]));
  requireMethod(methods, 'requestFee', [], 'Integer', true);
  requireMethod(methods, 'feeCreditOf', ['Hash160'], 'Integer', true);
  requireMethod(methods, 'onNEP17Payment', ['Hash160', 'Integer', 'Any'], 'Void', false);

  const request = requireMethod(
    methods,
    'requestFromCallback',
    ['Hash160', 'String', 'ByteArray', 'Hash160', 'String'],
    'Integer',
    false,
  );
  const actual = request.parameters.map(({ name, type }) => [name, type]);
  if (JSON.stringify(actual) !== JSON.stringify(expectedRequestFromCallback)) {
    throw new Error(`requestFromCallback ABI drift: ${JSON.stringify(actual)}`);
  }
  const old = methods.has('addAllowedCallback') && methods.has('isAllowedCallback');
  const canonical = methods.has('registerMiniApp') && methods.has('grantModuleToMiniApp');
  if (old === canonical) {
    throw new Error('Morpheus ABI generation is ambiguous or unsupported');
  }
  if (old) {
    requireMethod(methods, 'addAllowedCallback', ['Hash160'], 'Void', false);
    requireMethod(methods, 'isAllowedCallback', ['Hash160'], 'Boolean', true);
    return 'legacy-allowlist';
  }

  requireMethod(
    methods,
    'registerMiniApp',
    ['String', 'Hash160', 'Hash160', 'Hash160', 'String', 'String'],
    'Void',
    false,
  );
  requireMethod(methods, 'grantModuleToMiniApp', ['String', 'String'], 'Void', false);
  return 'canonical-miniapp-os';
}

async function rpc(method, params) {
  const response = await fetch(TESTNET_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`RPC ${method} failed: ${JSON.stringify(body.error)}`);
  return body.result;
}

function readHash160(item, label) {
  if (item?.type !== 'ByteString') {
    throw new Error(`${label} returned ${item?.type || '<missing>'}`);
  }
  const bytes = Buffer.from(String(item.value || ''), 'base64');
  if (bytes.length !== 20) throw new Error(`${label} returned ${bytes.length} bytes`);
  return `0x${Buffer.from(bytes).reverse().toString('hex')}`;
}

export async function verifyTestnet() {
  const [version, state] = await Promise.all([
    rpc('getversion', []),
    rpc('getcontractstate', [TESTNET_ORACLE]),
  ]);
  const observedNetwork = Number(version?.protocol?.network);
  if (observedNetwork !== TESTNET_MAGIC) {
    throw new Error(`unexpected network magic ${observedNetwork}`);
  }
  if (state.hash.toLowerCase() !== TESTNET_ORACLE) {
    throw new Error(`unexpected Oracle hash ${state.hash}`);
  }
  if (state.manifest?.name !== 'MorpheusOracle') {
    throw new Error(`unexpected Oracle contract name ${state.manifest?.name || '<missing>'}`);
  }
  const generation = classifyMorpheusManifest(state.manifest);
  const invocation = await rpc('invokefunction', [TESTNET_ORACLE, 'requestFee', []]);
  if (!String(invocation.state || '').startsWith('HALT')) {
    throw new Error(`requestFee faulted: ${invocation.exception || invocation.state}`);
  }
  if (invocation.stack?.[0]?.type !== 'Integer') {
    throw new Error(`requestFee returned ${invocation.stack?.[0]?.type || '<missing>'}`);
  }
  const fee = BigInt(invocation.stack[0].value);
  if (fee < 0n || fee > BigInt(MAX_SUPPORTED_FEE)) {
    throw new Error(`unsupported live request fee ${fee}`);
  }
  let oracleAdminHash = '';
  let oracleAdminAddress = '';
  if (generation === 'legacy-allowlist') {
    const admin = await rpc('invokefunction', [TESTNET_ORACLE, 'admin', []]);
    if (!String(admin.state || '').startsWith('HALT')) {
      throw new Error(`admin faulted: ${admin.exception || admin.state}`);
    }
    oracleAdminHash = readHash160(admin.stack?.[0], 'admin');
    oracleAdminAddress = wallet.getAddressFromScriptHash(oracleAdminHash.slice(2));
  }

  return {
    observedAt: new Date().toISOString(),
    rpc: TESTNET_RPC,
    networkMagic: observedNetwork,
    oracle: TESTNET_ORACLE,
    updateCounter: state.updatecounter,
    compiler: state.nef?.compiler || '',
    generation,
    oracleAdminHash,
    oracleAdminAddress,
    requestFeeBaseUnits: fee.toString(),
    readingFeeBaseUnits: String(MAX_SUPPORTED_FEE),
    activationRule: generation === 'legacy-allowlist'
      ? 'addAllowedCallback(tarotHash) and verify isAllowedCallback=true'
      : 'register app/callback/fee payer and grant vrf_random',
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyTestnet()
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(`Tarot VRF Morpheus preflight failed closed: ${error.message}`);
      process.exitCode = 1;
    });
}
