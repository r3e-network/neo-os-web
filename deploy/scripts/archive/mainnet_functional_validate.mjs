#!/usr/bin/env node
// Read-only mainnet functional validator.
// Verifies CONTRACTS ARE FUNCTIONAL (not merely deployed) via invokefunction (read-only).

const RPCS = [
  'https://api.n3index.dev/mainnet',
  'https://rpc10.n3.nspcc.ru:10331',
  'https://mainnet1.neo.coz.io:443',
];

let rpcCursor = 0;

async function rpcCall(method, params, { tries = RPCS.length * 2 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const url = RPCS[(rpcCursor + i) % RPCS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      // coz sometimes returns HTML error pages
      if (text.trim().startsWith('<')) throw new Error(`HTML response from ${url}`);
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(`non-JSON from ${url}: ${text.slice(0, 80)}`); }
      if (json.error) throw new Error(`rpc error ${json.error.code}: ${json.error.message}`);
      rpcCursor = (rpcCursor + i) % RPCS.length; // stick to working node
      return { result: json.result, node: url };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`all RPCs failed for ${method}: ${lastErr?.message}`);
}

async function invoke(hash, method, params = []) {
  return rpcCall('invokefunction', [hash, method, params]);
}

async function getContractState(hash) {
  return rpcCall('getcontractstate', [hash]);
}

