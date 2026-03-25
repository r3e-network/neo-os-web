#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  sleep,
  asTxid,
  stackValue,
  executionReturnedTrue,
  findNotification,
  createWaitForLog,
} = require("./lib/live_neo");
let Neon;
const { getManifestContractHash, getNetworkConfig, normalizeNetworkName } = require("./lib/neo_network");

const root = path.resolve(__dirname, "..", "..");
const siblingOracleEnvPath = path.resolve(root, "..", "neo-morpheus-oracle", ".env");
const siblingOracleEnvLocalPath = path.resolve(root, "..", "neo-morpheus-oracle", ".env.local");
const siblingEdgeGatewayConfigPath = path.resolve(
  root,
  "..",
  "neo-morpheus-oracle",
  "deploy",
  "cloudflare",
  "morpheus-edge-gateway",
  "wrangler.meshmini.toml"
);
const TARGET_NETWORK = normalizeNetworkName(process.env.NEO_TARGET_NETWORK || process.env.FLAGSHIP_NETWORK) || "testnet";
const siblingOraclePhalaEnvPath = path.resolve(
  root,
  "..",
  "neo-morpheus-oracle",
  "deploy",
  "phala",
  TARGET_NETWORK === "mainnet" ? "morpheus.mainnet.env" : "morpheus.testnet.env"
);
const NETWORK_CONFIG = getNetworkConfig(TARGET_NETWORK);
const RPC_URL = process.env.NEO_RPC_URL || NETWORK_CONFIG.rpcUrl;
const NETWORK_MAGIC = Number(process.env.NEO_NETWORK_MAGIC || NETWORK_CONFIG.networkMagic);
const WIF =
  process.env.FLAGSHIP_LIVE_WIF ||
  process.env.DEPLOYER_WIF ||
  process.env.AA_TEST_WIF ||
  process.env.ORACLE_TEST_WIF ||
  (TARGET_NETWORK === "mainnet" ? process.env.NEO_MAINNET_WIF : "") ||
  process.env.FLAGSHIP_TESTNET_WIF ||
  process.env.NEO_TESTNET_WIF ||
  "";
