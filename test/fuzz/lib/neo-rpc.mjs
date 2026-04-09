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

export async function invokeWrite(wif, contractHash, method, args = [], signers = []) {
  const neon = await ensureNeon();
  const account = new neon.wallet.Account(wif);

  const defaultSigners = signers.length > 0 ? signers : [{
    account: account.scriptHash,
    scopes: "CalledByEntry",
  }];

  const script = neon.sc.createScript({
    scriptHash: contractHash,
    operation: method,
    args,
  });

  const currentHeight = await new neon.rpc.RPCClient(RPC_URL).getBlockCount();
  const tx = new neon.tx.Transaction({
    signers: defaultSigners,
    validUntilBlock: currentHeight + 100,
    script,
  });

  // Estimate fees
  const client = new neon.rpc.RPCClient(RPC_URL);
  const invoke = await client.invokeScript(
    neon.u.HexString.fromHex(script).toString(),
    defaultSigners,
  );

  if (invoke.state === "FAULT") {
    const err = new Error(`VM FAULT: ${invoke.exception || "unknown"}`);
    err._vmfault = true;
    err._expected = true; // Faulting on bad input is correct
    throw err;
  }

  tx.systemFee = neon.u.BigInteger.fromNumber(invoke.gasconsumed);
  tx.networkFee = neon.u.BigInteger.fromNumber(200000); // estimate

  tx.sign(account, NETWORK_MAGIC);
  const result = await client.sendRawTransaction(tx);

  return { txid: result, invoke };
}

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
