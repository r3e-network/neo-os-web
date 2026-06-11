/**
 * Neo N3 RPC client for fuzz testing — invoke/read contract methods,
 * build and broadcast transactions.
 */

let Neon;

const RPC_URL = process.env.NEO_RPC_URL || "https://testnet1.neo.coz.io:443";
const NETWORK_MAGIC = parseInt(process.env.NEO_NETWORK_MAGIC || "894710606", 10);
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

async function ensureNeon() {
  if (!Neon) {
    Neon = await import("@cityofzion/neon-js");
    if (Neon.default) Neon = Neon.default;
  }
  return Neon;
}

export async function createRpcClient() {
  const neon = await ensureNeon();
  return new neon.rpc.RPCClient(RPC_URL);
}

export async function invokeRead(contractHash, method, args = []) {
  const neon = await ensureNeon();
  const client = new neon.rpc.RPCClient(RPC_URL);
  const result = await client.invokeFunction(contractHash, method, args);
  return result;
}

// NOTE: the old invokeWrite helper was deleted (MP-W3-09): it had zero
// callers, never called calculatenetworkfee, and signed with a flat 200k
// datoshi network fee below the per-byte minimum — any broadcast would have
// been rejected. Real write paths live in deploy/scripts/lib/live_rpc.mjs.

export function intParam(value) {
  return { type: "Integer", value: String(value) };
}

export function strParam(value) {
  return { type: "String", value };
}

export function hashParam(value) {
  return { type: "Hash160", value: String(value).replace(/^0x/, "") };
}

export function boolParam(value) {
  return { type: "Boolean", value };
}

export function bytesParam(hex) {
  return { type: "ByteArray", value: hex };
}

export function arrayParam(items) {
  return { type: "Array", value: items };
}

export { RPC_URL, NETWORK_MAGIC, GAS_HASH, NEO_HASH };
