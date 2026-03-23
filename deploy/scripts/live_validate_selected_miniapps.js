#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Neon = require("@cityofzion/neon-js");

const RPC_URL = process.env.NEO_RPC_URL || "https://testnet1.neo.coz.io:443";
const NETWORK_MAGIC = Number(process.env.NEO_NETWORK_MAGIC || "894710606");
const ADMIN_WIF = process.env.TEST_SMOKE_ADMIN_WIF || process.env.MINIAPP_UPDATE_WIF || process.env.FLAGSHIP_LIVE_WIF || "";
const USER_WIF = process.env.TEST_SMOKE_USER_WIF || process.env.NEO_TESTNET_WIF || "";
const ORACLE_HASH = (process.env.MORPHEUS_ORACLE_HASH || "0x4b882e94ed766807c4fd728768f972e13008ad52").trim();
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const ROOT = path.resolve(__dirname, "../..");
const siblingOraclePhalaEnvPath = path.resolve(
  ROOT,
  "..",
  "neo-morpheus-oracle",
  "deploy",
  "phala",
  "morpheus.testnet.env"
);
const OUTPUT_PATH = path.join(ROOT, "docs", "reports", "2026-03-19-selected-miniapp-live-smoke.json");
const TARGET_FILTER = new Set(
  String(process.env.SELECTED_MINIAPP_SMOKE_TARGETS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

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
  dicegame: "0x1e448bf07a742da74084d4c64a61052980beb496",
  gascircle: "0x4630b40a4e67882cfab3d3f5041c1da597b0c7b6",
  exfiles: "0xb55358f282a519762ad8c7db57dff2f01bb8cd2a",
  masqueradedao: "0xa79f897c8f1d6b1450b7204668b82cffd1bad4a0",
  millionpiecemap: "0x4cac0ac79bac3b94c388fe0f27a9ed1a8e476cbf",
  graveyard: "0xb55aa635b10a5abb5cbac169db26a38df739778e",
  heritagetrust: "0x42e14d04c17dad0b1d76ee7509e537791230431b",
  halloffame: "0x00d44aefa345f72c0eb15036129a32a56c765474",
  turtlematch: "0x4750b2d55de0282579e66c2b1b6c07d9138380ad",
};

const admin = new Neon.wallet.Account(ADMIN_WIF);
const user = new Neon.wallet.Account(USER_WIF);
const oracleUpdater = new Neon.wallet.Account(ORACLE_UPDATER_WIF);
const rpcClient = new Neon.rpc.RPCClient(RPC_URL);
const adminGas = new Neon.experimental.SmartContract(GAS_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
const userGas = new Neon.experimental.SmartContract(GAS_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: user });
const adminNeo = new Neon.experimental.SmartContract(NEO_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
const oracleContract = new Neon.experimental.SmartContract(ORACLE_HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: oracleUpdater });

function appContract(hash, account) {
  return new Neon.experimental.SmartContract(hash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    } catch (e) {
      console.warn(`[live_validate_miniapps] getApplicationLog failed, retrying: ${e instanceof Error ? e.message : String(e)}`);
    }
    await sleep(2000);
  }
  throw new Error(`timed out waiting for ${normalized}`);
}

function stackBytes(item) {
  if (!item || typeof item !== "object") return Buffer.alloc(0);
  if (item.type === "ByteString" || item.type === "Buffer") {
    return Buffer.from(String(item.value || ""), "base64");
  }
  if (item.type === "Integer") {
    let hex = BigInt(String(item.value || "0")).toString(16);
    if (hex.length % 2 !== 0) hex = `0${hex}`;
    return Buffer.from(hex, "hex");
  }
  return Buffer.alloc(0);
}

