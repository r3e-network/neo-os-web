#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const Neon = require("@cityofzion/neon-js");

const root = path.resolve(__dirname, "..", "..");
const RPC_URL = process.env.NEO_RPC_URL || "https://testnet1.neo.coz.io:443";
const NETWORK_MAGIC = Number(process.env.NEO_NETWORK_MAGIC || 894710606);
const DEPLOYER_WIF = process.env.DEPLOYER_WIF || process.env.FLAGSHIP_TESTNET_WIF || process.env.NEO_TESTNET_WIF || "";
const ORACLE_HASH = (process.env.MORPHEUS_ORACLE_TESTNET_HASH || "0x4b882e94ed766807c4fd728768f972e13008ad52").trim();
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const MIN_ORACLE_CREDIT = BigInt(process.env.FLAGSHIP_MIN_ORACLE_CREDIT || "10000000");

if (!DEPLOYER_WIF) {
  console.error("DEPLOYER_WIF (or FLAGSHIP_TESTNET_WIF / NEO_TESTNET_WIF) is required");
  process.exit(1);
}

const account = new Neon.wallet.Account(DEPLOYER_WIF);
const rpcClient = new Neon.rpc.RPCClient(RPC_URL);

const TARGETS = [
  { brand: "FogPlay", manifest: "apps/fogplay/neo-manifest.json", methods: [["setOracle", [ORACLE_HASH]]], callbackCredit: true },
  { brand: "GASBOX", manifest: "apps/gasbox/neo-manifest.json", methods: [["setOracle", [ORACLE_HASH]]], callbackCredit: true },
  { brand: "Red Envelope", manifest: "apps/red-envelope/neo-manifest.json", methods: [["setOracle", [ORACLE_HASH]]], callbackCredit: true },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hash160Arg(value) {
  return Neon.sc.ContractParam.hash160(value);
}

function hash160JsonArg(value) {
  return { type: "Hash160", value };
}

async function waitForTx(txid, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const log = await rpcClient.getApplicationLog(txid);
      if (log?.executions?.length) {
        return log.executions[0];
      }
    } catch {}
    await sleep(3000);
  }
  throw new Error(`timed out waiting for ${txid}`);
}

async function invokePersisted(scriptHash, operation, values) {
  const contract = new Neon.experimental.SmartContract(scriptHash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });
  const args = values.map((value) => {
    if (value && typeof value === "object" && value.type && value.value !== undefined) return value;
    return hash160Arg(value);
  });
  const txid = await contract.invoke(operation, args);
  const normalized = String(txid).startsWith("0x") ? String(txid) : `0x${txid}`;
  const execution = await waitForTx(normalized);
  if (execution.vmstate !== "HALT") {
    throw new Error(`${operation} failed: ${execution.exception || execution.vmstate}`);
  }
  return normalized;
}

async function transferGas(toHash, amount, data) {
  const contract = new Neon.experimental.SmartContract(GAS_HASH, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });
  const callbackHash = String(data || "").replace(/^0x/i, "");
  const callbackBytes = callbackHash ? Buffer.from(callbackHash, "hex").reverse() : null;
  const txid = await contract.invoke("transfer", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.hash160(toHash),
    Neon.sc.ContractParam.integer(String(amount)),
    callbackBytes ? Neon.sc.ContractParam.byteArray(callbackBytes.toString("base64")) : Neon.sc.ContractParam.any(null),
  ]);
  const normalized = String(txid).startsWith("0x") ? String(txid) : `0x${txid}`;
  const execution = await waitForTx(normalized);
  if (execution.vmstate !== "HALT") {
    throw new Error(`transfer failed: ${execution.exception || execution.vmstate}`);
  }
  return normalized;
}

async function readBool(scriptHash, operation, args = []) {
  const result = await rpcClient.invokeFunction(scriptHash, operation, args);
  const item = result?.stack?.[0];
  if (!item) return false;
  if (item.type === "Boolean") return Boolean(item.value);
  if (item.type === "Integer") return String(item.value) !== "0";
  return false;
}

async function readInteger(scriptHash, operation, args = []) {
  const result = await rpcClient.invokeFunction(scriptHash, operation, args);
  const item = result?.stack?.[0];
  return BigInt(item?.value || "0");
}

async function readOracle(scriptHash) {
  const result = await rpcClient.invokeFunction(scriptHash, "oracle", []);
  const item = result?.stack?.[0];
  if (!item || item.type !== "ByteString" || !item.value) return "";
  const hex = Buffer.from(item.value, "base64").toString("hex");
  return `0x${Neon.u.reverseHex(hex)}`;
}

async function main() {
  const rows = [];
  for (const target of TARGETS) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, target.manifest), "utf8"));
    const contractHash = manifest.contracts?.["neo-n3-testnet"];
    if (!contractHash) {
      rows.push({ brand: target.brand, contractHash: "missing", action: "skipped", error: "missing testnet hash" });
      continue;
    }

    const before = await readOracle(contractHash);
    const txids = [];
    for (const [method, args] of target.methods) {
      txids.push(await invokePersisted(contractHash, method, args));
    }
    const callbackAllowedBefore = await readBool(ORACLE_HASH, "isAllowedCallback", [hash160JsonArg(contractHash)]);
    if (!callbackAllowedBefore) {
      txids.push(await invokePersisted(ORACLE_HASH, "addAllowedCallback", [contractHash]));
    }
    const creditBefore = await readInteger(ORACLE_HASH, "feeCreditOf", [hash160JsonArg(contractHash)]);
    if (target.callbackCredit && creditBefore < MIN_ORACLE_CREDIT) {
      txids.push(await transferGas(ORACLE_HASH, MIN_ORACLE_CREDIT - creditBefore, contractHash));
    }
    const after = await readOracle(contractHash);
    const callbackAllowedAfter = await readBool(ORACLE_HASH, "isAllowedCallback", [hash160JsonArg(contractHash)]);
    const creditAfter = await readInteger(ORACLE_HASH, "feeCreditOf", [hash160JsonArg(contractHash)]);
    rows.push({
      brand: target.brand,
      contractHash,
      before,
      after,
      callbackAllowedAfter,
      creditBefore: creditBefore.toString(),
      creditAfter: creditAfter.toString(),
      txids,
    });
  }

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
