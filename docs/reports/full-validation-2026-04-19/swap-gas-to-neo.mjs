#!/usr/bin/env node
/**
 * One-shot helper: swap a small amount of GAS for >=1 whole NEO so the
 * mainnet selfLoan flagship has the required collateral.
 *
 * Path:
 *   1. Send GAS to FlamingoSwapRouter with onNEP17Payment data
 *      [amountOutMin, [GAS_HASH, BNEO_HASH], deadline] → receive bNEO
 *   2. Call BurgerNEO.pika(amount) to convert bNEO → real NEO (1 NEO = 1e8 bNEO)
 *
 * Reads FLAGSHIP_LIVE_WIF from process.env. Targets mainnet.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const Neon = (await import(path.resolve(HERE, "../../../deploy/scripts/lib/neon-compat.mjs"))).default;

const RPC = process.env.NEO_RPC_MAINNET || "https://mainnet2.neo.coz.io:443";
const NETWORK_MAGIC = 860833102;
const GAS_HASH      = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const BNEO_HASH     = "0x48c40d4666f93408be1bef038b6722404d9a4c2a";
const FLM_ROUTER    = "0xf970f4ccecd765b63732b821775dc38c25d74f23";

const TARGET_NEO    = Number(process.env.TARGET_NEO || "2");      // whole NEO
const GAS_BUDGET    = Number(process.env.GAS_BUDGET || "20") * 1e8; // 20 GAS in stoshis

const wif = process.env.FLAGSHIP_LIVE_WIF;
if (!wif) { console.error("FLAGSHIP_LIVE_WIF unset"); process.exit(1); }
const account = new Neon.wallet.Account(wif);
console.log(`[swap] funder address: ${account.address}`);

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }).then((r) => r.json());
  if (r.error) throw new Error(`${method}: ${r.error.message}`);
  return r.result;
}

async function balanceOf(asset, addr) {
  const r = await rpc("invokefunction", [asset, "balanceOf", [{ type: "Hash160", value: addr.startsWith("0x") ? addr : `0x${addr}` }]]);
  return BigInt(r.stack?.[0]?.value || "0");
}

async function waitTx(txid, label) {
  const start = Date.now();
  while (Date.now() - start < 90000) {
    try {
      const r = await rpc("getapplicationlog", [txid]);
      const exec = r?.executions?.[0];
      if (exec) {
        if (exec.vmstate !== "HALT") throw new Error(`${label} FAULT: ${exec.exception}`);
        return exec;
      }
    } catch (err) {
      if (!String(err?.message || "").includes("Unknown transaction")) throw err;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`${label} not mined within 90s: ${txid}`);
}

const gas = new Neon.experimental.SmartContract(GAS_HASH, { rpcAddress: RPC, networkMagic: NETWORK_MAGIC, account });
const bneo = new Neon.experimental.SmartContract(BNEO_HASH, { rpcAddress: RPC, networkMagic: NETWORK_MAGIC, account });

// Phase 1: GAS → bNEO via Flamingo
const gasIn = String(Math.floor(GAS_BUDGET));
const bneoOutMin = String(BigInt(TARGET_NEO) * 100_000_000n + 100n); // need at least TARGET_NEO bNEO + cushion
const deadline = String(Math.floor(Date.now() / 1000) + 600);
const swapData = [
  Neon.sc.ContractParam.integer(bneoOutMin),
  Neon.sc.ContractParam.array(
    Neon.sc.ContractParam.hash160(GAS_HASH),
    Neon.sc.ContractParam.hash160(BNEO_HASH),
  ),
  Neon.sc.ContractParam.integer(deadline),
];
console.log(`[swap] sending ${gasIn} GAS stoshis to Flamingo, expecting >= ${bneoOutMin} bNEO stoshis`);
const tx1 = await gas.invoke("transfer", [
  Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
  Neon.sc.ContractParam.hash160(FLM_ROUTER),
  Neon.sc.ContractParam.integer(gasIn),
  Neon.sc.ContractParam.array(...swapData),
]);
console.log(`[swap] swap tx: ${tx1}`);
await waitTx(tx1, "GAS→bNEO swap");

const bneoBal = await balanceOf(BNEO_HASH, account.scriptHash);
console.log(`[swap] bNEO balance after swap: ${bneoBal} (=${Number(bneoBal) / 1e8} NEO worth)`);
if (bneoBal < BigInt(TARGET_NEO) * 100_000_000n) {
  throw new Error(`got insufficient bNEO; got ${bneoBal} stoshis`);
}

// Phase 2: bNEO → NEO via BurgerNEO.pika(amount)
console.log(`[swap] calling pika(${TARGET_NEO}) to redeem ${TARGET_NEO} NEO`);
const tx2 = await bneo.invoke("pika", [Neon.sc.ContractParam.integer(String(TARGET_NEO))]);
console.log(`[swap] pika tx: ${tx2}`);
await waitTx(tx2, "bNEO pika→NEO");

const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const neoBal = await balanceOf(NEO_HASH, account.scriptHash);
console.log(`[swap] NEO balance now: ${neoBal} whole NEO`);
if (neoBal < BigInt(TARGET_NEO)) {
  throw new Error(`pika did not produce expected NEO; got ${neoBal}`);
}
console.log(`[swap] success — funder has ${neoBal} NEO ready for selfLoan`);