function stackValue(item) {
  if (!item || typeof item !== "object") return null;
  switch (item.type) {
    case "Integer":
      return String(item.value || "0");
    case "Boolean":
      return Boolean(item.value);
    case "ByteString": {
      const bytes = stackBytes(item);
      if (bytes.length === 20) {
        return `0x${Buffer.from(bytes).reverse().toString("hex")}`;
      }
      try {
        return bytes.toString("utf8");
      } catch {
        return item.value ?? null;
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

function executionReturnedTrue(execution) {
  const item = execution?.stack?.[0];
  if (!item) return false;
  if (item.type === "Boolean") return item.value === true;
  if (item.type === "Integer") return String(item.value || "0") !== "0";
  return false;
}

function findNotification(execution, contractHash, eventName) {
  const expected = String(contractHash).toLowerCase();
  return (execution.notifications || []).find(
    (entry) => String(entry.contract || "").toLowerCase() === expected && String(entry.eventname || "") === eventName,
  );
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

async function transferGAS(accountContract, fromAccount, toHash, amount, memo) {
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
  const txid = await adminNeo.invoke("transfer", [
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
  const fee = await invokeRead(ORACLE_HASH, "requestFee");
  const cleanHash = String(callbackContractHash).replace(/^0x/i, "");
  const callbackBytes = Buffer.from(cleanHash, "hex").reverse();
  return transferGAS(adminGas, admin, ORACLE_HASH, String(fee || "1000000"), callbackBytes);
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
  const before = BigInt(String(await invokeRead(contractHash, "getPoolBalance") || "0"));
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
  return { contractHash, transferTx, depositTx: asTxid(depositTx), withdrawTx: asTxid(withdrawTx), before: before.toString(), afterDeposit: afterDeposit.toString(), afterWithdraw: afterWithdraw.toString() };
}

async function runExFiles() {
  const contractHash = ADDRESSES.exfiles;
  const adminContract = appContract(contractHash, admin);
  const userContract = appContract(contractHash, user);
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
  return { contractHash, recordId, createTx: asTxid(createTx), queryTx: asTxid(queryTx), verifyTx: asTxid(verifyTx), reportTx: asTxid(reportTx), updateTx: asTxid(updateTx), deleteTx: asTxid(deleteTx) };
}

async function runMasqueradeDAO() {
  const contractHash = ADDRESSES.masqueradedao;
  const adminContract = appContract(contractHash, admin);
  const userContract = appContract(contractHash, user);
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
  return { contractHash, maskA, maskB, proposalId, createMaskAdminTx: asTxid(createMaskAdminTx), createMaskUserTx: asTxid(createMaskUserTx), proposalTx: asTxid(proposalTx), voteTx: asTxid(voteTx) };
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
  const { x, y } = await pickUnclaimedPiece(contractHash);

  await transferGAS(adminGas, admin, contractHash, "10000000", "miniapp-millionpiecemap:claim");
  const claimTx = await adminContract.invoke("claimPiece", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(String(x)),
    Neon.sc.ContractParam.integer(String(y)),
  ]);
  const claimLog = await waitForLog(claimTx);
  if (claimLog.execution.vmstate !== "HALT") throw new Error(claimLog.execution.exception || "claimPiece failed");

  const price = "11000000";
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
  return { contractHash, x, y, claimTx: asTxid(claimTx), listTx: asTxid(listTx), buyTx: asTxid(buyTx) };
}

async function runGraveyard() {
  const contractHash = ADDRESSES.graveyard;
  const contract = appContract(contractHash, admin);
  await transferGAS(adminGas, admin, contractHash, "110000000", "miniapp-graveyard:memory");
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
  return { contractHash, memoryId, buryTx: asTxid(buryTx), epitaphTx: asTxid(epitaphTx), forgetTx: asTxid(forgetTx) };
}

async function ensureSeason(contractHash, contract) {
  let seasonId = String(await invokeRead(contractHash, "currentSeasonId") || "0");
  let active = false;
  if (seasonId !== "0") {
    const season = await invokeRead(contractHash, "getSeasonDetails", [{ type: "Integer", value: seasonId }]);
    active = season.active === true;
  }
  if (!active) {
    const tx = await contract.invoke("startSeason", []);
    const log = await waitForLog(tx);
    if (log.execution.vmstate !== "HALT") throw new Error(log.execution.exception || "startSeason failed");
    seasonId = String(await invokeRead(contractHash, "currentSeasonId") || "0");
    return { seasonId, tx: asTxid(tx) };
  }
  return { seasonId, tx: null };
}

async function runHallOfFame() {
  const contractHash = ADDRESSES.halloffame;
  const adminContract = appContract(contractHash, admin);
  const userContract = appContract(contractHash, user);
  const season = await ensureSeason(contractHash, adminContract);
  const category = "projects";
  let nominee = "";
  let addNomineeTx = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    nominee = uniqueLabel("codex-nominee");
    try {
      addNomineeTx = await adminContract.invoke("addNominee", [
        Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
        Neon.sc.ContractParam.string(category),
        Neon.sc.ContractParam.string(nominee),
        Neon.sc.ContractParam.string("Codex smoke nominee"),
      ]);
      const nomineeLog = await waitForLog(addNomineeTx);
      if (nomineeLog.execution.vmstate !== "HALT") {
        throw new Error(nomineeLog.execution.exception || "addNominee failed");
      }
      break;
    } catch (error) {
      if (!String(error?.message || error).includes("nominee exists") || attempt === 4) {
        throw error;
      }
      nominee = "";
      addNomineeTx = null;
    }
  }
  if (!addNomineeTx || !nominee) throw new Error("unable to add nominee");

  const voteAmount = "10000000";
  await transferGAS(userGas, user, contractHash, voteAmount, "miniapp-hall-of-fame:vote");
  const voteTx = await userContract.invoke("vote", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.string(category),
    Neon.sc.ContractParam.string(nominee),
    Neon.sc.ContractParam.integer(voteAmount),
  ]);
  const voteLog = await waitForLog(voteTx);
  if (voteLog.execution.vmstate !== "HALT") throw new Error(voteLog.execution.exception || "vote failed");
  const details = await invokeRead(contractHash, "getNomineeDetails", [
    { type: "String", value: category },
    { type: "String", value: nominee },
  ]);
  if (BigInt(String(details.totalVotes || "0")) < BigInt(voteAmount)) throw new Error("nominee totalVotes did not increase");
  return { contractHash, seasonId: season.seasonId, startSeasonTx: season.tx, addNomineeTx: asTxid(addNomineeTx), voteTx: asTxid(voteTx), nominee };
}

async function runHeritageTrust() {
  const contractHash = ADDRESSES.heritagetrust;
  const contract = appContract(contractHash, admin);
  await transferNEO(admin, contractHash, "1", "miniapp-heritage-trust:create");

  const createTx = await contract.invoke("createTrust", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer("1"),
    Neon.sc.ContractParam.integer("7"),
    Neon.sc.ContractParam.string(uniqueLabel("Heritage")),
    Neon.sc.ContractParam.string("Codex smoke trust"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createTrust failed");
  const trustId = String(stackValue(findNotification(createLog.execution, contractHash, "TrustCreated")?.state?.value?.[0]));

  const guardianTx = await contract.invoke("addGuardian", [
    Neon.sc.ContractParam.integer(trustId),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
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
  return { contractHash, trustId, createTx: asTxid(createTx), guardianTx: asTxid(guardianTx), heartbeatTx: asTxid(heartbeatTx), cancelTx: asTxid(cancelTx) };
}

async function runDiceGame() {
  const contractHash = ADDRESSES.dicegame;
  const contract = appContract(contractHash, admin);
  const houseBalance = await getGasBalance(contractHash);
  if (houseBalance < 100000000n) {
    await transferGAS(adminGas, admin, contractHash, "100000000", null);
  }
  await topUpOracleCallbackCredit(contractHash);
  const betAmount = "5000000";
  await transferGAS(adminGas, admin, contractHash, betAmount, "miniapp-dicegame:bet");

  const placeTx = await contract.invoke("placeBet", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer("3"),
    Neon.sc.ContractParam.integer(betAmount),
  ]);
  const placeLog = await waitForLog(placeTx);
  if (placeLog.execution.vmstate !== "HALT") throw new Error(placeLog.execution.exception || "placeBet failed");
  const rngRequested = findNotification(placeLog.execution, contractHash, "RngRequested");
  const betId = String(stackValue(rngRequested?.state?.value?.[0]));
  const requestId = String(stackValue(rngRequested?.state?.value?.[1]));
  const resultBytes = crypto.randomBytes(32);
  const fulfillTx = await ensureOracleRequestFulfilled(requestId, "rng", resultBytes);
  let bet = await invokeRead(contractHash, "getBet", [{ type: "Integer", value: betId }]);
  const deadline = Date.now() + 45000;
  while (bet[4] !== true && Date.now() < deadline) {
    await sleep(2000);
    bet = await invokeRead(contractHash, "getBet", [{ type: "Integer", value: betId }]);
  }
  if (bet[4] !== true) throw new Error("bet not resolved after oracle fulfillment");
  const rolled = (BigInt(resultBytes[0]) % 6n) + 1n;
  const expectedPayout = rolled === 3n ? (BigInt(betAmount) * 6n * 95n) / 100n : 0n;
  return { contractHash, betId, requestId, placeTx: asTxid(placeTx), fulfillTx, rolled: rolled.toString(), expectedPayout: expectedPayout.toString() };
}

async function runGasCircle() {
  const contractHash = ADDRESSES.gascircle;
  const adminContract = appContract(contractHash, admin);
  const userContract = appContract(contractHash, user);
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
  const scriptHash = crypto.createHash("sha256").update("codex-turtle-match-v1").digest();

  const scriptInfo = await invokeRead(contractHash, "getScriptInfo", [{ type: "String", value: scriptName }]).catch((e) => {
    console.warn(`[warn] getScriptInfo(${scriptName}) failed: ${e.message} — treating as not registered`);
    return { exists: false };
  });
  if (!scriptInfo.exists) {
    const registerTx = await contract.invoke("registerScript", [
      Neon.sc.ContractParam.string(scriptName),
      Neon.sc.ContractParam.byteArray(scriptHash.toString("base64")),
    ]);
    const registerLog = await waitForLog(registerTx);
    if (registerLog.execution.vmstate !== "HALT") throw new Error(registerLog.execution.exception || "registerScript failed");
  }

  await transferGAS(adminGas, admin, contractHash, "30000000", "miniapp-turtle-match:play");
  const startTx = await contract.invoke("startGame", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer("3"),
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
    Neon.sc.ContractParam.byteArray(scriptHash.toString("base64")),
  ]);
  const settleLog = await waitForLog(settleTx);
  if (settleLog.execution.vmstate !== "HALT") throw new Error(settleLog.execution.exception || "settleGame failed");
  const session = await invokeRead(contractHash, "getSession", [{ type: "Integer", value: sessionId }]);
  if (session[6] !== true) throw new Error("session not settled");
  return { contractHash, sessionId, matches: matches.toString(), reward: reward.toString(), startTx: asTxid(startTx), settleTx: asTxid(settleTx) };
}

async function runAll() {
  const results = {};
  const tasks = [
    ["flashloan", runFlashLoanBasic],
    ["exfiles", runExFiles],
    ["masqueradedao", runMasqueradeDAO],
    ["millionpiecemap", runMillionPieceMap],
    ["graveyard", runGraveyard],
    ["halloffame", runHallOfFame],
    ["heritagetrust", runHeritageTrust],
    ["dicegame", runDiceGame],
    ["gascircle", runGasCircle],
    ["turtlematch", runTurtleMatch],
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
