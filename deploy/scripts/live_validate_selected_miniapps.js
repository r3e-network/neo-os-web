#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chooseNeoCapableActor } = require("./lib/live_actor_selection");
const {
  sleep,
  asTxid,
  stackBytes,
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
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const ORACLE_UPDATER_MIN_GAS = 10000000n;
const ROOT = path.resolve(__dirname, "../..");
const siblingOraclePhalaEnvPath = path.resolve(
  ROOT,
  "..",
  "neo-morpheus-oracle",
  "deploy",
  "phala",
  "morpheus.testnet.env"
);
const OUTPUT_PATH = String(
  process.env.SELECTED_MINIAPP_SMOKE_REPORT_PATH
    || path.join(ROOT, "docs", "reports", "live-smoke", "selected-miniapps-latest.json")
).trim();
const MILLION_PIECE_CLAIM_FUNDING = 10000000n;
const MILLION_PIECE_BUY_PRICE = 11000000n;
const GRAVEYARD_MEMORY_FUNDING = 110000000n;
const HERITAGE_TRUST_PRINCIPAL = 1n;
const HERITAGE_TRUST_HEARTBEAT_DAYS = 7n;
const TURTLE_MATCH_BOX_COUNT = 3n;
const TURTLE_MATCH_FUNDING = 30000000n;
const TARGET_FILTER = new Set(
  String(process.env.SELECTED_MINIAPP_SMOKE_TARGETS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const SELECTED_TASKS = [
  ["flashloan", runFlashLoanBasic],
  ["exfiles", runExFiles],
  ["masqueradedao", runMasqueradeDAO],
  ["millionpiecemap", runMillionPieceMap],
  ["graveyard", runGraveyard],
  ["heritagetrust", runHeritageTrust],
  ["gascircle", runGasCircle],
  ["turtlematch", runTurtleMatch],
];

if (!ADMIN_WIF || !USER_WIF) {
  console.error("TEST_SMOKE_ADMIN_WIF and TEST_SMOKE_USER_WIF (or equivalent env fallbacks) are required");
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
  flashloan: "0xde8e595d8d3c293731db499367ee2a768e1e458b",
  gascircle: "0x4630b40a4e67882cfab3d3f5041c1da597b0c7b6",
  exfiles: "0xb55358f282a519762ad8c7db57dff2f01bb8cd2a",
  masqueradedao: "0xa79f897c8f1d6b1450b7204668b82cffd1bad4a0",
  millionpiecemap: "0x4cac0ac79bac3b94c388fe0f27a9ed1a8e476cbf",
  graveyard: "0xb55aa635b10a5abb5cbac169db26a38df739778e",
  heritagetrust: "0x42e14d04c17dad0b1d76ee7509e537791230431b",
  turtlematch: "0x4750b2d55de0282579e66c2b1b6c07d9138380ad",
};

let admin;
let user;
let oracleUpdater;
let rpcClient;
let adminGas;
let userGas;
let adminNeo;
let oracleContract;
const waitForLog = createWaitForLog({
  getApplicationLog: (txid) => rpcClient.getApplicationLog(txid),
  label: "live_validate_miniapps",
});

async function initNeon() {
  if (Neon) return;
  Neon = (await import("./lib/neon-compat.mjs")).default;
  admin = new Neon.wallet.Account(ADMIN_WIF);
  user = new Neon.wallet.Account(USER_WIF);
  oracleUpdater = new Neon.wallet.Account(ORACLE_UPDATER_WIF);
  rpcClient = new Neon.rpc.RPCClient(RPC_URL);
  adminGas = new Neon.experimental.SmartContract(GAS_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
  userGas = new Neon.experimental.SmartContract(GAS_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: user });
  adminNeo = new Neon.experimental.SmartContract(NEO_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
  oracleContract = new Neon.experimental.SmartContract(ORACLE_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: oracleUpdater });
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

async function invokeRaw(scriptHash, operation, args = []) {
  const res = await rpcClient.invokeFunction(scriptHash, operation, args);
  if (String(res?.state || "").toUpperCase() === "FAULT") {
    throw new Error(`${operation} faulted: ${res.exception || "unknown error"}`);
  }
  return res;
}

async function assertReadMethodReady(appLabel, contractHash, operation, args = []) {
  try {
    return await invokeRead(contractHash, operation, args);
  } catch (error) {
    throw new Error(`${appLabel}: required read ${operation} failed before flow start: ${String(error?.message || error)}`);
  }
}

async function assertMiniAppNotPaused(appLabel, contractHash) {
  const paused = await tryInvokeOptional(contractHash, "isPaused");
  if (!paused.ok) {
    return { checked: false, paused: null, reason: paused.error || "isPaused unavailable" };
  }
  if (paused.value === true) {
    throw new Error(`${appLabel}: contract is paused`);
  }
  return { checked: true, paused: false };
}

async function tryInvokeOptional(scriptHash, operation, args = []) {
  try {
    const res = await rpcClient.invokeFunction(scriptHash, operation, args);
    if (String(res?.state || "").toUpperCase() === "FAULT") {
      return { ok: false, error: res.exception || `${operation} faulted`, value: null };
    }
    return { ok: true, value: res.stack?.[0] ? stackValue(res.stack[0]) : null, raw: res };
  } catch (error) {
    return { ok: false, error: String(error?.message || error), value: null };
  }
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

async function getGasBalance(addressOrHash) {
  const res = await rpcClient.invokeFunction(GAS_HASH, "balanceOf", [Neon.sc.ContractParam.hash160(addressOrHash)]);
  return BigInt(String(res.stack[0].value || "0"));
}

async function getNeoBalance(addressOrHash) {
  const res = await rpcClient.invokeFunction(NEO_HASH, "balanceOf", [Neon.sc.ContractParam.hash160(addressOrHash)]);
  return BigInt(String(res.stack[0].value || "0"));
}

function requireObjectKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} returned invalid payload`);
  }
  for (const key of keys) {
    if (!(key in value)) {
      throw new Error(`${label} missing field "${key}"`);
    }
  }
  return value;
}

function resolveTargetSelection(tasks, filterSet) {
  const available = tasks.map(([label]) => label);
  const requested = [...filterSet];
  const unknown = requested.filter((label) => !available.includes(label));
  const selected = requested.length > 0
    ? available.filter((label) => filterSet.has(label))
    : available;
  return { available, requested, selected, unknown };
}

async function buildPreflightSummary(targets) {
  const [adminGasBalance, adminNeoBalance, userGasBalance, userNeoBalance, updaterGasBalance] = await Promise.all([
    getGasBalance(`0x${admin.scriptHash}`),
    getNeoBalance(`0x${admin.scriptHash}`),
    getGasBalance(`0x${user.scriptHash}`),
    getNeoBalance(`0x${user.scriptHash}`),
    getGasBalance(`0x${oracleUpdater.scriptHash}`),
  ]);
  const requestFeeResult = await tryInvokeOptional(ORACLE_HASH, "requestFee");
  const updaterInfo = await readOracleUpdaterAlignment();
  return {
    files: {
      siblingOraclePhalaEnvPath,
      siblingOraclePhalaEnvExists: fs.existsSync(siblingOraclePhalaEnvPath),
      outputPath: OUTPUT_PATH,
    },
    targets,
    runtime: {
      oracleHash: ORACLE_HASH,
      oracleUpdaterWifConfigured: Boolean(ORACLE_UPDATER_WIF),
      oracleRequestFee: requestFeeResult.ok ? String(requestFeeResult.value ?? "0") : null,
      oracleRequestFeeError: requestFeeResult.ok ? null : requestFeeResult.error,
      oracleUpdaterMethod: updaterInfo.method,
      oracleUpdaterOnChain: updaterInfo.value || null,
      oracleUpdaterLocal: normalizeHash160(`0x${oracleUpdater.scriptHash}`),
      oracleUpdaterMinGas: ORACLE_UPDATER_MIN_GAS.toString(),
    },
    wallets: {
      admin: {
        address: admin.address,
        scriptHash: normalizeHash160(`0x${admin.scriptHash}`),
        gas: adminGasBalance.toString(),
        neo: adminNeoBalance.toString(),
      },
      user: {
        address: user.address,
        scriptHash: normalizeHash160(`0x${user.scriptHash}`),
        gas: userGasBalance.toString(),
        neo: userNeoBalance.toString(),
      },
      oracleUpdater: {
        address: oracleUpdater.address,
        scriptHash: normalizeHash160(`0x${oracleUpdater.scriptHash}`),
        gas: updaterGasBalance.toString(),
      },
    },
    actorConstraints: {
      gascircleRequiresDistinctActors: true,
      adminUserDistinct: admin.address !== user.address,
      adminAddress: admin.address,
      userAddress: user.address,
    },
  };
}

function assertDistinctActors(appLabel) {
  if (admin.address === user.address) {
    return { skip: true, reason: `${appLabel}: TEST_SMOKE_ADMIN_WIF and TEST_SMOKE_USER_WIF resolved to the same address ${admin.address}. Skipping test.` };
  }
  return {
    adminAddress: admin.address,
    userAddress: user.address,
    distinct: true,
  };
}

async function ensureAccountHasGas(account, required, label) {
  const need = BigInt(String(required));
  const available = await getGasBalance(`0x${account.scriptHash}`);
  if (available < need) {
    throw new Error(
      `${label}: insufficient GAS for ${account.address}; need ${need.toString()}, have ${available.toString()}, short ${(
        need - available
      ).toString()}`
    );
  }
  return available;
}

function normalizeHash160(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text.startsWith("0x")) return text;
  return text.length === 40 ? `0x${text}` : text;
}

async function getOracleRequestFee() {
  const fee = BigInt(String(await invokeRead(ORACLE_HASH, "requestFee") || "0"));
  if (fee <= 0n) {
    throw new Error(`oracle requestFee is invalid: ${fee.toString()}`);
  }
  return fee;
}

async function readOracleUpdaterAlignment() {
  const candidateMethods = ["updater", "operator"];
  for (const method of candidateMethods) {
    const result = await tryInvokeOptional(ORACLE_HASH, method);
    if (!result.ok) continue;
    const value = normalizeHash160(result.value);
    return { method, value };
  }
  return { method: null, value: "" };
}

async function assertOracleBackedAppReady(appLabel, contractHash) {
  const normalizedOracle = normalizeHash160(ORACLE_HASH);
  if (!/^0x[a-f0-9]{40}$/.test(normalizedOracle)) {
    throw new Error(`${appLabel}: ORACLE_HASH is invalid: ${ORACLE_HASH}`);
  }

  const configuredOracle = normalizeHash160(await invokeRead(contractHash, "oracle"));
  if (configuredOracle !== normalizedOracle) {
    throw new Error(
      `${appLabel}: oracle mismatch; contract expects ${configuredOracle || "unset"} but script is using ${normalizedOracle}`
    );
  }

  const callbackAllowed = Boolean(
    await invokeRead(ORACLE_HASH, "isAllowedCallback", [{ type: "Hash160", value: contractHash }])
  );
  if (!callbackAllowed) {
    throw new Error(`${appLabel}: callback contract ${contractHash} is not allowlisted in oracle`);
  }

  const requestFee = await getOracleRequestFee();
  const feeCredit = BigInt(String(await invokeRead(ORACLE_HASH, "feeCreditOf", [{ type: "Hash160", value: contractHash }]) || "0"));
  const deficit = requestFee > feeCredit ? requestFee - feeCredit : 0n;
  if (deficit > 0n) {
    const adminBalance = await getGasBalance(`0x${admin.scriptHash}`);
    if (adminBalance < deficit) {
      throw new Error(
        `${appLabel}: oracle fee credit ${feeCredit.toString()} is below requestFee ${requestFee.toString()} and admin GAS balance ${adminBalance.toString()} cannot cover the deficit ${deficit.toString()}`
      );
    }
  }

  const updaterInfo = await readOracleUpdaterAlignment();
  const expectedUpdater = normalizeHash160(`0x${oracleUpdater.scriptHash}`);
  const updaterGas = await getGasBalance(`0x${oracleUpdater.scriptHash}`);
  if (updaterInfo.method) {
    if (!/^0x[a-f0-9]{40}$/.test(updaterInfo.value) || /^0x0{40}$/.test(updaterInfo.value)) {
      throw new Error(`${appLabel}: oracle ${updaterInfo.method} is unset or invalid (${updaterInfo.value || "empty"})`);
    }
    if (updaterInfo.value !== expectedUpdater) {
      throw new Error(
        `${appLabel}: oracle ${updaterInfo.method} ${updaterInfo.value} does not match updater wallet ${expectedUpdater}`
      );
    }
  }
  if (updaterGas < ORACLE_UPDATER_MIN_GAS) {
    throw new Error(
      `${appLabel}: oracle updater ${oracleUpdater.address} has insufficient GAS for fulfillment fallback; need at least ${ORACLE_UPDATER_MIN_GAS.toString()}, have ${updaterGas.toString()}`
    );
  }

  return {
    configuredOracle,
    callbackAllowed,
    requestFee: requestFee.toString(),
    feeCredit: feeCredit.toString(),
    feeCreditDeficit: deficit.toString(),
    updaterMethod: updaterInfo.method,
    updater: updaterInfo.value || null,
    expectedUpdater,
    updaterGas: updaterGas.toString(),
  };
}

async function transferGAS(accountContract, fromAccount, toHash, amount, memo) {
  const required = BigInt(String(amount));
  const available = await getGasBalance(`0x${fromAccount.scriptHash}`);
  if (available < required) {
    throw new Error(
      `insufficient GAS for ${fromAccount.address}: need ${required.toString()}, have ${available.toString()}, short ${(
        required - available
      ).toString()}`
    );
  }
  const txid = await accountContract.invoke("transfer", [
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
  if (execution.vmstate !== "HALT") {
    throw new Error(execution.exception || `GAS transfer failed for ${toHash}`);
  }
  if (!executionReturnedTrue(execution)) {
    throw new Error(`GAS transfer returned false for ${toHash}`);
  }
  return asTxid(txid);
}

async function transferNEO(fromAccount, toHash, amount, memo) {
  const sourceNeoContract = fromAccount === admin
    ? adminNeo
    : new Neon.experimental.SmartContract(NEO_HASH, {
        rpcAddress: RPC_URL,
        networkMagic: NETWORK_MAGIC,
        account: fromAccount,
      });
  const txid = await sourceNeoContract.invoke("transfer", [
    Neon.sc.ContractParam.hash160(`0x${fromAccount.scriptHash}`),
    Neon.sc.ContractParam.hash160(toHash),
    Neon.sc.ContractParam.integer(String(amount)),
    memo == null ? Neon.sc.ContractParam.any(null) : Neon.sc.ContractParam.string(memo),
  ]);
  const { execution } = await waitForLog(txid);
  if (execution.vmstate !== "HALT" || !executionReturnedTrue(execution)) {
    throw new Error(execution.exception || `NEO transfer failed for ${toHash}`);
  }
  return asTxid(txid);
}

async function topUpOracleCallbackCredit(callbackContractHash) {
  const fee = await getOracleRequestFee();
  const cleanHash = String(callbackContractHash).replace(/^0x/i, "");
  const callbackBytes = Buffer.from(cleanHash, "hex").reverse();
  return transferGAS(adminGas, admin, ORACLE_HASH, String(fee), callbackBytes);
}

function sha256Buffer(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""), "utf8");
  return crypto.createHash("sha256").update(buffer).digest();
}

function encodeUint256Bytes(value) {
  const numeric = BigInt(String(value ?? "0"));
  return Buffer.from(numeric.toString(16).padStart(64, "0"), "hex");
}

function signedBigIntFromLittleEndian(buffer) {
  const bytes = Buffer.from(buffer);
  if (bytes.length === 0) return 0n;
  const negative = (bytes[bytes.length - 1] & 0x80) !== 0;
  if (!negative) {
    return BigInt(`0x${Buffer.from(bytes).reverse().toString("hex")}`);
  }

  const twos = Buffer.from(bytes);
  let carry = 1;
  for (let i = 0; i < twos.length; i += 1) {
    const value = (0xff - twos[i]) + carry;
    twos[i] = value & 0xff;
    carry = value >> 8;
  }
  return -BigInt(`0x${Buffer.from(twos).reverse().toString("hex")}`);
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

async function fulfillOracleRequest(requestId, requestType, resultBytes, errorText = "") {
  const digestHex = buildFulfillmentDigestHex(requestId, requestType, true, resultBytes, errorText);
  const signature = Neon.wallet.sign(digestHex, oracleUpdater.privateKey);
  const txid = await oracleContract.invoke("fulfillRequest", [
    Neon.sc.ContractParam.integer(String(requestId)),
    Neon.sc.ContractParam.boolean(true),
    Neon.sc.ContractParam.byteArray(resultBytes.toString("base64")),
    Neon.sc.ContractParam.string(errorText),
    Neon.sc.ContractParam.byteArray(Buffer.from(String(signature).replace(/^0x/i, ""), "hex").toString("base64")),
  ]);
  const { execution } = await waitForLog(txid);
  if (execution.vmstate !== "HALT") {
    throw new Error(execution.exception || `fulfillRequest failed for ${requestId}`);
  }
  return asTxid(txid);
}

async function ensureOracleRequestFulfilled(requestId, requestType, resultBytes, errorText = "") {
  const request = await getOracleRequest(requestId);
  if (oracleRequestCompleted(request)) {
    return null;
  }
  try {
    return await fulfillOracleRequest(requestId, requestType, resultBytes, errorText);
  } catch (error) {
    if (String(error?.message || error).includes("request already fulfilled")) {
      return null;
    }
    throw error;
  }
}

function uniqueLabel(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function runFlashLoanBasic() {
  const contractHash = ADDRESSES.flashloan;
  const contract = appContract(contractHash, admin);
  const depositAmount = "3000000";
  const pauseState = await assertMiniAppNotPaused("flashloan", contractHash);
  await ensureAccountHasGas(admin, BigInt(depositAmount), "flashloan admin");
  const before = BigInt(String(await assertReadMethodReady("flashloan", contractHash, "getPoolBalance") || "0"));
  const contractGasBefore = await getGasBalance(contractHash);
  if (contractGasBefore < before) {
    throw new Error(
      `flashloan: contract GAS backing ${contractGasBefore.toString()} is below reported pool balance ${before.toString()}`
    );
  }
  const transferTx = await transferGAS(adminGas, admin, contractHash, depositAmount, "miniapp-flashloan:deposit");
  const depositTx = await contract.invoke("deposit", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(depositAmount),
  ]);
  const depositLog = await waitForLog(depositTx);
  if (depositLog.execution.vmstate !== "HALT") throw new Error(depositLog.execution.exception || "deposit failed");
  const afterDeposit = BigInt(String(await invokeRead(contractHash, "getPoolBalance") || "0"));
  const withdrawTx = await contract.invoke("withdraw", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(depositAmount),
  ]);
  const withdrawLog = await waitForLog(withdrawTx);
  if (withdrawLog.execution.vmstate !== "HALT") throw new Error(withdrawLog.execution.exception || "withdraw failed");
  const afterWithdraw = BigInt(String(await invokeRead(contractHash, "getPoolBalance") || "0"));
  if (afterDeposit - before !== BigInt(depositAmount)) throw new Error("pool balance did not increase by deposit amount");
  if (afterWithdraw !== before) throw new Error("pool balance did not return to baseline after withdraw");
  return {
    contractHash,
    pauseState,
    transferTx,
    depositTx: asTxid(depositTx),
    withdrawTx: asTxid(withdrawTx),
    before: before.toString(),
    contractGasBefore: contractGasBefore.toString(),
    afterDeposit: afterDeposit.toString(),
    afterWithdraw: afterWithdraw.toString(),
  };
}

async function runExFiles() {
  const contractHash = ADDRESSES.exfiles;
  const adminContract = appContract(contractHash, admin);
  const userContract = appContract(contractHash, user);
  const actorCheck = assertDistinctActors("exfiles");
  if (actorCheck.skip) return { contractHash, skipped: true, reason: actorCheck.reason };
  const pauseState = await assertMiniAppNotPaused("exfiles", contractHash);
  await ensureAccountHasGas(admin, 15000000n, "exfiles admin");
  await ensureAccountHasGas(user, 35000000n, "exfiles user");
  const totalRecordsBefore = BigInt(String(await assertReadMethodReady("exfiles", contractHash, "totalRecords") || "0"));
  const dataHash = crypto.createHash("sha256").update(uniqueLabel("exfiles-record")).digest();

  await transferGAS(adminGas, admin, contractHash, "15000000", "miniapp-exfiles:create");
  await transferGAS(userGas, user, contractHash, "35000000", "miniapp-exfiles:review");

  const createTx = await adminContract.invoke("createRecord", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.byteArray(dataHash.toString("base64")),
    Neon.sc.ContractParam.integer("4"),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createRecord failed");
  const created = findNotification(createLog.execution, contractHash, "RecordCreated");
  const recordId = String(stackValue(created?.state?.value?.[0]));
  if (!recordId || recordId === "null") throw new Error("RecordCreated notification missing");

  const queryTx = await userContract.invoke("queryByHash", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.byteArray(dataHash.toString("base64")),
  ]);
  const queryLog = await waitForLog(queryTx);
  if (queryLog.execution.vmstate !== "HALT") throw new Error(queryLog.execution.exception || "queryByHash failed");

  const verifyTx = await userContract.invoke("verifyRecord", [
    Neon.sc.ContractParam.integer(recordId),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
  ]);
  const verifyLog = await waitForLog(verifyTx);
  if (verifyLog.execution.vmstate !== "HALT") throw new Error(verifyLog.execution.exception || "verifyRecord failed");

  const reportTx = await userContract.invoke("reportRecord", [
    Neon.sc.ContractParam.integer(recordId),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.string("codex smoke validation"),
  ]);
  const reportLog = await waitForLog(reportTx);
  if (reportLog.execution.vmstate !== "HALT") throw new Error(reportLog.execution.exception || "reportRecord failed");

  const updateTx = await adminContract.invoke("updateRecord", [
    Neon.sc.ContractParam.integer(recordId),
    Neon.sc.ContractParam.integer("5"),
    Neon.sc.ContractParam.string("codex update"),
  ]);
  const updateLog = await waitForLog(updateTx);
  if (updateLog.execution.vmstate !== "HALT") throw new Error(updateLog.execution.exception || "updateRecord failed");

  const deleteTx = await adminContract.invoke("deleteRecord", [
    Neon.sc.ContractParam.integer(recordId),
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
  ]);
  const deleteLog = await waitForLog(deleteTx);
  if (deleteLog.execution.vmstate !== "HALT") throw new Error(deleteLog.execution.exception || "deleteRecord failed");

  const details = await invokeRead(contractHash, "getRecordDetails", [{ type: "Integer", value: recordId }]);
  if (details.active !== false) throw new Error("record should be inactive after delete");
  if (String(details.verifier || "").toLowerCase() !== `0x${user.scriptHash}`.toLowerCase()) throw new Error("record verifier mismatch");
  return {
    contractHash,
    actorCheck,
    pauseState,
    totalRecordsBefore: totalRecordsBefore.toString(),
    recordId,
    createTx: asTxid(createTx),
    queryTx: asTxid(queryTx),
    verifyTx: asTxid(verifyTx),
    reportTx: asTxid(reportTx),
    updateTx: asTxid(updateTx),
    deleteTx: asTxid(deleteTx),
  };
}

async function runMasqueradeDAO() {
  const contractHash = ADDRESSES.masqueradedao;
  const adminContract = appContract(contractHash, admin);
  const userContract = appContract(contractHash, user);
  const pauseState = await assertMiniAppNotPaused("masqueradedao", contractHash);
  await ensureAccountHasGas(admin, 40000000n, "masqueradedao admin");
  await ensureAccountHasGas(user, 20000000n, "masqueradedao user");
  const totalMasksBefore = BigInt(String(await assertReadMethodReady("masqueradedao", contractHash, "totalMasks") || "0"));
  const totalProposalsBefore = BigInt(String(await assertReadMethodReady("masqueradedao", contractHash, "totalProposals") || "0"));
  await transferGAS(adminGas, admin, contractHash, "40000000", "miniapp-masqueradedao:admin");
  await transferGAS(userGas, user, contractHash, "20000000", "miniapp-masqueradedao:user");

  const createMaskAdminTx = await adminContract.invoke("createMask", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.byteArray(crypto.createHash("sha256").update(uniqueLabel("mask-admin")).digest().toString("base64")),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const createMaskAdminLog = await waitForLog(createMaskAdminTx);
  if (createMaskAdminLog.execution.vmstate !== "HALT") throw new Error(createMaskAdminLog.execution.exception || "admin createMask failed");
  const maskA = String(stackValue(findNotification(createMaskAdminLog.execution, contractHash, "MaskCreated")?.state?.value?.[0]));

  const createMaskUserTx = await userContract.invoke("createMask", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.byteArray(crypto.createHash("sha256").update(uniqueLabel("mask-user")).digest().toString("base64")),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const createMaskUserLog = await waitForLog(createMaskUserTx);
  if (createMaskUserLog.execution.vmstate !== "HALT") throw new Error(createMaskUserLog.execution.exception || "user createMask failed");
  const maskB = String(stackValue(findNotification(createMaskUserLog.execution, contractHash, "MaskCreated")?.state?.value?.[0]));

  const proposalTx = await adminContract.invoke("createProposal", [
    Neon.sc.ContractParam.integer(maskA),
    Neon.sc.ContractParam.string(uniqueLabel("Proposal")),
    Neon.sc.ContractParam.string("Codex smoke proposal"),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const proposalLog = await waitForLog(proposalTx);
  if (proposalLog.execution.vmstate !== "HALT") throw new Error(proposalLog.execution.exception || "createProposal failed");
  const proposalId = String(stackValue(findNotification(proposalLog.execution, contractHash, "ProposalCreated")?.state?.value?.[0]));

  const voteTx = await userContract.invoke("submitVote", [
    Neon.sc.ContractParam.integer(proposalId),
    Neon.sc.ContractParam.integer(maskB),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const voteLog = await waitForLog(voteTx);
  if (voteLog.execution.vmstate !== "HALT") throw new Error(voteLog.execution.exception || "submitVote failed");
  const proposal = await invokeRead(contractHash, "getProposalDetails", [{ type: "Integer", value: proposalId }]);
  if (BigInt(String(proposal.yesVotes || "0")) <= 0n) throw new Error("proposal yesVotes did not increase");
  return {
    contractHash,
    pauseState,
    totalMasksBefore: totalMasksBefore.toString(),
    totalProposalsBefore: totalProposalsBefore.toString(),
    maskA,
    maskB,
    proposalId,
    createMaskAdminTx: asTxid(createMaskAdminTx),
    createMaskUserTx: asTxid(createMaskUserTx),
    proposalTx: asTxid(proposalTx),
    voteTx: asTxid(voteTx),
  };
}

async function pickUnclaimedPiece(contractHash) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = (Date.now() + attempt * 13) % 100;
    const y = (Date.now() + attempt * 29) % 100;
    const details = await invokeRead(contractHash, "getPieceDetails", [
      { type: "Integer", value: String(x) },
      { type: "Integer", value: String(y) },
    ]);
    if (!details.owner || String(details.owner) === "0x0000000000000000000000000000000000000000") {
      return { x, y };
    }
  }
  throw new Error("unable to find unclaimed piece");
}

async function runMillionPieceMap() {
  const contractHash = ADDRESSES.millionpiecemap;
  const adminContract = appContract(contractHash, admin);
  const userContract = appContract(contractHash, user);
  const pauseState = await assertMiniAppNotPaused("millionpiecemap", contractHash);
  const actorPrecheck = assertDistinctActors("millionpiecemap");
  if (actorPrecheck.skip) return { contractHash, skipped: true, reason: actorPrecheck.reason };
  await ensureAccountHasGas(admin, MILLION_PIECE_CLAIM_FUNDING, "millionpiecemap admin");
  await ensureAccountHasGas(user, MILLION_PIECE_BUY_PRICE, "millionpiecemap user");
  const mapOverview = requireObjectKeys(await assertReadMethodReady("millionpiecemap", contractHash, "getMapOverview"), [
    "totalPieces",
    "claimed",
    "available",
  ], "getMapOverview");
  const platformStats = requireObjectKeys(await assertReadMethodReady("millionpiecemap", contractHash, "getPlatformStats"), [
    "piecePrice",
  ], "getPlatformStats");
  const piecePrice = BigInt(String(platformStats.piecePrice || "0"));
  if (piecePrice !== MILLION_PIECE_CLAIM_FUNDING) {
    throw new Error(
      `millionpiecemap: on-chain piecePrice ${piecePrice.toString()} does not match scripted funding ${MILLION_PIECE_CLAIM_FUNDING.toString()}`
    );
  }
  if (BigInt(String(mapOverview.available || "0")) <= 0n) {
    throw new Error(
      `millionpiecemap: no unclaimed pieces remain (claimed=${String(mapOverview.claimed || "0")}, total=${String(mapOverview.totalPieces || "0")})`
    );
  }
  const { x, y } = await pickUnclaimedPiece(contractHash);

  await transferGAS(adminGas, admin, contractHash, String(MILLION_PIECE_CLAIM_FUNDING), "miniapp-millionpiecemap:claim");
  const claimTx = await adminContract.invoke("claimPiece", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(String(x)),
    Neon.sc.ContractParam.integer(String(y)),
  ]);
  const claimLog = await waitForLog(claimTx);
  if (claimLog.execution.vmstate !== "HALT") throw new Error(claimLog.execution.exception || "claimPiece failed");

  const price = String(MILLION_PIECE_BUY_PRICE);
  const listTx = await adminContract.invoke("listForSale", [
    Neon.sc.ContractParam.integer(String(x)),
    Neon.sc.ContractParam.integer(String(y)),
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(price),
  ]);
  const listLog = await waitForLog(listTx);
  if (listLog.execution.vmstate !== "HALT") throw new Error(listLog.execution.exception || "listForSale failed");

  const contractBalanceBeforeBuy = await getGasBalance(contractHash);
  await transferGAS(userGas, user, contractHash, price, "miniapp-millionpiecemap:buy");
  const buyTx = await userContract.invoke("buyPiece", [
    Neon.sc.ContractParam.integer(String(x)),
    Neon.sc.ContractParam.integer(String(y)),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
  ]);
  const buyLog = await waitForLog(buyTx);
  if (buyLog.execution.vmstate !== "HALT") throw new Error(buyLog.execution.exception || "buyPiece failed");
  const contractBalanceAfterBuy = await getGasBalance(contractHash);
  const piece = await invokeRead(contractHash, "getPieceDetails", [
    { type: "Integer", value: String(x) },
    { type: "Integer", value: String(y) },
  ]);
  if (String(piece.owner || "").toLowerCase() !== `0x${user.scriptHash}`.toLowerCase()) throw new Error("piece owner did not transfer to buyer");
  if (contractBalanceAfterBuy !== contractBalanceBeforeBuy) throw new Error("contract retained traded GAS instead of forwarding to seller");
  return {
    contractHash,
    pauseState,
    actorPrecheck,
    mapPrecheck: {
      mapOverview,
      piecePrice: piecePrice.toString(),
      scriptedBuyPrice: price,
    },
    x,
    y,
    claimTx: asTxid(claimTx),
    listTx: asTxid(listTx),
    buyTx: asTxid(buyTx),
  };
}

async function runGraveyard() {
  const contractHash = ADDRESSES.graveyard;
  const contract = appContract(contractHash, admin);
  const pauseState = await assertMiniAppNotPaused("graveyard", contractHash);
  await ensureAccountHasGas(admin, GRAVEYARD_MEMORY_FUNDING, "graveyard admin");
  const stats = requireObjectKeys(await assertReadMethodReady("graveyard", contractHash, "getPlatformStats"), [
    "buryFee",
    "forgetFee",
  ], "getPlatformStats");
  const buryFee = BigInt(String(stats.buryFee || "0"));
  const forgetFee = BigInt(String(stats.forgetFee || "0"));
  const requiredFunding = buryFee + forgetFee;
  if (requiredFunding > GRAVEYARD_MEMORY_FUNDING) {
    throw new Error(
      `graveyard: scripted funding ${GRAVEYARD_MEMORY_FUNDING.toString()} is below current bury+forget fees ${requiredFunding.toString()}`
    );
  }
  await transferGAS(adminGas, admin, contractHash, String(GRAVEYARD_MEMORY_FUNDING), "miniapp-graveyard:memory");
  const contentHash = crypto.createHash("sha256").update(uniqueLabel("graveyard-memory")).digest("hex");

  const buryTx = await contract.invoke("buryMemory", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.string(contentHash),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const buryLog = await waitForLog(buryTx);
  if (buryLog.execution.vmstate !== "HALT") throw new Error(buryLog.execution.exception || "buryMemory failed");
  const memoryId = String(stackValue(findNotification(buryLog.execution, contractHash, "MemoryBuried")?.state?.value?.[0]));

  const epitaphTx = await contract.invoke("addEpitaph", [
    Neon.sc.ContractParam.integer(memoryId),
    Neon.sc.ContractParam.string("codex smoke"),
  ]);
  const epitaphLog = await waitForLog(epitaphTx);
  if (epitaphLog.execution.vmstate !== "HALT") throw new Error(epitaphLog.execution.exception || "addEpitaph failed");

  const forgetTx = await contract.invoke("forgetMemory", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(memoryId),
  ]);
  const forgetLog = await waitForLog(forgetTx);
  if (forgetLog.execution.vmstate !== "HALT") throw new Error(forgetLog.execution.exception || "forgetMemory failed");

  const memory = await invokeRead(contractHash, "getMemoryDetails", [{ type: "Integer", value: memoryId }]);
  if (memory.forgotten !== true) throw new Error("memory not marked forgotten");
  return {
    contractHash,
    pauseState,
    fundingPrecheck: {
      buryFee: buryFee.toString(),
      forgetFee: forgetFee.toString(),
      scriptedFunding: GRAVEYARD_MEMORY_FUNDING.toString(),
    },
    memoryId,
    buryTx: asTxid(buryTx),
    epitaphTx: asTxid(epitaphTx),
    forgetTx: asTxid(forgetTx),
  };
}

async function runHeritageTrust() {
  const contractHash = ADDRESSES.heritagetrust;
  const pauseState = await assertMiniAppNotPaused("heritagetrust", contractHash);
  const actorPrecheck = assertDistinctActors("heritagetrust");
  if (actorPrecheck.skip) return { contractHash, skipped: true, reason: actorPrecheck.reason };
  const platformStats = requireObjectKeys(await assertReadMethodReady("heritagetrust", contractHash, "getPlatformStats"), [
    "minPrincipal",
    "minHeartbeatSeconds",
    "maxHeartbeatSeconds",
  ], "getPlatformStats");
  const minPrincipal = BigInt(String(platformStats.minPrincipal || "0"));
  const minHeartbeatSeconds = BigInt(String(platformStats.minHeartbeatSeconds || "0"));
  const maxHeartbeatSeconds = BigInt(String(platformStats.maxHeartbeatSeconds || "0"));
  const scriptedHeartbeatSeconds = HERITAGE_TRUST_HEARTBEAT_DAYS * 86400n;
  if (HERITAGE_TRUST_PRINCIPAL < minPrincipal) {
    throw new Error(
      `heritagetrust: scripted principal ${HERITAGE_TRUST_PRINCIPAL.toString()} is below current minPrincipal ${minPrincipal.toString()}`
    );
  }
  if (scriptedHeartbeatSeconds < minHeartbeatSeconds || scriptedHeartbeatSeconds > maxHeartbeatSeconds) {
    throw new Error(
      `heritagetrust: scripted heartbeat ${scriptedHeartbeatSeconds.toString()}s is outside current range ${minHeartbeatSeconds.toString()}-${maxHeartbeatSeconds.toString()}`
    );
  }
  const [adminNeoBalance, userNeoBalance] = await Promise.all([
    getNeoBalance(`0x${admin.scriptHash}`),
    getNeoBalance(`0x${user.scriptHash}`),
  ]);
  const principalActor = chooseNeoCapableActor([
    { label: "admin", account: admin, address: admin.address, neo: adminNeoBalance },
    { label: "user", account: user, address: user.address, neo: userNeoBalance },
  ], HERITAGE_TRUST_PRINCIPAL).account;
  const guardianActor = principalActor === admin ? user : admin;
  const contract = appContract(contractHash, principalActor);
  await transferNEO(principalActor, contractHash, HERITAGE_TRUST_PRINCIPAL.toString(), "miniapp-heritage-trust:create");

  const createTx = await contract.invoke("createTrust", [
    Neon.sc.ContractParam.hash160(`0x${principalActor.scriptHash}`),
    Neon.sc.ContractParam.hash160(`0x${guardianActor.scriptHash}`),
    Neon.sc.ContractParam.integer(HERITAGE_TRUST_PRINCIPAL.toString()),
    Neon.sc.ContractParam.integer(HERITAGE_TRUST_HEARTBEAT_DAYS.toString()),
    Neon.sc.ContractParam.string(uniqueLabel("Heritage")),
    Neon.sc.ContractParam.string("Codex smoke trust"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createTrust failed");
  const trustId = String(stackValue(findNotification(createLog.execution, contractHash, "TrustCreated")?.state?.value?.[0]));

  const guardianTx = await contract.invoke("addGuardian", [
    Neon.sc.ContractParam.integer(trustId),
    Neon.sc.ContractParam.hash160(`0x${guardianActor.scriptHash}`),
  ]);
  const guardianLog = await waitForLog(guardianTx);
  if (guardianLog.execution.vmstate !== "HALT") throw new Error(guardianLog.execution.exception || "addGuardian failed");

  const heartbeatTx = await contract.invoke("heartbeat", [
    Neon.sc.ContractParam.integer(trustId),
  ]);
  const heartbeatLog = await waitForLog(heartbeatTx);
  if (heartbeatLog.execution.vmstate !== "HALT") throw new Error(heartbeatLog.execution.exception || "heartbeat failed");

  const cancelTx = await contract.invoke("cancelTrust", [
    Neon.sc.ContractParam.integer(trustId),
  ]);
  const cancelLog = await waitForLog(cancelTx);
  if (cancelLog.execution.vmstate !== "HALT") throw new Error(cancelLog.execution.exception || "cancelTrust failed");

  const details = await invokeRead(contractHash, "getTrustDetails", [{ type: "Integer", value: trustId }]);
  if (details.active !== false || details.cancelled !== true) throw new Error("trust not cancelled as expected");
  return {
    contractHash,
    pauseState,
    actorPrecheck,
    trustPrecheck: {
      minPrincipal: minPrincipal.toString(),
      scriptedPrincipal: HERITAGE_TRUST_PRINCIPAL.toString(),
      minHeartbeatSeconds: minHeartbeatSeconds.toString(),
      maxHeartbeatSeconds: maxHeartbeatSeconds.toString(),
      scriptedHeartbeatSeconds: scriptedHeartbeatSeconds.toString(),
      adminNeoBalance: adminNeoBalance.toString(),
      userNeoBalance: userNeoBalance.toString(),
      principalAddress: principalActor.address,
      guardianAddress: guardianActor.address,
    },
    trustId,
    createTx: asTxid(createTx),
    guardianTx: asTxid(guardianTx),
    heartbeatTx: asTxid(heartbeatTx),
    cancelTx: asTxid(cancelTx),
  };
}

async function runGasCircle() {
  const contractHash = ADDRESSES.gascircle;
  const adminContract = appContract(contractHash, admin);
  const userContract = appContract(contractHash, user);
  const oraclePrecheck = await assertOracleBackedAppReady("gascircle", contractHash);
  const actorPrecheck = assertDistinctActors("gascircle");
  if (actorPrecheck.skip) return { contractHash, skipped: true, reason: actorPrecheck.reason };
  const requestFee = BigInt(oraclePrecheck.requestFee || "0");
  await ensureAccountHasGas(admin, 20000000n + requestFee*2n, "gascircle admin");
  await ensureAccountHasGas(user, 20000000n, "gascircle user");
  const daily = "10000000";

  const createTx = await adminContract.invoke("createCircle", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(daily),
    Neon.sc.ContractParam.integer("2"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createCircle failed");
  const circleId = String(stackValue(findNotification(createLog.execution, contractHash, "CircleCreated")?.state?.value?.[0]));

  const joinAdminTx = await adminContract.invoke("joinCircle", [
    Neon.sc.ContractParam.integer(circleId),
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
  ]);
  const joinAdminLog = await waitForLog(joinAdminTx);
  if (joinAdminLog.execution.vmstate !== "HALT") throw new Error(joinAdminLog.execution.exception || "admin joinCircle failed");

  const joinUserTx = await userContract.invoke("joinCircle", [
    Neon.sc.ContractParam.integer(circleId),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
  ]);
  const joinUserLog = await waitForLog(joinUserTx);
  if (joinUserLog.execution.vmstate !== "HALT") throw new Error(joinUserLog.execution.exception || "user joinCircle failed");

  await transferGAS(adminGas, admin, contractHash, "20000000", "miniapp-gascircle:admin");
  await transferGAS(userGas, user, contractHash, "20000000", "miniapp-gascircle:user");

  const deposit1A = await adminContract.invoke("makeDeposit", [
    Neon.sc.ContractParam.integer(circleId),
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
  ]);
  const deposit1ALog = await waitForLog(deposit1A);
  if (deposit1ALog.execution.vmstate !== "HALT") throw new Error(deposit1ALog.execution.exception || "day1 admin deposit failed");
  const deposit1B = await userContract.invoke("makeDeposit", [
    Neon.sc.ContractParam.integer(circleId),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
  ]);
  const deposit1BLog = await waitForLog(deposit1B);
  if (deposit1BLog.execution.vmstate !== "HALT") throw new Error(deposit1BLog.execution.exception || "day1 user deposit failed");

  await topUpOracleCallbackCredit(contractHash);
  const payout1Tx = await adminContract.invoke("requestPayout", [Neon.sc.ContractParam.integer(circleId)]);
  const payout1Log = await waitForLog(payout1Tx);
  if (payout1Log.execution.vmstate !== "HALT") throw new Error(payout1Log.execution.exception || "requestPayout day1 failed");
  const payout1Req = findNotification(payout1Log.execution, contractHash, "PayoutRequested");
  const request1 = String(stackValue(payout1Req?.state?.value?.[2]));
  const fulfill1Tx = await ensureOracleRequestFulfilled(request1, "automation_register", Buffer.from("{}"));
  let circle = await invokeRead(contractHash, "getCircle", [{ type: "Integer", value: circleId }]);
  let deadline = Date.now() + 45000;
  while (String(circle[4]) === "1" && Date.now() < deadline) {
    await sleep(2000);
    circle = await invokeRead(contractHash, "getCircle", [{ type: "Integer", value: circleId }]);
  }

  const deposit2A = await adminContract.invoke("makeDeposit", [
    Neon.sc.ContractParam.integer(circleId),
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
  ]);
  const deposit2ALog = await waitForLog(deposit2A);
  if (deposit2ALog.execution.vmstate !== "HALT") throw new Error(deposit2ALog.execution.exception || "day2 admin deposit failed");
  const deposit2B = await userContract.invoke("makeDeposit", [
    Neon.sc.ContractParam.integer(circleId),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
  ]);
  const deposit2BLog = await waitForLog(deposit2B);
  if (deposit2BLog.execution.vmstate !== "HALT") throw new Error(deposit2BLog.execution.exception || "day2 user deposit failed");

  await topUpOracleCallbackCredit(contractHash);
  const payout2Tx = await adminContract.invoke("requestPayout", [Neon.sc.ContractParam.integer(circleId)]);
  const payout2Log = await waitForLog(payout2Tx);
  if (payout2Log.execution.vmstate !== "HALT") throw new Error(payout2Log.execution.exception || "requestPayout day2 failed");
  const payout2Req = findNotification(payout2Log.execution, contractHash, "PayoutRequested");
  const request2 = String(stackValue(payout2Req?.state?.value?.[2]));
  const fulfill2Tx = await ensureOracleRequestFulfilled(request2, "automation_register", Buffer.from("{}"));
  circle = await invokeRead(contractHash, "getCircle", [{ type: "Integer", value: circleId }]);
  deadline = Date.now() + 45000;
  while (circle[6] !== false && Date.now() < deadline) {
    await sleep(2000);
    circle = await invokeRead(contractHash, "getCircle", [{ type: "Integer", value: circleId }]);
  }
  if (circle[6] !== false) throw new Error("circle should be inactive after second payout");
  return {
    contractHash,
    oraclePrecheck,
    actorPrecheck,
    circleId,
    createTx: asTxid(createTx),
    joinAdminTx: asTxid(joinAdminTx),
    joinUserTx: asTxid(joinUserTx),
    payout1Tx: asTxid(payout1Tx),
    fulfill1Tx,
    payout2Tx: asTxid(payout2Tx),
    fulfill2Tx,
  };
}

async function runTurtleMatch() {
  const contractHash = ADDRESSES.turtlematch;
  const contract = appContract(contractHash, admin);
  const scriptName = "turtle-match-logic";
  const defaultScriptHash = crypto.createHash("sha256").update("codex-turtle-match-v1").digest();
  let activeScriptHash = defaultScriptHash;
  const pauseState = await assertMiniAppNotPaused("turtlematch", contractHash);
  await ensureAccountHasGas(admin, TURTLE_MATCH_FUNDING, "turtlematch admin");
  const stats = requireObjectKeys(await assertReadMethodReady("turtlematch", contractHash, "getPlatformStats"), [
    "blindboxPrice",
  ], "getPlatformStats");
  const blindboxPrice = BigInt(String(stats.blindboxPrice || "0"));
  const scriptedFundingFloor = blindboxPrice * TURTLE_MATCH_BOX_COUNT;
  if (scriptedFundingFloor > TURTLE_MATCH_FUNDING) {
    throw new Error(
      `turtlematch: scripted funding ${TURTLE_MATCH_FUNDING.toString()} is below blindboxPrice*boxCount ${scriptedFundingFloor.toString()}`
    );
  }

  const rawScriptInfo = await invokeRaw(contractHash, "getScriptInfo", [{ type: "String", value: scriptName }]).catch((e) => {
    console.warn(`[warn] getScriptInfo(${scriptName}) failed: ${e.message} — treating as not registered`);
    return null;
  });
  if (rawScriptInfo && rawScriptInfo?.stack?.[0]?.type !== "Map") {
    throw new Error(`turtlematch: getScriptInfo returned unexpected stack type ${String(rawScriptInfo?.stack?.[0]?.type || "missing")}`);
  }
  const scriptInfo = {
    exists: false,
    enabled: false,
    hashHex: "",
  };
  if (rawScriptInfo?.stack?.[0]?.type === "Map" && Array.isArray(rawScriptInfo.stack[0].value)) {
    for (const entry of rawScriptInfo.stack[0].value) {
      const key = stackValue(entry.key);
      if (key === "exists") scriptInfo.exists = entry.value?.value === true;
      if (key === "enabled") scriptInfo.enabled = entry.value?.value === true;
      if (key === "hash") scriptInfo.hashHex = stackBytes(entry.value).toString("hex");
    }
  }
  if (scriptInfo.exists) {
    if (scriptInfo.enabled !== true) {
      throw new Error(`turtlematch: script ${scriptName} is registered but disabled`);
    }
    if (!scriptInfo.hashHex) {
      throw new Error(`turtlematch: script ${scriptName} is registered but returned no hash`);
    }
    if (scriptInfo.hashHex) {
      activeScriptHash = Buffer.from(scriptInfo.hashHex, "hex");
    }
  } else {
    const registerTx = await contract.invoke("registerScript", [
      Neon.sc.ContractParam.string(scriptName),
      Neon.sc.ContractParam.byteArray(defaultScriptHash.toString("base64")),
    ]);
    const registerLog = await waitForLog(registerTx);
    if (registerLog.execution.vmstate !== "HALT") throw new Error(registerLog.execution.exception || "registerScript failed");
  }

  await transferGAS(adminGas, admin, contractHash, String(TURTLE_MATCH_FUNDING), "miniapp-turtle-match:play");
  const startTx = await contract.invoke("startGame", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(TURTLE_MATCH_BOX_COUNT.toString()),
  ]);
  const startLog = await waitForLog(startTx);
  if (startLog.execution.vmstate !== "HALT") throw new Error(startLog.execution.exception || "startGame failed");
  const started = findNotification(startLog.execution, contractHash, "GameStarted");
  const sessionId = String(stackValue(started?.state?.value?.[1]));

  const rawSession = await invokeRaw(contractHash, "getSession", [{ type: "Integer", value: sessionId }]);
  const sessionStruct = rawSession.stack[0];
  const seedBytes = stackBytes(sessionStruct.value[3]);
  if (seedBytes.length === 0) throw new Error("session seed missing");

  const rewards = [15000000n, 15000000n, 18000000n, 20000000n, 25000000n, 35000000n, 50000000n, 100000000n];
  const odds = [20n, 40n, 58n, 73n, 85n, 93n, 98n, 100n];
  let currentSeed = Buffer.from(seedBytes);
  let matches = 0n;
  let reward = 0n;
  for (let box = 0; box < 3; box += 1) {
    const counts = Array(8).fill(0);
    for (let slot = 0; slot < 9; slot += 1) {
      currentSeed = crypto.createHash("sha256").update(currentSeed).digest();
      let rand = signedBigIntFromLittleEndian(currentSeed) % 100n;
      if (rand < 0n) rand = -rand;
      let color = 7;
      for (let i = 0; i < odds.length; i += 1) {
        if (rand < odds[i]) { color = i; break; }
      }
      counts[color] += 1;
    }
    counts.forEach((count, color) => {
      if (count >= 3) {
        matches += 1n;
        reward += rewards[color];
      }
    });
  }

  const settleTx = await contract.invoke("settleGame", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(sessionId),
    Neon.sc.ContractParam.integer(matches.toString()),
    Neon.sc.ContractParam.integer(reward.toString()),
    Neon.sc.ContractParam.byteArray(activeScriptHash.toString("base64")),
  ]);
  const settleLog = await waitForLog(settleTx);
  if (settleLog.execution.vmstate !== "HALT") throw new Error(settleLog.execution.exception || "settleGame failed");
  const session = await invokeRead(contractHash, "getSession", [{ type: "Integer", value: sessionId }]);
  if (session[6] !== true) throw new Error("session not settled");
  return {
    contractHash,
    pauseState,
    scriptPrecheck: {
      scriptName,
      scriptExists: scriptInfo.exists === true,
      scriptEnabled: scriptInfo.exists === true ? scriptInfo.enabled === true : null,
      onChainScriptHash: scriptInfo.hashHex || null,
      expectedScriptHash: activeScriptHash.toString("hex"),
      defaultScriptHash: defaultScriptHash.toString("hex"),
      blindboxPrice: blindboxPrice.toString(),
      boxCount: TURTLE_MATCH_BOX_COUNT.toString(),
      scriptedFunding: TURTLE_MATCH_FUNDING.toString(),
    },
    sessionId,
    matches: matches.toString(),
    reward: reward.toString(),
    startTx: asTxid(startTx),
    settleTx: asTxid(settleTx),
  };
}

async function runAll() {
  await initNeon();
  const targets = resolveTargetSelection(SELECTED_TASKS, TARGET_FILTER);
  if (targets.unknown.length > 0) {
    throw new Error(
      `unknown SELECTED_MINIAPP_SMOKE_TARGETS entries: ${targets.unknown.join(", ")}; valid targets: ${targets.available.join(", ")}`
    );
  }
  const preflight = await buildPreflightSummary(targets);
  const results = {};
  console.error(`[targets] selected=${targets.selected.join(", ")}`);
  if (targets.requested.length > 0) {
    console.error(`[targets] requested=${targets.requested.join(", ")}`);
  }
  console.error(
    `[preflight] adminGas=${preflight.wallets.admin.gas} adminNEO=${preflight.wallets.admin.neo} userGas=${preflight.wallets.user.gas} userNEO=${preflight.wallets.user.neo} updaterGas=${preflight.wallets.oracleUpdater.gas}`
  );

  for (const [name, fn] of SELECTED_TASKS) {
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

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    rpcUrl: RPC_URL,
    targetInfo: targets,
    preflight,
    adminAddress: admin.address,
    userAddress: user.address,
    oracle: ORACLE_HASH,
    results,
  }, null, 2) + "\n");

  const failed = Object.entries(results).filter(([, v]) => v.status !== "pass");
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
