import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const manifestPath = path.join(root, 'contracts', 'build', 'MiniAppTarotVrf.manifest.json');
const nefPath = path.join(root, 'contracts', 'build', 'MiniAppTarotVrf.nef');
const sourceDir = path.join(root, 'contracts', 'MiniAppTarotVrf');

const requiredMethods = new Map([
  ['requestReading', false],
  ['onOracleResult', false],
  ['onMiniAppResult', false],
  ['refundExpiredReading', false],
  ['cancelExpiredReading', false],
  ['withdrawCredit', false],
  ['withdrawAllCredit', false],
  ['getReading', true],
  ['completedReadingsCount', true],
  ['playerCompletedReadingCount', true],
  ['requestIdSeen', true],
  ['accounting', true],
  ['currentOracleFee', true],
  ['currentOracleFeeCredit', true],
  ['proposeAdmin', false],
  ['acceptAdmin', false],
  ['proposeOracle', false],
  ['activateOracle', false],
  ['proposeUpdate', false],
  ['update', false],
]);

test('MiniAppTarotVrf build artifacts expose the production ABI and narrow permissions', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const nef = await readFile(nefPath);
  assert.equal(manifest.name, 'MiniAppTarotVrf');
  assert.ok(nef.length > 100, 'compiled NEF must be non-empty');

  const methods = new Map(manifest.abi.methods.map((method) => [method.name, method]));
  for (const [name, safe] of requiredMethods) {
    assert.ok(methods.has(name), `missing ABI method ${name}`);
    assert.equal(methods.get(name).safe, safe, `${name} safe flag drift`);
  }

  assert.deepEqual(
    methods.get('requestReading').parameters.map(({ name, type }) => [name, type]),
    [['player', 'Hash160'], ['maxOracleFee', 'Integer']],
  );
  assert.deepEqual(
    methods.get('requestIdSeen').parameters.map(({ name, type }) => [name, type]),
    [['requestId', 'Integer']],
  );
  assert.deepEqual(
    methods.get('onOracleResult').parameters.map(({ name, type }) => [name, type]),
    [
      ['requestId', 'Integer'],
      ['requestType', 'String'],
      ['success', 'Boolean'],
      ['result', 'ByteArray'],
      ['error', 'String'],
    ],
  );
  assert.deepEqual(
    methods.get('onMiniAppResult').parameters.map(({ name, type }) => [name, type]),
    [
      ['requestId', 'Integer'],
      ['appId', 'String'],
      ['moduleId', 'String'],
      ['operation', 'String'],
      ['requester', 'Hash160'],
      ['success', 'Boolean'],
      ['result', 'ByteArray'],
      ['error', 'String'],
    ],
  );

  const wildcard = manifest.permissions.find(({ contract }) => contract === '*');
  assert.ok(wildcard, 'Morpheus dynamic permission missing');
  assert.deepEqual(
    [...wildcard.methods].sort(),
    ['feeCreditOf', 'requestFee', 'requestFromCallback'],
    'wildcard permission must stay limited to the three Morpheus calls',
  );

  const eventNames = new Set(manifest.abi.events.map(({ name }) => name));
  for (const name of ['ReadingRequested', 'ReadingDrawn', 'ReadingRefunded', 'CreditWithdrawn']) {
    assert.ok(eventNames.has(name), `missing event ${name}`);
  }
});

test('MiniAppTarotVrf source pins Morpheus fee and callback safety boundaries', async () => {
  const files = [
    'MiniAppTarotVrf.cs',
    'MiniAppTarotVrf.Callback.cs',
    'MiniAppTarotVrf.Request.cs',
    'MiniAppTarotVrf.Storage.cs',
  ];
  const source = (await Promise.all(files.map((name) =>
    readFile(path.join(sourceDir, name), 'utf8')))).join('\n');

  assert.doesNotMatch(source, /Runtime\.GetRandom/);
  assert.match(source, /REQUEST_TYPE = "vrf_random"/);
  assert.match(source, /Runtime\.GetNetwork\(\) == 894710606/);
  assert.match(source, /Oracle\(\) == LegacyTestnetOracle/);
  assert.match(source, /ReadingForRequest\(requestId\) == readingId/);
  assert.match(source, /RequestIdSeenInternal\(requestId\)/);
  assert.match(source, /reading\.PayloadHash == expectedPayloadHash/);
  assert.match(source, /LEGACY_CALLBACK_METHOD = "onOracleResult"/);
  assert.match(source, /RICH_CALLBACK_METHOD = "onMiniAppResult"/);
  assert.match(source, /candidate >= acceptanceLimit/);
  assert.match(source, /requestFee/);
  assert.match(source, /feeCreditOf/);
});