// ---- stack value decoders ----
function decodeInt(item) {
  if (item == null) return null;
  if (item.type === 'Integer') return BigInt(item.value);
  if (item.type === 'ByteString' && item.value) {
    // little-endian byte string -> bigint (rare for ints here)
    const buf = Buffer.from(item.value, 'base64');
    let n = 0n;
    for (let i = buf.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(buf[i]);
    return n;
  }
  return null;
}
function b64ToUtf8(v) {
  try { return Buffer.from(v, 'base64').toString('utf8'); } catch { return null; }
}
function decodeStr(item) {
  if (!item) return null;
  if (item.type === 'ByteString' || item.type === 'String') return b64ToUtf8(item.value);
  if (item.type === 'Integer') return item.value;
  return null;
}

const checks = [];
const broken = [];
function record(target, method, net, result, ok) {
  checks.push({ target, method, net, result, ok });
  if (!ok) broken.push(`${target}.${method}(${net}): ${result}`);
}

const NOW = Math.floor(Date.now() / 1000);

// ============ (1) MorpheusDataFeed price feed ============
const DATAFEED = '0x03013f49c42a14546c8bbe58f9d434c3517fccab';
const PAIRS = ['NEO-USD', 'BTC-USD', 'ETH-USD', 'GAS-USD', 'EUR-USD'];

async function checkDataFeed() {
  for (const pair of PAIRS) {
    const key = `TWELVEDATA:${pair}`;
    try {
      const { result } = await invoke(DATAFEED, 'getLatest', [{ type: 'String', value: key }]);
      if (result.state !== 'HALT') { record('MorpheusDataFeed', `getLatest ${pair}`, 'mainnet', `FAULT state=${result.state} ${result.exception || ''}`, false); continue; }
      const top = result.stack?.[0];
      if (!top || (top.type !== 'Array' && top.type !== 'Struct') || !Array.isArray(top.value) || !top.value.length) { record('MorpheusDataFeed', `getLatest ${pair}`, 'mainnet', `empty/no struct (state HALT but stack=${JSON.stringify(top)})`, false); continue; }
      const arr = top.value;
      // [pair, roundId(field1=ts), price(field2 /1e6), timestamp(field3), attestationHash, sourceSetId]
      const roundId = Number(decodeInt(arr[1]) ?? 0n);
      const priceRaw = decodeInt(arr[2]) ?? 0n;
      const price = Number(priceRaw) / 1e6;
      const ts3 = Number(decodeInt(arr[3]) ?? 0n);
      const ageSec = NOW - roundId;
      const ageH = (ageSec / 3600).toFixed(2);
      const priceOk = price > 0;
      const freshOk = ageSec >= 0 && ageSec < 2 * 3600;
      const ok = priceOk && freshOk;
      const flags = [];
      if (!priceOk) flags.push('PRICE<=0');
      if (!freshOk) flags.push(ageSec < 0 ? 'roundId IN FUTURE' : `STALE ${ageH}h>2h`);
      record('MorpheusDataFeed', `getLatest ${pair}`, 'mainnet',
        `price=${price} roundId=${roundId} (age ${ageH}h) field3ts=${ts3}${flags.length ? ' [' + flags.join(',') + ']' : ''}`, ok);
    } catch (e) {
      record('MorpheusDataFeed', `getLatest ${pair}`, 'mainnet', `ERROR ${e.message}`, false);
    }
  }
}

// ============ (2) MorpheusOracle kernel ============
const KERNEL = '0xf54d8584ef82315c1800373272ab08ae0db2d5ef';
async function checkKernel() {
  // discover safe 0-param getters from on-chain manifest, prefer a count-like one
  let methods = [];
  let manifestName = '?';
  try {
    const { result } = await getContractState(KERNEL);
    if (!result) { record('MorpheusOracle kernel', 'getcontractstate', 'mainnet', 'NOT FOUND on chain', false); return; }
    manifestName = result.manifest?.name || '?';
    methods = (result.manifest?.abi?.methods || []).filter(m => m.safe && m.parameters.length === 0).map(m => m.name);
    record('MorpheusOracle kernel', 'getcontractstate', 'mainnet', `deployed name=${manifestName} safe0getters=[${methods.join(',') || 'none'}]`, true);
  } catch (e) {
    record('MorpheusOracle kernel', 'getcontractstate', 'mainnet', `ERROR ${e.message}`, false);
    return;
  }
  const preferred = ['getMiniAppCount', 'getRequestCount', 'getTotalRequests', 'totalRequests'];
  const pick = preferred.find(p => methods.includes(p)) || methods.find(m => /count|total|fee|nonce|version|admin|owner/i.test(m)) || methods[0];
  if (!pick) { record('MorpheusOracle kernel', 'getter', 'mainnet', 'no safe 0-param getter exposed', false); return; }
  try {
    const { result } = await invoke(KERNEL, pick);
    if (result.state !== 'HALT') { record('MorpheusOracle kernel', pick, 'mainnet', `FAULT ${result.exception || result.state}`, false); return; }
    const top = result.stack?.[0];
    const asInt = decodeInt(top);
    const asStr = decodeStr(top);
    const val = asInt != null ? asInt.toString() : (asStr ?? JSON.stringify(top));
    const sane = top != null;
    record('MorpheusOracle kernel', pick, 'mainnet', `${pick}=${val} (type ${top?.type})`, sane);
  } catch (e) {
    record('MorpheusOracle kernel', pick, 'mainnet', `ERROR ${e.message}`, false);
  }
}

// ============ (3) AA core ============
const AA_CORE = '0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2'; // testnet per context; mainnet 0x0268...
const AA_CORE_MN = '0x0268a387913b250166ddec032b03332690a1ef78';
async function checkAACore() {
  const hash = AA_CORE_MN;
  let methods = [];
  try {
    const { result } = await getContractState(hash);
    if (!result) { record('AA core', 'getcontractstate', 'mainnet', `NOT FOUND ${hash}`, false); return; }
    const name = result.manifest?.name || '?';
    methods = (result.manifest?.abi?.methods || []).filter(m => m.safe && m.parameters.length === 0).map(m => m.name);
    record('AA core', 'getcontractstate', 'mainnet', `deployed name=${name} safe0getters=[${methods.join(',') || 'none'}]`, true);
  } catch (e) {
    record('AA core', 'getcontractstate', 'mainnet', `ERROR ${e.message}`, false);
    return;
  }
  const preferred = ['getAccountCount', 'totalAccounts', 'getOwner', 'getAdmin', 'admin', 'owner', 'getVersion', 'version'];
  const pick = preferred.find(p => methods.includes(p)) || methods[0];
  if (!pick) { record('AA core', 'getter', 'mainnet', 'no safe 0-param getter', false); return; }
  try {
    const { result } = await invoke(hash, pick);
    if (result.state !== 'HALT') { record('AA core', pick, 'mainnet', `FAULT ${result.exception || result.state}`, false); return; }
    const top = result.stack?.[0];
    const asInt = decodeInt(top);
    const val = asInt != null ? asInt.toString() : (decodeStr(top) ?? top?.type);
    record('AA core', pick, 'mainnet', `${pick}=${val} (type ${top?.type})`, top != null);
  } catch (e) {
    record('AA core', pick, 'mainnet', `ERROR ${e.message}`, false);
  }
}

// ============ (4) Migrated miniapp contracts ============
// hash + preferred safe 0-param read method (per built manifests)
const MINIAPPS = [
  { app: 'red-envelope', hash: '0x363c5de9760d1aaaed5096fdf3bdc877cd0368e9', method: 'lastEnvelopeId' },
  { app: 'last-survivor', hash: '0x8e1e432e966357de8d7642564b744d3274a81bd0', method: 'currentRoundId' },
  { app: 'time-capsule', hash: '0x3e88058ef32c4d8d17eb1a2188d6d5e329c94f8a', method: 'lastCapsuleId' },
  { app: 'on-chain-tarot', hash: '0xb680225a1be276b03ecd7de82ea985dcc7435cec', method: 'drawFee' },
  { app: 'fogplay(coinflip)', hash: '0x5d82339da085b72468200e76a2aa2f3cd2912953', method: 'bankroll' },
  { app: 'breakup-contract', hash: '0xf6769c080395f15c28013108b7af7631e1665336', method: 'lastPactId' },
  { app: 'self-loan', hash: '0x87f94598c78cb954ca8200d3964ded9b584d7250', method: 'neoPrice' },
  // v2 (2026-06-12): fixed 5-minute bidding window per epoch. The v1 contract
  // (0x1eb83eb5d4d3f073112064e8a3825f3b0e5f88e9) stays live for user exits only.
  { app: 'gov-merc', hash: '0x140f5faf5692d21421a79278b0e45b9b9bd4bb46', method: 'totalStaked' },
  { app: 'burn-league', hash: '0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f', method: 'currentSeason' },
  { app: 'dev-tipping(tipjar)', hash: '0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec', method: 'totalDevelopers' },
  { app: 'gasbox', hash: '0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7', method: 'lastMachineId' },
  { app: 'milestone-escrow', hash: '0x442162de25008ac78d4cce62ed8d8a64401b7ece', method: 'totalEscrows' },
];

async function checkMiniapp({ app, hash, method }) {
  // 4a: getcontractstate
  let onChainMethods = [];
  let stateOk = false;
  try {
    const { result } = await getContractState(hash);
    if (!result) { record(app, 'getcontractstate', 'mainnet', `NOT DEPLOYED ${hash}`, false); return; }
    const name = result.manifest?.name || '?';
    const id = result.id;
    onChainMethods = (result.manifest?.abi?.methods || []).filter(m => m.safe && m.parameters.length === 0).map(m => m.name);
    stateOk = true;
    record(app, 'getcontractstate', 'mainnet', `name=${name} id=${id} ${result.manifest?.abi?.methods?.length || 0} methods`, true);
  } catch (e) {
    record(app, 'getcontractstate', 'mainnet', `ERROR ${e.message}`, false);
    return;
  }
  // 4b: a safe read method
  const pick = onChainMethods.includes(method) ? method : onChainMethods[0];
  if (!pick) { record(app, 'read', 'mainnet', 'no safe 0-param method exposed', false); return; }
  try {
    const { result } = await invoke(hash, pick);
    if (result.state !== 'HALT') { record(app, pick, 'mainnet', `FAULT ${result.exception || result.state}`, false); return; }
    const top = result.stack?.[0];
    const asInt = decodeInt(top);
    let val, ok;
    if (asInt != null) {
      val = asInt.toString();
      // sanity: non-negative integers expected for ids/counts/fees/prices/bankroll/stake
      ok = asInt >= 0n;
    } else {
      val = decodeStr(top) ?? JSON.stringify(top);
      ok = top != null;
    }
    record(app, pick, 'mainnet', `${pick}=${val} (${top?.type})`, ok);
  } catch (e) {
    record(app, pick, 'mainnet', `ERROR ${e.message}`, false);
  }
}

// ============ run ============
(async () => {
  console.error('Probing RPC nodes...');
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getblockcount', params: [] }), signal: AbortSignal.timeout(10000) });
      const t = await r.text();
      const j = t.trim().startsWith('<') ? null : JSON.parse(t);
      console.error(`  ${url} -> ${j?.result ?? 'HTML/err'}`);
    } catch (e) { console.error(`  ${url} -> DOWN (${e.message})`); }
  }

  await checkDataFeed();
  await checkKernel();
  await checkAACore();
  for (const m of MINIAPPS) await checkMiniapp(m);

  const summary = {
    total: checks.length,
    ok: checks.filter(c => c.ok).length,
    failed: checks.filter(c => !c.ok).length,
  };
  console.log('\n===== RESULTS =====');
  for (const c of checks) {
    console.log(`${c.ok ? 'OK ' : 'XX '} [${c.target}] ${c.method} :: ${c.result}`);
  }
  console.log('\n===== SUMMARY =====');
  console.log(JSON.stringify(summary));
  console.log('\n===== JSON =====');
  console.log(JSON.stringify({ summary, checks, broken }, null, 2));
})();