const ORACLE_HASH = (process.env.MORPHEUS_ORACLE_HASH || NETWORK_CONFIG.oracleHash).trim();
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const LIVE_TARGET_FILTER = new Set(
  String(process.env.FLAGSHIP_LIVE_TARGETS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const RNG_FALLBACK_ENABLED = !["0", "false", "no", "off"].includes(
  String(process.env.MORPHEUS_LIVE_VALIDATE_RNG_FALLBACK || "1").trim().toLowerCase()
);
const RNG_FALLBACK_LEAD_MS = Math.max(
  0,
  Number(process.env.MORPHEUS_LIVE_VALIDATE_RNG_FALLBACK_LEAD_MS || "15000")
);

const DAILY_CHECKIN_FEE = "100000";
const FOGPLAY_BET = "5000000";
const RED_ENVELOPE_TOTAL = "10000000";
const SELF_LOAN_POOL_TOPUP = process.env.SELF_LOAN_POOL_TOPUP || "30000000";
const SELF_LOAN_COLLATERAL = "1";

function loadOptionalEnvFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const env = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const siblingOracleEnv = loadOptionalEnvFile(siblingOracleEnvPath);
const siblingOracleEnvLocal = loadOptionalEnvFile(siblingOracleEnvLocalPath);
const siblingOraclePhalaEnv = loadOptionalEnvFile(siblingOraclePhalaEnvPath);
const siblingEdgeGatewayConfig = loadOptionalEnvFile(siblingEdgeGatewayConfigPath);

function resolvePhalaRuntimeUrl() {
  const explicit = String(
    process.env.MORPHEUS_RUNTIME_URL
      || process.env.PHALA_API_URL
      || ""
  ).trim();
  if (explicit) return explicit;

  const networkScoped = String(
    TARGET_NETWORK === "mainnet"
      ? (process.env.MORPHEUS_MAINNET_RUNTIME_URL || process.env.MORPHEUS_MAINNET_PHALA_API_URL || "")
      : (process.env.MORPHEUS_TESTNET_RUNTIME_URL || process.env.MORPHEUS_TESTNET_PHALA_API_URL || "")
  ).trim();
  if (networkScoped) return networkScoped;

  const siblingEnvScoped = String(
    TARGET_NETWORK === "mainnet"
      ? (siblingOracleEnv.MORPHEUS_MAINNET_RUNTIME_URL || siblingOracleEnv.PHALA_API_URL_MAINNET || "")
      : (siblingOracleEnv.MORPHEUS_TESTNET_RUNTIME_URL || siblingOracleEnv.PHALA_API_URL_TESTNET || "")
  ).trim();
  if (siblingEnvScoped) return siblingEnvScoped;

  const siblingEdgeOrigin = String(
    TARGET_NETWORK === "mainnet"
      ? (siblingEdgeGatewayConfig.MORPHEUS_MAINNET_ORIGIN_URL || siblingEdgeGatewayConfig.MORPHEUS_ORIGIN_URL || "")
      : (siblingEdgeGatewayConfig.MORPHEUS_TESTNET_ORIGIN_URL || siblingEdgeGatewayConfig.MORPHEUS_ORIGIN_URL || "")
  ).trim();
  if (siblingEdgeOrigin) return siblingEdgeOrigin;

  const siblingEnvDirect = String(
    siblingOracleEnv.MORPHEUS_RUNTIME_URL
      || siblingOracleEnv.PHALA_API_URL
      || ""
  ).trim();
  if (siblingEnvDirect) return siblingEnvDirect;

  const customDomain = String(
    TARGET_NETWORK === "mainnet"
      ? (siblingOracleEnvLocal.MORPHEUS_MAINNET_CUSTOM_DOMAIN || "")
      : (siblingOracleEnvLocal.MORPHEUS_TESTNET_CUSTOM_DOMAIN || "")
  ).trim();
  if (customDomain) {
    return /^https?:\/\//i.test(customDomain) ? customDomain : `https://${customDomain}`;
  }

  if (TARGET_NETWORK === "mainnet") return "https://oracle.meshmini.app/mainnet";
  return "https://oracle.meshmini.app/testnet";
}

const PHALA_API_URL = resolvePhalaRuntimeUrl();
const PHALA_API_TOKEN = String(
  process.env.MORPHEUS_RUNTIME_TOKEN
    || process.env.PHALA_API_TOKEN
    || process.env.PHALA_SHARED_SECRET
    || siblingOracleEnv.MORPHEUS_RUNTIME_TOKEN
    || siblingOracleEnv.PHALA_API_TOKEN
    || siblingOracleEnv.PHALA_SHARED_SECRET
    || ""
).trim();
const ORACLE_UPDATER_WIF = String(
  process.env.MORPHEUS_ORACLE_UPDATER_WIF
    || process.env.MORPHEUS_RELAYER_NEO_N3_WIF
    || siblingOraclePhalaEnv.MORPHEUS_RELAYER_NEO_N3_WIF
    || siblingOraclePhalaEnv.PHALA_NEO_N3_WIF
    || ""
).trim();

if (!WIF) {
  console.error("FLAGSHIP_LIVE_WIF / DEPLOYER_WIF / network-specific Neo WIF is required");
  process.exit(1);
}

let account;
let oracleUpdaterAccount;
let rpcClient;
let gasContract;
let neoContract;
const waitForLog = createWaitForLog({
  getApplicationLog: (txid) => rpcClient.getApplicationLog(txid),
  label: "live_validate_flows",
});

async function initNeon() {
  if (Neon) return;
  Neon = (await import("./lib/neon-compat.mjs")).default;
  account = new Neon.wallet.Account(WIF);
  oracleUpdaterAccount = ORACLE_UPDATER_WIF ? new Neon.wallet.Account(ORACLE_UPDATER_WIF) : account;
  rpcClient = new Neon.rpc.RPCClient(RPC_URL);
  gasContract = new Neon.experimental.SmartContract(GAS_HASH, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });
  neoContract = new Neon.experimental.SmartContract(NEO_HASH, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });
}

function sha256Buffer(value) {
  const buffer = Buffer.isBuffer(value)
    ? value
    : value instanceof Uint8Array
      ? Buffer.from(value)
      : Buffer.from(String(value ?? ""), "utf8");
  return crypto.createHash("sha256").update(buffer).digest();
}

function encodeUint256Bytes(value) {
  const numeric = BigInt(String(value ?? "0"));
  if (numeric < 0n) throw new Error("uint256 value must be non-negative");
  return Buffer.from(numeric.toString(16).padStart(64, "0"), "hex");
}

