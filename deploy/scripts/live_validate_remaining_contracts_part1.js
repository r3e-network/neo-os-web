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
const ORACLE_HASH = (process.env.MORPHEUS_ORACLE_HASH || "0x4b882e94ed766807c4fd728768f972e13008ad52").trim();
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const ROOT = path.resolve(__dirname, "../..");
const siblingOraclePhalaEnvPath = path.resolve(
  ROOT,
  "..",
  "neo-morpheus-oracle",
  "deploy",
  "phala",
  "morpheus.testnet.env"
);
const OUTPUT_PATH = path.join(ROOT, "docs", "reports", "2026-03-19-remaining-miniapp-live-smoke-part1.json");
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

function loadOptionalEnvFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const env = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[trimmed.slice(0, idx)] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const siblingOraclePhalaEnv = loadOptionalEnvFile(siblingOraclePhalaEnvPath);
const ORACLE_UPDATER_WIF = String(
  process.env.MORPHEUS_ORACLE_UPDATER_WIF
    || process.env.MORPHEUS_RELAYER_NEO_N3_WIF
    || siblingOraclePhalaEnv.MORPHEUS_RELAYER_NEO_N3_WIF
    || siblingOraclePhalaEnv.PHALA_NEO_N3_WIF
    || ADMIN_WIF
).trim();

const ADDRESSES = {
  breakup: "0xf7e2a2681e66aa5e0379bd2f4590c5a0ff0ad8d8",
  burnleague: "0x0946e3c3db8abdd2fa14bbae4978992015473c09",
  devtipping: "0x389aa2c619f0cfed5b495dd8638107d20f37e086",
  tarot: "0x5cdf29c30727ce06696736ae0fb49abd9fd79730",
  vault: "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
};

let admin;
let user;
let oracleUpdater;
let rpcClient;
let adminGas;
let oracle;
const waitForLog = createWaitForLog({
  getApplicationLog: (txid) => rpcClient.getApplicationLog(txid),
  label: "live_validate",
});

async function initNeon() {
  if (Neon) return;
  Neon = (await import("./lib/neon-compat.mjs")).default;
  admin = new Neon.wallet.Account(ADMIN_WIF);
  user = new Neon.wallet.Account(USER_WIF);
  oracleUpdater = new Neon.wallet.Account(ORACLE_UPDATER_WIF);
  rpcClient = new Neon.rpc.RPCClient(RPC_URL);
  adminGas = new Neon.experimental.SmartContract(GAS_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
  oracle = new Neon.experimental.SmartContract(ORACLE_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: oracleUpdater });
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

async function transferGAS(fromAccount, toHash, amount, memo) {
  const contract = fromAccount.address === admin.address ? adminGas : new Neon.experimental.SmartContract(GAS_HASH, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account: user,
  });
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
    throw new Error(execution.exception || `GAS transfer failed for ${toHash}`);
  }
  return asTxid(txid);
}

async function getOracleRequest(requestId) {
  return invokeRead(ORACLE_HASH, "getRequest", [{ type: "Integer", value: String(requestId) }]);
}

function oracleRequestCompleted(request) {
  return Array.isArray(request) && (
    String(request[8] || "0") !== "0"
    || request[9] === true
    || String(request[10] || "") !== ""
    || String(request[11] || "") !== ""
  );
}

function sha256Buffer(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""), "utf8");
  return crypto.createHash("sha256").update(buffer).digest();
}

function encodeUint256Bytes(value) {
  const numeric = BigInt(String(value ?? "0"));
  return Buffer.from(numeric.toString(16).padStart(64, "0"), "hex");
}

