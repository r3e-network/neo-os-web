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
const PAYMENT_HUB_HASH = "0x340cb33d770b38f26d066716dd1f9df5283d629e";

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
    memo == null ? Neon.sc.ContractParam.any(null) : typeof memo === "string" ? memo : Neon.sc.ContractParam.hash160(memo),
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

async function getOracleRequestFee() {
  const fee = await invokeRead(ORACLE_HASH, "requestFee");
  return String(fee || "1000000");
}

async function topUpOracleCallbackCredit(callbackContractHash) {
  const fee = await getOracleRequestFee();
  const cleanHash = String(callbackContractHash || "").replace(/^0x/i, "");
  const callbackBytes = Buffer.from(cleanHash, "hex").reverse();
  const txid = await gasContract.invoke("transfer", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.hash160(ORACLE_HASH),
    Neon.sc.ContractParam.integer(String(fee)),
    Neon.sc.ContractParam.byteArray(callbackBytes.toString("base64")),
  ]);
  const { execution } = await waitForLog(txid);
  if (execution.vmstate !== "HALT") {
    throw new Error(execution.exception || "oracle fee top-up failed");
  }
  return asTxid(txid);
}

async function findPlayableGasBoxMachine(contractHash) {
  const total = Number(await invokeRead(contractHash, "totalMachines"));
  for (let machineId = 1; machineId <= total; machineId += 1) {
    const machine = await invokeRead(contractHash, "getMachine", [{ type: "Integer", value: String(machineId) }]);
    if (!machine || machine.active !== true) continue;
    const itemCount = Number(machine.itemCount || 0);
    if (itemCount <= 0) continue;
    const item = await invokeRead(contractHash, "getMachineItem", [
      { type: "Integer", value: String(machineId) },
      { type: "Integer", value: "1" },
    ]);
    if (!item || String(item.assetType || "0") !== "1") continue;
    if (String(item.assetHash || "").toLowerCase() !== GAS_HASH.toLowerCase()) continue;
    if (BigInt(String(item.stock || "0")) < BigInt(String(item.amount || "0"))) continue;
    return { machineId, machine, item };
  }
  throw new Error("no active GASBOX machine with funded GAS prize inventory found");
}

async function provisionGasBoxMachine(contractHash) {
  const contract = new Neon.experimental.SmartContract(contractHash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });
  const machineName = `Codex Live Box ${Date.now()}`;
  const createTx = await contract.invoke("createMachine", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.string(machineName),
    Neon.sc.ContractParam.string("Live validation machine"),
    Neon.sc.ContractParam.string("games"),
    Neon.sc.ContractParam.string("gasbox,validation"),
    Neon.sc.ContractParam.integer("10000000"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") {
    throw new Error(createLog.execution.exception || "createMachine failed");
  }
  const created = findNotification(createLog.execution, contractHash, "MachineCreated");
  if (!created) throw new Error("MachineCreated notification missing");
  const machineId = Number(stackValue(created.state?.value?.[1]));

  const addItemTx = await contract.invoke("addMachineItem", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.integer(String(machineId)),
    Neon.sc.ContractParam.string("Small GAS Prize"),
    Neon.sc.ContractParam.integer("100"),
    Neon.sc.ContractParam.string("COMMON"),
    Neon.sc.ContractParam.integer("1"),
    Neon.sc.ContractParam.hash160(GAS_HASH),
    Neon.sc.ContractParam.integer("1000000"),
    Neon.sc.ContractParam.string(""),
  ]);
  const addItemLog = await waitForLog(addItemTx);
  if (addItemLog.execution.vmstate !== "HALT") {
    throw new Error(addItemLog.execution.exception || "addMachineItem failed");
  }

  const fundTx = await transferGAS(contractHash, "5000000", null);
  await sleep(4000);
  const depositTx = await contract.invoke("depositItem", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.integer(String(machineId)),
    Neon.sc.ContractParam.integer("1"),
    Neon.sc.ContractParam.integer("5000000"),
  ]);
  const depositLog = await waitForLog(depositTx);
  if (depositLog.execution.vmstate !== "HALT") {
    throw new Error(depositLog.execution.exception || "depositItem failed");
  }

  const activateTx = await contract.invoke("setMachineActiveWithValidation", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.integer(String(machineId)),
    Neon.sc.ContractParam.boolean(true),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const activateLog = await waitForLog(activateTx);
  if (activateLog.execution.vmstate !== "HALT") {
    throw new Error(activateLog.execution.exception || "setMachineActiveWithValidation failed");
  }

  const machine = await invokeRead(contractHash, "getMachine", [{ type: "Integer", value: String(machineId) }]);
  const item = await invokeRead(contractHash, "getMachineItem", [
    { type: "Integer", value: String(machineId) },
    { type: "Integer", value: "1" },
  ]);
  return { machineId, machine, item, createTx: asTxid(createTx), fundTx, depositTx: asTxid(depositTx), activateTx: asTxid(activateTx) };
}

