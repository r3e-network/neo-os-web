#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const Neon = require("@cityofzion/neon-js");

const root = path.resolve(__dirname, "..", "..");
const RPC_URL = process.env.NEO_RPC_URL || "https://testnet1.neo.coz.io:443";
const NETWORK_MAGIC = Number(process.env.NEO_NETWORK_MAGIC || 894710606);
const WIF =
  process.env.FLAGSHIP_LIVE_WIF ||
  process.env.DEPLOYER_WIF ||
  process.env.FLAGSHIP_TESTNET_WIF ||
  process.env.NEO_TESTNET_WIF ||
  "";
const ORACLE_HASH = (process.env.MORPHEUS_ORACLE_TESTNET_HASH || "0x4b882e94ed766807c4fd728768f972e13008ad52").trim();
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

const DAILY_CHECKIN_FEE = "100000";
const FOGPLAY_BET = "5000000";
const RED_ENVELOPE_TOTAL = "10000000";
const SELF_LOAN_POOL_TOPUP = process.env.SELF_LOAN_POOL_TOPUP || "30000000";
const SELF_LOAN_COLLATERAL = "1";

if (!WIF) {
  console.error("FLAGSHIP_LIVE_WIF / NEO_TESTNET_WIF is required");
  process.exit(1);
}

const account = new Neon.wallet.Account(WIF);
const rpcClient = new Neon.rpc.RPCClient(RPC_URL);
const gasContract = new Neon.experimental.SmartContract(GAS_HASH, {
  rpcAddress: RPC_URL,
  networkMagic: NETWORK_MAGIC,
  account,
});
const neoContract = new Neon.experimental.SmartContract(NEO_HASH, {
  rpcAddress: RPC_URL,
  networkMagic: NETWORK_MAGIC,
  account,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function testnetHash(manifestRel) {
  const manifest = readJson(manifestRel);
  return String(manifest.contracts?.["neo-n3-testnet"] || "").trim();
}

function asTxid(value) {
  const text = String(value || "");
  return text.startsWith("0x") ? text : `0x${text}`;
}

async function waitForLog(txid, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  const normalized = asTxid(txid);
  while (Date.now() < deadline) {
    try {
      const log = await rpcClient.getApplicationLog(normalized);
      const execution = log?.executions?.[0];
      if (execution) {
        return { txid: normalized, execution };
      }
    } catch {}
    await sleep(2000);
  }
  throw new Error(`timed out waiting for ${normalized}`);
}

function stackValue(item) {
  if (!item || typeof item !== "object") return null;
  switch (item.type) {
    case "Integer":
      return String(item.value || "0");
    case "Boolean":
      return Boolean(item.value);
    case "ByteString": {
      const raw = String(item.value || "");
      if (!raw) return "";
      const bytes = Buffer.from(raw, "base64");
      if (bytes.length === 20) {
        return `0x${Buffer.from(bytes).reverse().toString("hex")}`;
      }
      try {
        return bytes.toString("utf8");
      } catch {
        return raw;
      }
    }
    case "Array":
    case "Struct":
      return Array.isArray(item.value) ? item.value.map(stackValue) : [];
    case "Map":
      return Object.fromEntries((item.value || []).map((entry) => [stackValue(entry.key), stackValue(entry.value)]));
    default:
      return item.value ?? null;
  }
}

async function invokeRead(scriptHash, operation, args = []) {
  const res = await rpcClient.invokeFunction(scriptHash, operation, args);
  if (String(res?.state || "").toUpperCase() === "FAULT") {
    throw new Error(`${operation} faulted: ${res.exception || "unknown error"}`);
  }
  return res.stack?.[0] ? stackValue(res.stack[0]) : null;
}

async function transferGAS(toHash, amount, memo) {
  const txid = await gasContract.invoke("transfer", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.hash160(toHash),
    Neon.sc.ContractParam.integer(String(amount)),
    typeof memo === "string" ? memo : Neon.sc.ContractParam.hash160(memo),
  ]);
  const { execution } = await waitForLog(txid);
  if (execution.vmstate !== "HALT") {
    throw new Error(execution.exception || `GAS transfer failed for ${toHash}`);
  }
  return asTxid(txid);
}

async function transferNEO(toHash, amount, memo) {
  const txid = await neoContract.invoke("transfer", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.hash160(toHash),
    Neon.sc.ContractParam.integer(String(amount)),
    memo,
  ]);
  const { execution } = await waitForLog(txid);
  if (execution.vmstate !== "HALT") {
    throw new Error(execution.exception || `NEO transfer failed for ${toHash}`);
  }
  return asTxid(txid);
}

function findNotification(execution, contractHash, eventName) {
  const expected = String(contractHash).toLowerCase();
  return (execution.notifications || []).find(
    (entry) => String(entry.contract || "").toLowerCase() === expected && String(entry.eventname || "") === eventName
  );
}

async function waitForRequestStatus(requestId, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const request = await invokeRead(ORACLE_HASH, "getRequest", [{ type: "Integer", value: String(requestId) }]);
    if (Array.isArray(request) && String(request[8] || "0") !== "0") {
      return request;
    }
    await sleep(2000);
  }
  throw new Error(`timed out waiting for oracle request ${requestId}`);
}

async function waitForEnvelopeReady(contractHash, envelopeId, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const envelope = await invokeRead(contractHash, "getEnvelope", [{ type: "Integer", value: String(envelopeId) }]);
    if (Array.isArray(envelope) && envelope[7] === true) {
      return envelope;
    }
    await sleep(2000);
  }
  throw new Error(`timed out waiting for envelope ${envelopeId} to become ready`);
}