function buildRngFulfillmentDigestHex(requestId, requestType, success, resultBytes) {
  const domain = Buffer.from("morpheus-fulfillment-v2", "utf8");
  const successByte = Buffer.from([success ? 1 : 0]);
  const payload = Buffer.concat([
    domain,
    encodeUint256Bytes(requestId),
    sha256Buffer(String(requestType || "")),
    successByte,
    sha256Buffer(resultBytes),
    sha256Buffer(""),
  ]);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function callPhala(pathname, payload) {
  if (!PHALA_API_URL || !PHALA_API_TOKEN) {
    throw new Error("MORPHEUS_RUNTIME_URL / MORPHEUS_RUNTIME_TOKEN unavailable for local rng fallback");
  }
  const res = await fetch(`${PHALA_API_URL.replace(/\/$/, "")}${pathname}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${PHALA_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.json().catch((e) => {
    console.warn(`[warn] ${pathname}: non-JSON response (status ${res.status}): ${e.message}`);
    return {};
  });
  if (!res.ok) {
    throw new Error(body?.error || body?.message || `${pathname} failed with ${res.status}`);
  }
  return body;
}

async function forceFulfillRngRequest(requestId, requestType = "vrf_random") {
  console.error(`[rng-fallback] request ${requestId} (${requestType})`);
  const vrf = await callPhala("/vrf/random", {
    request_id: String(requestId),
    target_chain: "neo_n3",
  });
  const resultBytes = Buffer.from(String(vrf.randomness || "").replace(/^0x/i, ""), "hex");
  if (resultBytes.length !== 32) {
    throw new Error(`unexpected vrf randomness length for request ${requestId}`);
  }
  const digestHex = buildRngFulfillmentDigestHex(requestId, requestType, true, resultBytes);
  const verificationSignature = Neon.wallet.sign(digestHex, oracleUpdaterAccount.privateKey);
  const oracle = new Neon.experimental.SmartContract(ORACLE_HASH, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account: oracleUpdaterAccount,
  });
  const txid = await oracle.invoke("fulfillRequest", [
    Neon.sc.ContractParam.integer(String(requestId)),
    Neon.sc.ContractParam.boolean(true),
    Neon.sc.ContractParam.byteArray(Neon.u.HexString.fromHex(resultBytes.toString("hex"), true)),
    Neon.sc.ContractParam.string(""),
    Neon.sc.ContractParam.byteArray(Neon.u.HexString.fromHex(String(verificationSignature || "").replace(/^0x/i, ""), true)),
  ]);
  const normalized = asTxid(txid);
  const { execution } = await waitForLog(normalized);
  if (execution.vmstate !== "HALT") {
    throw new Error(execution.exception || `manual rng fulfill failed for ${requestId}`);
  }
  console.error(`[rng-fallback-ok] request ${requestId} tx ${normalized}`);
  return normalized;
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function appHash(manifestRel) {
  const manifest = readJson(manifestRel);
  return getManifestContractHash(manifest, TARGET_NETWORK);
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
    memo == null
      ? Neon.sc.ContractParam.any(null)
      : typeof memo === "string"
        ? Neon.sc.ContractParam.string(memo)
        : Neon.sc.ContractParam.hash160(memo),
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

async function transferNEO(toHash, amount, memo) {
  const txid = await neoContract.invoke("transfer", [
    Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
    Neon.sc.ContractParam.hash160(toHash),
    Neon.sc.ContractParam.integer(String(amount)),
    memo == null
      ? Neon.sc.ContractParam.any(null)
      : typeof memo === "string"
        ? Neon.sc.ContractParam.string(memo)
        : Neon.sc.ContractParam.hash160(memo),
  ]);
  const { execution } = await waitForLog(txid);
  if (execution.vmstate !== "HALT") {
    throw new Error(execution.exception || `NEO transfer failed for ${toHash}`);
  }
  if (!executionReturnedTrue(execution)) {
    throw new Error(`NEO transfer returned false for ${toHash}`);
  }
  return asTxid(txid);
}

async function waitForRequestStatus(requestId, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  let forced = false;
  let fallbackError = null;
  while (Date.now() < deadline) {
    const request = await invokeRead(ORACLE_HASH, "getRequest", [{ type: "Integer", value: String(requestId) }]);
    const completed = Array.isArray(request) && (
      String(request[6] || "0") !== "0"
      || String(request[8] || "0") !== "0"
      || String(request[10] || "") !== ""
      || String(request[11] || "") !== ""
    );
    if (completed) {
      return request;
    }
    const requestType = String(request[1] || "").toLowerCase();
    if (
      RNG_FALLBACK_ENABLED
      && !forced
      && Date.now() + RNG_FALLBACK_LEAD_MS >= deadline
      && Array.isArray(request)
      && (requestType === "rng" || requestType.includes("vrf") || requestType.includes("random"))
    ) {
      try {
        await forceFulfillRngRequest(requestId, requestType);
      } catch (error) {
        fallbackError = String(error?.message || error);
        console.error(`[rng-fallback-fail] request ${requestId}: ${fallbackError}`);
      }
      forced = true;
    }
    await sleep(2000);
  }
  throw new Error(`timed out waiting for oracle request ${requestId}${fallbackError ? ` (${fallbackError})` : ""}`);
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
  const contractHash = appHash("apps/gasbox/neo-manifest.json");
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
  const contractHash = appHash("apps/daily-checkin/neo-manifest.json");
  const txid = await transferGAS(contractHash, DAILY_CHECKIN_FEE, "miniapp-dailycheckin:checkin");
  const { execution } = await waitForLog(txid);
  const checkedIn = findNotification(execution, contractHash, "CheckedIn");
  if (!checkedIn) {
    throw new Error("CheckedIn notification missing");
  }
  return { contractHash, txid };
}

async function runLastSurvivor() {
  const contractHash = appHash("apps/last-survivor/neo-manifest.json");
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

    const paymentTx = await transferGAS(contractHash, String(cost), `miniapp-last-survivor:buy:${roundId}`);
    await sleep(4000);
    const buyTx = await contract.invoke("buyKeysWithCost", [
      Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`),
      Neon.sc.ContractParam.integer("1"),
      Neon.sc.ContractParam.integer(String(cost)),
    ]);
    const { execution } = await waitForLog(buyTx);
    if (execution.vmstate !== "HALT") {
      throw new Error(execution.exception || "buyKeysWithCost failed");
    }
    return {
      cost: String(cost),
      paymentTx,
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
    buyTx: result.buyTx,
    after,
    userKeys,
  };
}