async function runGasBox() {
  const contractHash = testnetHash("apps/gasbox/neo-manifest.json");
  const contract = new Neon.experimental.SmartContract(contractHash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });

  let provisioned = null;
  let playable;
  try {
    playable = await findPlayableGasBoxMachine(contractHash);
  } catch {
    provisioned = await provisionGasBoxMachine(contractHash);
    playable = { machineId: provisioned.machineId, machine: provisioned.machine };
  }
  const { machineId, machine } = playable;
  const playPrice = String(machine.price || "0");
  if (!playPrice || playPrice === "0") {
    throw new Error(`invalid GASBOX machine price for machine ${machineId}`);
  }

  const transferTx = await transferGAS(contractHash, playPrice, `miniapp-gasbox:play:${machineId}`);
  await sleep(4000);

  const initiateTx = await contract.invoke("initiatePlay", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.integer(String(machineId)),
    Neon.sc.ContractParam.integer("0"),
  ]);
  const initiateLog = await waitForLog(initiateTx);
  if (initiateLog.execution.vmstate !== "HALT") {
    throw new Error(initiateLog.execution.exception || "initiatePlay failed");
  }

  const initiated = findNotification(initiateLog.execution, contractHash, "PlayInitiated");
  if (!initiated) {
    throw new Error("PlayInitiated notification missing");
  }
  const playId = stackValue(initiated.state?.value?.[2]);
  const selectedIndex = await invokeRead(contractHash, "debugExpectedSelection", [
    { type: "Integer", value: String(playId) },
  ]);

  const settleTx = await contract.invoke("settlePlay", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.integer(String(playId)),
    Neon.sc.ContractParam.integer(String(selectedIndex)),
  ]);
  const settleLog = await waitForLog(settleTx);
  if (settleLog.execution.vmstate !== "HALT") {
    throw new Error(settleLog.execution.exception || "settlePlay failed");
  }

  const resolved = findNotification(settleLog.execution, contractHash, "PlayResolved");
  if (!resolved) {
    throw new Error("PlayResolved notification missing");
  }

  const play = await invokeRead(contractHash, "getPlay", [{ type: "Integer", value: String(playId) }]);
  return {
    contractHash,
    machineId,
    provisioned,
    transferTx,
    initiateTx: asTxid(initiateTx),
    playId,
    selectedIndex,
    settleTx: asTxid(settleTx),
    play,
  };
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

async function runLastSurvivor() {
  const contractHash = testnetHash("apps/last-survivor/neo-manifest.json");
  const contract = new Neon.experimental.SmartContract(contractHash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });

  const startRound = async () => {
    const tx = await contract.invoke("startNewRound", []);
    const { execution } = await waitForLog(tx);
    if (execution.vmstate !== "HALT") {
      throw new Error(execution.exception || "startNewRound failed");
    }
    const started = findNotification(execution, contractHash, "RoundStarted");
    if (!started) throw new Error("RoundStarted notification missing");
    return { roundId: String(stackValue(started.state?.value?.[0])), txid: asTxid(tx) };
  };

  const attemptBuy = async (roundId) => {
    const refreshed = await invokeRead(contractHash, "getGameStatus");
    const totalKeys = BigInt(String(refreshed.totalKeys || "0"));
    const basePrice = 10000000n;
    const commonDiff = (basePrice * 10n) / 10000n;
    const cost = basePrice + totalKeys * commonDiff;

    const paymentTx = await transferGAS(PAYMENT_HUB_HASH, String(cost), "miniapp-last-survivor");
    const paymentLog = await waitForLog(paymentTx);
    const receipt = findNotification(paymentLog.execution, PAYMENT_HUB_HASH, "PaymentReceived");
    if (!receipt) throw new Error("PaymentReceived notification missing");
    const receiptId = stackValue(receipt.state?.value?.[0]);

    const buyTx = await contract.invoke("buyKeysWithCost", [
      Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
      Neon.sc.ContractParam.integer("1"),
      Neon.sc.ContractParam.integer(String(cost)),
      Neon.sc.ContractParam.integer(String(receiptId)),
    ]);
    const { execution } = await waitForLog(buyTx);
    if (execution.vmstate !== "HALT") {
      throw new Error(execution.exception || "buyKeysWithCost failed");
    }
    return {
      cost: String(cost),
      paymentTx,
      receiptId,
      buyTx: asTxid(buyTx),
      purchased: !!findNotification(execution, contractHash, "KeysPurchased"),
      extended: !!findNotification(execution, contractHash, "TimeExtended"),
      settled: !!findNotification(execution, contractHash, "DoomsdayWinner"),
    };
  };

  const status = await invokeRead(contractHash, "getGameStatus");
  let roundId = String(status.roundId || "0");
  let startTx = "";
  if (status.active !== true) {
    const started = await startRound();
    roundId = started.roundId;
    startTx = started.txid;
  }

  let result = await attemptBuy(roundId);
  if (!result.purchased || !result.extended) {
    const started = await startRound();
    roundId = started.roundId;
    startTx = startTx || started.txid;
    result = await attemptBuy(roundId);
  }

  if (!result.purchased || !result.extended) {
    throw new Error("KeysPurchased or TimeExtended notification missing");
  }

  const after = await invokeRead(contractHash, "getGameStatus");
  const userKeys = await invokeRead(contractHash, "getPlayerKeys", [
    { type: "Hash160", value: `0x${account.scriptHash}` },
    { type: "Integer", value: String(roundId) },
  ]);
  return {
    contractHash,
    startTx,
    roundId,
    cost: result.cost,
    paymentTx: result.paymentTx,
    receiptId: result.receiptId,
    buyTx: result.buyTx,
    after,
    userKeys,
  };
}

