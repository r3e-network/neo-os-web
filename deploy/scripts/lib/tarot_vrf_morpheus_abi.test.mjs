import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMorpheusManifest } from '../verify_tarot_vrf_morpheus_testnet.mjs';

const common = [
  { name: 'requestFee', parameters: [], returntype: 'Integer', safe: true },
  {
    name: 'feeCreditOf',
    parameters: [{ name: 'requester', type: 'Hash160' }],
    returntype: 'Integer',
    safe: true,
  },
  {
    name: 'requestFromCallback',
    parameters: [
      { name: 'requester', type: 'Hash160' },
      { name: 'requestType', type: 'String' },
      { name: 'payload', type: 'ByteArray' },
      { name: 'callbackContract', type: 'Hash160' },
      { name: 'callbackMethod', type: 'String' },
    ],
    returntype: 'Integer',
    safe: false,
  },
  {
    name: 'onNEP17Payment',
    parameters: [
      { name: 'from', type: 'Hash160' },
      { name: 'amount', type: 'Integer' },
      { name: 'data', type: 'Any' },
    ],
    returntype: 'Void',
    safe: false,
  },
];

test('classifies current TESTNET allowlist ABI', () => {
  const manifest = { abi: { methods: [
    ...common,
    {
      name: 'addAllowedCallback',
      parameters: [{ name: 'contractHash', type: 'Hash160' }],
      returntype: 'Void',
      safe: false,
    },
    {
      name: 'isAllowedCallback',
      parameters: [{ name: 'contractHash', type: 'Hash160' }],
      returntype: 'Boolean',
      safe: true,
    },
  ] } };
  assert.equal(classifyMorpheusManifest(manifest), 'legacy-allowlist');
});

test('classifies canonical MiniApp OS ABI', () => {
  const manifest = { abi: { methods: [
    ...common,
    {
      name: 'registerMiniApp',
      parameters: [
        { name: 'appId', type: 'String' },
        { name: 'appAdmin', type: 'Hash160' },
        { name: 'feePayer', type: 'Hash160' },
        { name: 'callbackContract', type: 'Hash160' },
        { name: 'metadataUri', type: 'String' },
        { name: 'metadataHash', type: 'String' },
      ],
      returntype: 'Void',
      safe: false,
    },
    {
      name: 'grantModuleToMiniApp',
      parameters: [
        { name: 'appId', type: 'String' },
        { name: 'moduleId', type: 'String' },
      ],
      returntype: 'Void',
      safe: false,
    },
  ] } };
  assert.equal(classifyMorpheusManifest(manifest), 'canonical-miniapp-os');
});

test('fails closed on callback signature drift or ambiguous generation', () => {
  const drifted = structuredClone(common);
  drifted[2].parameters[1].type = 'ByteArray';
  assert.throws(
    () => classifyMorpheusManifest({ abi: { methods: drifted } }),
    /ABI drift/,
  );

  assert.throws(
    () => classifyMorpheusManifest({ abi: { methods: common } }),
    /ambiguous or unsupported/,
  );

  const unsafeFee = structuredClone(common);
  unsafeFee[0].safe = false;
  assert.throws(
    () => classifyMorpheusManifest({ abi: { methods: unsafeFee } }),
    /return\/safe flags drifted/,
  );
});