async function runFogPlay() {
  const contractHash = appHash("apps/fogplay/neo-manifest.json");
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
  if (String(request?.[9] || false) !== "true" && request?.[9] !== true) {
    throw new Error(`oracle rng request ${requestId} failed: ${String(request?.[11] || "unknown error")}`);
  }
  const bet = await invokeRead(contractHash, "getBet", [{ type: "Integer", value: String(betId) }]);
  return { contractHash, oracleFeeTx, transferTx, betTx: asTxid(betTx), requestId, request, betId, bet };
}

async function runRedEnvelope() {
  const contractHash = appHash("apps/red-envelope/neo-manifest.json");
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
    Neon.sc.ContractParam.integer("86400000"),
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
  if (String(request?.[9] || false) !== "true" && request?.[9] !== true) {
    throw new Error(`oracle rng request ${requestId} failed: ${String(request?.[11] || "unknown error")}`);
  }
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
  const contractHash = appHash("apps/self-loan/neo-manifest.json");
  const contract = new Neon.experimental.SmartContract(contractHash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });

  const neoBalance = await rpcClient.execute(new Neon.rpc.Query({
    method: "getnep17balances",
    params: [account.address],
  }));
  const neoAsset = Array.isArray(neoBalance?.balance)
    ? neoBalance.balance.find((entry) => String(entry.assethash || "").toLowerCase() === NEO_HASH.toLowerCase())
    : null;
  const availableNeo = Number(neoAsset?.amount || "0");
  if (!Number.isFinite(availableNeo) || availableNeo < Number(SELF_LOAN_COLLATERAL)) {
    throw new Error(`insufficient wallet NEO balance for selfLoan collateral: need ${SELF_LOAN_COLLATERAL}, have ${neoAsset?.amount || "0"}`);
  }

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
  const contractHash = appHash("apps/neo-pay/neo-manifest.json");
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
  await initNeon();
  const summary = {
    generatedAt: new Date().toISOString(),
    targetNetwork: TARGET_NETWORK,
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
    if (LIVE_TARGET_FILTER.size > 0 && !LIVE_TARGET_FILTER.has(label)) {
      summary.results[label] = { skipped: true };
      continue;
    }
    const startedAt = Date.now();
    console.error(`[run] ${label} (${TARGET_NETWORK})`);
    try {
      summary.results[label] = { ok: true, ...(await runner()) };
      console.error(`[ok] ${label} (${Math.round((Date.now() - startedAt) / 1000)}s)`);
    } catch (error) {
      failed = true;
      summary.results[label] = { ok: false, error: String(error?.message || error) };
      console.error(`[fail] ${label}: ${String(error?.message || error)}`);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