async function runFogPlay() {
  const contractHash = testnetHash("apps/fogplay/neo-manifest.json");
  const contract = new Neon.experimental.SmartContract(contractHash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });

  const oracleFeeTx = await topUpOracleCallbackCredit(contractHash);
  const transferTx = await transferGAS(contractHash, FOGPLAY_BET, "miniapp-fogplay:bet");
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
  return { contractHash, oracleFeeTx, transferTx, betTx: asTxid(betTx), requestId, request, betId, bet };
}

async function runRedEnvelope() {
  const contractHash = testnetHash("apps/red-envelope/neo-manifest.json");
  const contract = new Neon.experimental.SmartContract(contractHash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });

  const oracleFeeTx = await topUpOracleCallbackCredit(contractHash);
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
    oracleFeeTx,
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

async function runNeoPay() {
  const contractHash = testnetHash("apps/neo-pay/neo-manifest.json");
  const contract = new Neon.experimental.SmartContract(contractHash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });

  const fundTx = await transferGAS(contractHash, "100000000", null);
  await sleep(4000);

  const createTx = await contract.invoke("createStream", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.hash160(GAS_HASH),
    Neon.sc.ContractParam.integer("100000000"),
    Neon.sc.ContractParam.integer("100000000"),
    Neon.sc.ContractParam.integer("86400"),
    Neon.sc.ContractParam.string("Codex Payroll Smoke"),
    Neon.sc.ContractParam.string("testnet validation stream"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") {
    throw new Error(createLog.execution.exception || "createStream failed");
  }
  const created = findNotification(createLog.execution, contractHash, "StreamCreated");
  if (!created) throw new Error("StreamCreated notification missing");
  const streamId = stackValue(created.state?.value?.[0]);
  const detailsBefore = await invokeRead(contractHash, "getStreamDetails", [{ type: "Integer", value: String(streamId) }]);

  const claimSimulation = await rpcClient.execute(new Neon.rpc.Query({
    method: "invokefunction",
    params: [
      contractHash,
      "claimStream",
      [
        { type: "Hash160", value: `0x${account.scriptHash}` },
        { type: "Integer", value: String(streamId) },
      ],
      [{ account: account.scriptHash, scopes: "CalledByEntry" }],
    ],
  }));

  const cancelTx = await contract.invoke("cancelStream", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.integer(String(streamId)),
  ]);
  const cancelLog = await waitForLog(cancelTx);
  if (cancelLog.execution.vmstate !== "HALT") {
    throw new Error(cancelLog.execution.exception || "cancelStream failed");
  }
  const cancelled = findNotification(cancelLog.execution, contractHash, "StreamCancelled");
  if (!cancelled) throw new Error("StreamCancelled notification missing");

  const detailsAfter = await invokeRead(contractHash, "getStreamDetails", [{ type: "Integer", value: String(streamId) }]);
  return {
    contractHash,
    fundTx,
    createTx: asTxid(createTx),
    streamId,
    cancelTx: asTxid(cancelTx),
    claimSimulationState: claimSimulation.state,
    claimSimulationError: claimSimulation.exception || null,
    detailsBefore,
    detailsAfter,
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
    ["lastSurvivor", runLastSurvivor],
    ["gasBox", runGasBox],
    ["fogPlay", runFogPlay],
    ["redEnvelope", runRedEnvelope],
    ["selfLoan", runSelfLoan],
    ["neoPay", runNeoPay],
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
