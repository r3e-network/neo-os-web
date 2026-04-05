#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  sleep,
  asTxid,
  stackValue,
  executionReturnedTrue,
  findNotification,
  createWaitForLog,
} = require("./lib/live_neo");
let Neon;

const RPC_URL = process.env.NEO_RPC_URL || "https://testnet1.neo.coz.io:443";
const NETWORK_MAGIC = Number(process.env.NEO_NETWORK_MAGIC || "894710606");
const ADMIN_WIF = process.env.TEST_SMOKE_ADMIN_WIF || process.env.MINIAPP_UPDATE_WIF || process.env.FLAGSHIP_LIVE_WIF || "";
const USER_WIF = process.env.TEST_SMOKE_USER_WIF || process.env.NEO_TESTNET_WIF || "";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const ROOT = path.resolve(__dirname, "../..");
const OUTPUT_PATH = path.join(ROOT, "docs", "reports", "2026-03-19-remaining-miniapp-live-smoke-part3.json");
const TARGET_FILTER = new Set(
  String(process.env.REMAINING_MINIAPP_SMOKE_TARGETS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

if (!ADMIN_WIF || !USER_WIF) {
  console.error("TEST_SMOKE_ADMIN_WIF and TEST_SMOKE_USER_WIF are required");
  process.exit(1);
}

const ADDRESSES = {
  govmerc: "0x93ff49acf2a4a5c0b23e8da0c209dd0a5ccf5c62",
  quadratic: "0x4c6cd496a8487ee4d4725751c1f2e7be2da23599",
  timecapsule: "0x0c6abb9ddeaceb55bb17f6d3c5a26d0814773489",
};

let admin;
let user;
let rpcClient;
let gasByAdmin;
let gasByUser;
let neoByAdmin;
let neoByUser;
const waitForLog = createWaitForLog({
  getApplicationLog: (txid) => rpcClient.getApplicationLog(txid),
  label: "live_validate_p3",
});

async function initNeon() {
  if (Neon) return;
  Neon = (await import("./lib/neon-compat.mjs")).default;
  admin = new Neon.wallet.Account(ADMIN_WIF);
  user = new Neon.wallet.Account(USER_WIF);
  rpcClient = new Neon.rpc.RPCClient(RPC_URL);
  gasByAdmin = new Neon.experimental.SmartContract(GAS_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
  gasByUser = new Neon.experimental.SmartContract(GAS_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: user });
  neoByAdmin = new Neon.experimental.SmartContract(NEO_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
  neoByUser = new Neon.experimental.SmartContract(NEO_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: user });
}

function appContract(hash, account) {
  return new Neon.experimental.SmartContract(hash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });
}

async function invokeRead(scriptHash, operation, args = []) {
  const res = await rpcClient.invokeFunction(scriptHash, operation, args);
  if (String(res?.state || "").toUpperCase() === "FAULT") {
    throw new Error(`${operation} faulted: ${res.exception || "unknown error"}`);
  }
  return res.stack?.[0] ? stackValue(res.stack[0]) : null;
}

async function transfer(contract, fromAccount, toHash, amount, memo) {
  const txid = await contract.invoke("transfer", [
    Neon.sc.ContractParam.hash160(`0x${fromAccount.scriptHash}`),
    Neon.sc.ContractParam.hash160(toHash),
    Neon.sc.ContractParam.integer(String(amount)),
    memo == null
      ? Neon.sc.ContractParam.any(null)
      : typeof memo === "string"
        ? Neon.sc.ContractParam.string(memo)
        : Neon.sc.ContractParam.byteArray(Buffer.from(memo).toString("base64")),
  ]);
  const { execution } = await waitForLog(txid);
  if (execution.vmstate !== "HALT" || !executionReturnedTrue(execution)) {
    throw new Error(execution.exception || `transfer failed for ${toHash}`);
  }
  return asTxid(txid);
}

function uniqueLabel(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function runGovMerc() {
  const hash = ADDRESSES.govmerc;
  const adminContract = appContract(hash, admin);
  const userContract = appContract(hash, user);
  let epochId = String(await invokeRead(hash, "getCurrentEpochId"));
  let epoch = await invokeRead(hash, "getEpoch", [{ type: "Integer", value: epochId }]);
  const now = Date.now();
  if ((Array.isArray(epoch) && BigInt(String(epoch[2] || "0")) <= BigInt(String(now))) || (Array.isArray(epoch) && epoch[7] === true)) {
    const settleTx = await adminContract.invoke("settleEpoch", []);
    const settleLog = await waitForLog(settleTx);
    if (settleLog.execution.vmstate !== "HALT") throw new Error(settleLog.execution.exception || "settleEpoch failed");
    epochId = String(await invokeRead(hash, "getCurrentEpochId"));
    epoch = await invokeRead(hash, "getEpoch", [{ type: "Integer", value: epochId }]);
  }
  const preloadTx = await transfer(neoByUser, user, hash, "1", null);
  const depositTx = await userContract.invoke("depositNeo", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const depositLog = await waitForLog(depositTx);
  if (depositLog.execution.vmstate !== "HALT") throw new Error(depositLog.execution.exception || "depositNeo failed");

  epochId = String(await invokeRead(hash, "getCurrentEpochId"));
  epoch = await invokeRead(hash, "getEpoch", [{ type: "Integer", value: epochId }]);
  const refreshedNow = Date.now();
  if ((Array.isArray(epoch) && BigInt(String(epoch[2] || "0")) <= BigInt(String(refreshedNow))) || (Array.isArray(epoch) && epoch[7] === true)) {
    const settleTx = await adminContract.invoke("settleEpoch", []);
    const settleLog = await waitForLog(settleTx);
    if (settleLog.execution.vmstate !== "HALT") throw new Error(settleLog.execution.exception || "settleEpoch after deposit failed");
    epochId = String(await invokeRead(hash, "getCurrentEpochId"));
  }

  await transfer(gasByAdmin, admin, hash, "10000000", "miniapp-gov-merc:bid");
  const bidTx = await adminContract.invoke("placeBid", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer("10000000"),
  ]);
  const bidLog = await waitForLog(bidTx);
  if (bidLog.execution.vmstate !== "HALT") throw new Error(bidLog.execution.exception || "placeBid failed");

  const bid = await invokeRead(hash, "getUserBid", [
    { type: "Integer", value: epochId },
    { type: "Hash160", value: `0x${admin.scriptHash}` },
  ]);
  const deposit = await invokeRead(hash, "getDepositRaw", [{ type: "Hash160", value: `0x${user.scriptHash}` }]);
  return { contractHash: hash, epochId, preloadTx, depositTx: asTxid(depositTx), bidTx: asTxid(bidTx), bid, deposit };
}

async function runQuadratic() {
  const hash = ADDRESSES.quadratic;
  const adminContract = appContract(hash, admin);
  const userContract = appContract(hash, user);
  const now = Date.now();
  const startTime = now - 60_000;
  const endTime = now + 90_000;
  await transfer(gasByAdmin, admin, hash, "20000000", "miniapp-quadratic-funding:create-round");

  const createTx = await adminContract.invoke("createRound", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.hash160(GAS_HASH),
    Neon.sc.ContractParam.integer("20000000"),
    Neon.sc.ContractParam.integer(String(startTime)),
    Neon.sc.ContractParam.integer(String(endTime)),
    Neon.sc.ContractParam.string(uniqueLabel("QF Round")),
    Neon.sc.ContractParam.string("codex quadratic round"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createRound failed");
  const roundId = String(stackValue(findNotification(createLog.execution, hash, "RoundCreated")?.state?.value?.[0]));

  const projectTx = await userContract.invoke("registerProject", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer(roundId),
    Neon.sc.ContractParam.string(uniqueLabel("Project")),
    Neon.sc.ContractParam.string("codex public good"),
    Neon.sc.ContractParam.string("https://example.com"),
  ]);
  const projectLog = await waitForLog(projectTx);
  if (projectLog.execution.vmstate !== "HALT") throw new Error(projectLog.execution.exception || "registerProject failed");
  const projectId = String(stackValue(findNotification(projectLog.execution, hash, "ProjectRegistered")?.state?.value?.[0]));

  await transfer(gasByUser, user, hash, "10000000", "miniapp-quadratic-funding:contribute");
  const contributeTx = await userContract.invoke("contribute", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer(roundId),
    Neon.sc.ContractParam.integer(projectId),
    Neon.sc.ContractParam.integer("10000000"),
    Neon.sc.ContractParam.string("codex contribution"),
  ]);
  const contributeLog = await waitForLog(contributeTx);
  if (contributeLog.execution.vmstate !== "HALT") throw new Error(contributeLog.execution.exception || "contribute failed");

  await sleep(95000);
  const finalizeTx = await adminContract.invoke("finalizeRound", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(roundId),
    { type: "Array", value: [{ type: "Integer", value: projectId }] },
    { type: "Array", value: [{ type: "Integer", value: "5000000" }] },
  ]);
  const finalizeLog = await waitForLog(finalizeTx);
  if (finalizeLog.execution.vmstate !== "HALT") throw new Error(finalizeLog.execution.exception || "finalizeRound failed");

  const claimTx = await userContract.invoke("claimProject", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer(projectId),
  ]);
  const claimLog = await waitForLog(claimTx);
  if (claimLog.execution.vmstate !== "HALT") throw new Error(claimLog.execution.exception || "claimProject failed");
  return { contractHash: hash, roundId, projectId, createTx: asTxid(createTx), projectTx: asTxid(projectTx), contributeTx: asTxid(contributeTx), finalizeTx: asTxid(finalizeTx), claimTx: asTxid(claimTx) };
}