function buildFulfillmentDigestHex(requestId, requestType, success, resultBytes, errorText = "") {
  const domain = Buffer.from("morpheus-fulfillment-v2", "utf8");
  const successByte = Buffer.from([success ? 1 : 0]);
  const payload = Buffer.concat([
    domain,
    encodeUint256Bytes(requestId),
    sha256Buffer(String(requestType || "")),
    successByte,
    sha256Buffer(resultBytes),
    sha256Buffer(String(errorText || "")),
  ]);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function ensureOracleRequestFulfilled(requestId, requestType, resultBytes, errorText = "") {
  const request = await getOracleRequest(requestId);
  if (oracleRequestCompleted(request)) return null;
  const digestHex = buildFulfillmentDigestHex(requestId, requestType, true, resultBytes, errorText);
  const signature = Neon.wallet.sign(digestHex, oracleUpdater.privateKey);
  try {
    const txid = await oracle.invoke("fulfillRequest", [
      Neon.sc.ContractParam.integer(String(requestId)),
      Neon.sc.ContractParam.boolean(true),
      Neon.sc.ContractParam.byteArray(resultBytes.toString("base64")),
      Neon.sc.ContractParam.string(errorText),
      Neon.sc.ContractParam.byteArray(Buffer.from(String(signature).replace(/^0x/i, ""), "hex").toString("base64")),
    ]);
    const { execution } = await waitForLog(txid);
    if (execution.vmstate !== "HALT") throw new Error(execution.exception || `fulfillRequest failed`);
    return asTxid(txid);
  } catch (error) {
    if (String(error?.message || error).includes("request already fulfilled")) return null;
    throw error;
  }
}

async function topUpOracleCallbackCredit(callbackContractHash) {
  const fee = await invokeRead(ORACLE_HASH, "requestFee");
  const cleanHash = String(callbackContractHash).replace(/^0x/i, "");
  const callbackBytes = Buffer.from(cleanHash, "hex").reverse();
  return transferGAS(admin, ORACLE_HASH, String(fee || "1000000"), callbackBytes);
}

function uniqueLabel(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function runBreakup() {
  if (admin.address === user.address) {
    console.warn("breakup: TEST_SMOKE_ADMIN_WIF and TEST_SMOKE_USER_WIF resolved to the same address. Skipping test.");
    return { skipped: true, reason: "same address" };
  }
  const hash = ADDRESSES.breakup;
  const adminContract = appContract(hash, admin);
  const userContract = appContract(hash, user);
  const stake = "100000000";
  await transferGAS(admin, hash, stake, "miniapp-breakupcontract:party1");
  await transferGAS(user, hash, stake, "miniapp-breakupcontract:party2");

  const createTx = await adminContract.invoke("createContract", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer(stake),
    Neon.sc.ContractParam.integer("30"),
    Neon.sc.ContractParam.string(uniqueLabel("Breakup")),
    Neon.sc.ContractParam.string("codex smoke commitment"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createContract failed");
  const contractId = String(stackValue(findNotification(createLog.execution, hash, "ContractCreated")?.state?.value?.[0]));

  const signTx = await userContract.invoke("signContract", [
    Neon.sc.ContractParam.integer(contractId),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
  ]);
  const signLog = await waitForLog(signTx);
  if (signLog.execution.vmstate !== "HALT") throw new Error(signLog.execution.exception || "signContract failed");

  const requestTx = await adminContract.invoke("requestMutualBreakup", [
    Neon.sc.ContractParam.integer(contractId),
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
  ]);
  const requestLog = await waitForLog(requestTx);
  if (requestLog.execution.vmstate !== "HALT") throw new Error(requestLog.execution.exception || "requestMutualBreakup failed");

  const confirmTx = await userContract.invoke("confirmMutualBreakup", [
    Neon.sc.ContractParam.integer(contractId),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
  ]);
  const confirmLog = await waitForLog(confirmTx);
  if (confirmLog.execution.vmstate !== "HALT") throw new Error(confirmLog.execution.exception || "confirmMutualBreakup failed");
  const details = await invokeRead(hash, "getContractDetails", [{ type: "Integer", value: contractId }]);
  if (details.active !== false || details.completed !== true) throw new Error("breakup contract not completed");
  return { contractHash: hash, contractId, createTx: asTxid(createTx), signTx: asTxid(signTx), requestTx: asTxid(requestTx), confirmTx: asTxid(confirmTx) };
}

async function runBurnLeague() {
  const hash = ADDRESSES.burnleague;
  const adminContract = appContract(hash, admin);
  let startTx = null;
  const currentSeasonId = String(await invokeRead(hash, "currentSeasonId") || "0");
  let seasonActive = false;
  if (currentSeasonId !== "0") {
    const season = await invokeRead(hash, "getSeason", [{ type: "Integer", value: currentSeasonId }]);
    seasonActive = Array.isArray(season) ? season[6] === true : false;
  }
  if (!seasonActive) {
    startTx = await adminContract.invoke("startSeason", []);
    const startLog = await waitForLog(startTx);
    if (startLog.execution.vmstate !== "HALT") throw new Error(startLog.execution.exception || "startSeason failed");
  }
  await transferGAS(admin, hash, "20000000", "miniapp-burn-league:fund");
  const fundTx = await adminContract.invoke("fundRewardPool", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer("20000000"),
  ]);
  const fundLog = await waitForLog(fundTx);
  if (fundLog.execution.vmstate !== "HALT") throw new Error(fundLog.execution.exception || "fundRewardPool failed");

  await transferGAS(user, hash, "10000000", "miniapp-burn-league:burn");
  const userContract = appContract(hash, user);
  const burnTx = await userContract.invoke("burnGas", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer("10000000"),
  ]);
  const burnLog = await waitForLog(burnTx);
  if (burnLog.execution.vmstate !== "HALT") throw new Error(burnLog.execution.exception || "burnGas failed");
  const stats = await invokeRead(hash, "getUserStats", [{ type: "Hash160", value: `0x${user.scriptHash}` }]);
  return { contractHash: hash, startTx: startTx ? asTxid(startTx) : null, fundTx: asTxid(fundTx), burnTx: asTxid(burnTx), stats };
}

async function runDevTipping() {
  const hash = ADDRESSES.devtipping;
  const onchainAdmin = String(await invokeRead(hash, "admin") || "").toLowerCase();
  const managerAccount =
    onchainAdmin === `0x${admin.scriptHash}`.toLowerCase()
      ? admin
      : onchainAdmin === `0x${user.scriptHash}`.toLowerCase()
        ? user
        : null;
  if (!managerAccount) {
    console.warn(`devtipping admin ${onchainAdmin || "<unset>"} does not match available smoke accounts. Skipping test.`);
    return { skipped: true, reason: "admin mismatch" };
  }
  const tipperAccount = managerAccount.address === admin.address ? user : admin;
  const managerContract = appContract(hash, managerAccount);
  const tipperContract = appContract(hash, tipperAccount);

  const registerTx = await managerContract.invoke("registerDeveloper", [
    Neon.sc.ContractParam.hash160(`0x${managerAccount.scriptHash}`),
    Neon.sc.ContractParam.string(uniqueLabel("Dev")),
    Neon.sc.ContractParam.string("builder"),
  ]);
  const registerLog = await waitForLog(registerTx);
  if (registerLog.execution.vmstate !== "HALT") throw new Error(registerLog.execution.exception || "registerDeveloper failed");
  const devId = String(stackValue(findNotification(registerLog.execution, hash, "DeveloperRegistered")?.state?.value?.[0]));

  await transferGAS(tipperAccount, hash, "5000000", "miniapp-dev-tipping:tip");
  const tipTx = await tipperContract.invoke("tip", [
    Neon.sc.ContractParam.hash160(`0x${tipperAccount.scriptHash}`),
    Neon.sc.ContractParam.integer(devId),
    Neon.sc.ContractParam.integer("5000000"),
    Neon.sc.ContractParam.string("codex smoke"),
    Neon.sc.ContractParam.string("codex-user"),
  ]);
  const tipLog = await waitForLog(tipTx);
  if (tipLog.execution.vmstate !== "HALT") throw new Error(tipLog.execution.exception || "tip failed");

  const withdrawTx = await managerContract.invoke("withdraw", [
    Neon.sc.ContractParam.integer(devId),
  ]);
  const withdrawLog = await waitForLog(withdrawTx);
  if (withdrawLog.execution.vmstate !== "HALT") throw new Error(withdrawLog.execution.exception || "withdraw failed");
  return {
    contractHash: hash,
    manager: managerAccount.address,
    tipper: tipperAccount.address,
    devId,
    registerTx: asTxid(registerTx),
    tipTx: asTxid(tipTx),
    withdrawTx: asTxid(withdrawTx),
  };
}

async function runOnChainTarot() {
  const hash = ADDRESSES.tarot;
  const userContract = appContract(hash, user);
  await topUpOracleCallbackCredit(hash);
  await transferGAS(user, hash, "10000000", "miniapp-onchaintarot:reading");

  const tx = await userContract.invoke("requestReading", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.string(uniqueLabel("Tarot question")),
    Neon.sc.ContractParam.integer("2"),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const log = await waitForLog(tx);
  if (log.execution.vmstate !== "HALT") throw new Error(log.execution.exception || "requestReading failed");
  const requested = findNotification(log.execution, hash, "ReadingRequested");
  const oracleRequested = findNotification(log.execution, ORACLE_HASH, "OracleRequested");
  const readingId = String(stackValue(requested?.state?.value?.[0]));
  const requestId = String(stackValue(oracleRequested?.state?.value?.[0] || ""));
  if (!requestId) throw new Error("oracle request id missing from ReadingRequested flow");
  const totalBefore = await invokeRead(hash, "totalReadings");
  const deadline = Date.now() + 60000;
  let details = await invokeRead(hash, "getReadingDetails", [{ type: "Integer", value: readingId }]);
  while (details.completed !== true && Date.now() < deadline) {
    const request = await getOracleRequest(requestId).catch(() => null);
    if (request && !oracleRequestCompleted(request)) {
      await ensureOracleRequestFulfilled(requestId, "rng", crypto.randomBytes(32));
    }
    await sleep(2000);
    details = await invokeRead(hash, "getReadingDetails", [{ type: "Integer", value: readingId }]);
  }
  if (details.completed !== true) throw new Error("tarot reading did not complete");
  return { contractHash: hash, tx: asTxid(tx), readingId, requestId, totalBefore, details };
}

async function runVault() {
  const hash = ADDRESSES.vault;
  const adminContract = appContract(hash, admin);
  const userContract = appContract(hash, user);
  const secret = Buffer.from(uniqueLabel("vault-secret"), "utf8");
  const secretHash = crypto.createHash("sha256").update(secret).digest();

  await transferGAS(admin, hash, "100000000", "miniapp-unbreakablevault:create");
  const createTx = await adminContract.invoke("createVault", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.byteArray(secretHash.toString("base64")),
    Neon.sc.ContractParam.integer("100000000"),
    Neon.sc.ContractParam.integer("1"),
    Neon.sc.ContractParam.string(uniqueLabel("Vault")),
    Neon.sc.ContractParam.string("codex vault"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createVault failed");
  const vaultId = String(stackValue(findNotification(createLog.execution, hash, "VaultCreated")?.state?.value?.[0]));

  await transferGAS(user, hash, "10000000", "miniapp-unbreakablevault:attempt");
  const attemptTx = await userContract.invoke("attemptBreak", [
    Neon.sc.ContractParam.integer(vaultId),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.byteArray(secret.toString("base64")),
  ]);
  const attemptLog = await waitForLog(attemptTx);
  if (attemptLog.execution.vmstate !== "HALT") throw new Error(attemptLog.execution.exception || "attemptBreak failed");
  const details = await invokeRead(hash, "getVaultDetails", [{ type: "Integer", value: vaultId }]);
  if (details.broken !== true) throw new Error("vault was not broken");
  return { contractHash: hash, vaultId, createTx: asTxid(createTx), attemptTx: asTxid(attemptTx), details };
}

async function runAll() {
  await initNeon();
  const results = {};
  const tasks = [
    ["breakup", runBreakup],
    ["burnleague", runBurnLeague],
    ["devtipping", runDevTipping],
    ["tarot", runOnChainTarot],
    ["vault", runVault],
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
    oracleHash: ORACLE_HASH,
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