async function runDailyCheckin() {
  const contractHash = testnetHash("apps/daily-checkin/neo-manifest.json");
  const txid = await transferGAS(contractHash, DAILY_CHECKIN_FEE, "miniapp-dailycheckin:checkin");
  const { execution } = await waitForLog(txid);
  const checkedIn = findNotification(execution, contractHash, "CheckedIn");
  if (!checkedIn) {
    throw new Error("CheckedIn notification missing");
  }
  return { contractHash, txid };
}

async function runFogPlay() {
  const contractHash = testnetHash("apps/coin-flip/neo-manifest.json");
  const contract = new Neon.experimental.SmartContract(contractHash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });

  const transferTx = await transferGAS(contractHash, FOGPLAY_BET, "miniapp-coinflip:bet");
  await sleep(4000);
  const betTx = await contract.invoke("placeBet", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.integer(FOGPLAY_BET),
    Neon.sc.ContractParam.boolean(false),
    Neon.sc.ContractParam.integer("0"),
  ]);
  const { execution } = await waitForLog(betTx);
  if (execution.vmstate !== "HALT") {
    throw new Error(execution.exception || "placeBet failed");
  }

  const betPlaced = findNotification(execution, contractHash, "BetPlaced");
  const oracleRequested = findNotification(execution, ORACLE_HASH, "OracleRequested");
  if (!betPlaced || !oracleRequested) {
    throw new Error("BetPlaced or OracleRequested notification missing");
  }

  const betId = stackValue(oracleRequested.state?.value?.[0]) ? stackValue(betPlaced.state?.value?.[3]) : null;
  const requestId = stackValue(oracleRequested.state?.value?.[0]);
  const request = await waitForRequestStatus(requestId);
  const bet = await invokeRead(contractHash, "getBet", [{ type: "Integer", value: String(betId) }]);
  return { contractHash, transferTx, betTx: asTxid(betTx), requestId, request, betId, bet };
}

async function runRedEnvelope() {
  const contractHash = testnetHash("apps/red-envelope/neo-manifest.json");
  const contract = new Neon.experimental.SmartContract(contractHash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });

  const transferTx = await transferGAS(contractHash, RED_ENVELOPE_TOTAL, "miniapp-redenvelope:create");
  await sleep(4000);
  const createTx = await contract.invoke("createEnvelope", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.integer(RED_ENVELOPE_TOTAL),
    Neon.sc.ContractParam.integer("2"),
    Neon.sc.ContractParam.integer("86400"),
    Neon.sc.ContractParam.integer("0"),
  ]);
  const { execution } = await waitForLog(createTx);
  if (execution.vmstate !== "HALT") {
    throw new Error(execution.exception || "createEnvelope failed");
  }

  const created = findNotification(execution, contractHash, "EnvelopeCreated");
  const oracleRequested = findNotification(execution, ORACLE_HASH, "OracleRequested");
  if (!created || !oracleRequested) {
    throw new Error("EnvelopeCreated or OracleRequested notification missing");
  }

  const envelopeId = stackValue(created.state?.value?.[0]);
  const requestId = stackValue(oracleRequested.state?.value?.[0]);
  const request = await waitForRequestStatus(requestId);
  const envelope = await waitForEnvelopeReady(contractHash, envelopeId);

  const claimTx = await contract.invoke("claim", [
    Neon.sc.ContractParam.integer(String(envelopeId)),
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
  ]);
  const claimLog = await waitForLog(claimTx);
  if (claimLog.execution.vmstate !== "HALT") {
    throw new Error(claimLog.execution.exception || "claim failed");
  }
  const claimed = findNotification(claimLog.execution, contractHash, "EnvelopeClaimed");
  if (!claimed) {
    throw new Error("EnvelopeClaimed notification missing");
  }

  return {
    contractHash,
    transferTx,
    createTx: asTxid(createTx),
    requestId,
    envelopeId,
    request,
    envelope,
    claimTx: asTxid(claimTx),
  };
}

async function runSelfLoan() {
  const contractHash = testnetHash("apps/self-loan/neo-manifest.json");
  const contract = new Neon.experimental.SmartContract(contractHash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });

  const poolTx = await transferGAS(contractHash, SELF_LOAN_POOL_TOPUP, "miniapp-self-loan:pool");
  const collateralTx = await transferNEO(contractHash, SELF_LOAN_COLLATERAL, "miniapp-self-loan:collateral");
  await sleep(4000);

  const createTx = await contract.invoke("createLoan", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.integer(SELF_LOAN_COLLATERAL),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const { execution } = await waitForLog(createTx);
  if (execution.vmstate !== "HALT") {
    throw new Error(execution.exception || "createLoan failed");
  }
  const created = findNotification(execution, contractHash, "LoanCreated");
  if (!created) {
    throw new Error("LoanCreated notification missing");
  }
  const loanId = stackValue(created.state?.value?.[0]);
  const details = await invokeRead(contractHash, "getLoanDetails", [{ type: "Integer", value: String(loanId) }]);
  return {
    contractHash,
    poolTx,
    collateralTx,
    createTx: asTxid(createTx),
    loanId,
    details,
  };
}

async function main() {
  const summary = {
    generatedAt: new Date().toISOString(),
    rpcUrl: RPC_URL,
    address: account.address,
    oracleHash: ORACLE_HASH,
    results: {},
  };

  let failed = false;
  for (const [label, runner] of [
    ["dailyCheckin", runDailyCheckin],
    ["fogPlay", runFogPlay],
    ["redEnvelope", runRedEnvelope],
    ["selfLoan", runSelfLoan],
  ]) {
    try {
      summary.results[label] = { ok: true, ...(await runner()) };
    } catch (error) {
      failed = true;
      summary.results[label] = { ok: false, error: String(error?.message || error) };
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