async function runTimeCapsule() {
  if (admin.address === user.address) {
    console.warn("timecapsule: TEST_SMOKE_ADMIN_WIF and TEST_SMOKE_USER_WIF resolved to the same address. Skipping test.");
    return { skipped: true, reason: "same address" };
  }
  const hash = ADDRESSES.timecapsule;
  const adminContract = appContract(hash, admin);
  const unlockTime = Date.now() + 2 * 86400 * 1000;
  await transfer(gasByAdmin, admin, hash, "45000000", "miniapp-time-capsule:lifecycle");

  const buryTx = await adminContract.invoke("bury", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.string(crypto.randomUUID ? crypto.randomUUID() : uniqueLabel("capsule")),
    Neon.sc.ContractParam.string(uniqueLabel("Capsule")),
    Neon.sc.ContractParam.integer(String(unlockTime)),
    Neon.sc.ContractParam.boolean(false),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const buryLog = await waitForLog(buryTx);
  if (buryLog.execution.vmstate !== "HALT") throw new Error(buryLog.execution.exception || "bury failed");
  const buried = findNotification(buryLog.execution, hash, "CapsuleBuried");
  const capsuleId = String(stackValue(buried?.state?.value?.[1]));

  const addRecipientTx = await adminContract.invoke("addRecipient", [
    Neon.sc.ContractParam.integer(capsuleId),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
  ]);
  const addRecipientLog = await waitForLog(addRecipientTx);
  if (addRecipientLog.execution.vmstate !== "HALT") throw new Error(addRecipientLog.execution.exception || "addRecipient failed");

  const extendTx = await adminContract.invoke("extendUnlockTime", [
    Neon.sc.ContractParam.integer(capsuleId),
    Neon.sc.ContractParam.integer(String(unlockTime + 86400 * 1000)),
  ]);
  const extendLog = await waitForLog(extendTx);
  if (extendLog.execution.vmstate !== "HALT") throw new Error(extendLog.execution.exception || "extendUnlockTime failed");

  const giftTx = await adminContract.invoke("giftCapsule", [
    Neon.sc.ContractParam.integer(capsuleId),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
  ]);
  const giftLog = await waitForLog(giftTx);
  if (giftLog.execution.vmstate !== "HALT") throw new Error(giftLog.execution.exception || "giftCapsule failed");
  return { contractHash: hash, capsuleId, buryTx: asTxid(buryTx), addRecipientTx: asTxid(addRecipientTx), extendTx: asTxid(extendTx), giftTx: asTxid(giftTx) };
}

async function runAll() {
  await initNeon();
  const results = {};
  const tasks = [
    ["govmerc", runGovMerc],
    ["quadratic", runQuadratic],
    ["timecapsule", runTimeCapsule],
  ];
  for (const [name, fn] of tasks) {
    if (TARGET_FILTER.size > 0 && !TARGET_FILTER.has(name)) continue;
    process.stdout.write(`\n=== ${name} ===\n`);
    try {
      results[name] = { status: "pass", details: await fn() };
      process.stdout.write(`PASS ${name}\n`);
    } catch (error) {
      results[name] = { status: "fail", error: String(error?.message || error) };
      process.stdout.write(`FAIL ${name}: ${results[name].error}\n`);
    }
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    rpcUrl: RPC_URL,
    adminAddress: admin.address,
    userAddress: user.address,
    results,
  }, null, 2) + "\n");
  const failed = Object.entries(results).filter(([, value]) => value.status !== "pass");
  console.log(`\nReport: ${OUTPUT_PATH}`);
  if (failed.length > 0) {
    console.error(`Failures: ${failed.map(([name]) => name).join(", ")}`);
    process.exit(1);
  }
}

runAll().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
