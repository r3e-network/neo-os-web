#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  asTxid,
  stackValue,
  createWaitForLog,
  withStep,
} = require("./lib/live_neo");
let Neon;

const ROOT = path.resolve(__dirname, "../..");
const RPC_URL = process.env.NEO_RPC_URL || process.env.NEO_TESTNET_RPC_URL || "https://api.n3index.dev/testnet";
const NETWORK_MAGIC = Number(process.env.NEO_NETWORK_MAGIC || "894710606");
const ADMIN_WIF = process.env.TEST_SMOKE_ADMIN_WIF || process.env.MINIAPP_UPDATE_WIF || process.env.FLAGSHIP_LIVE_WIF || "";
const USER_WIF = process.env.TEST_SMOKE_USER_WIF || process.env.NEO_TESTNET_WIF || ADMIN_WIF;
const OUTPUT_PATH = String(
  process.env.AA_NS_MINIAPP_SMOKE_REPORT_PATH ||
    path.join(ROOT, "docs", "reports", "live-smoke", "aa-ns-miniapps.json")
);
const TARGET_FILTER = String(process.env.AA_NS_MINIAPP_SMOKE_TARGETS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const HASHES = {
  aaCore: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
  aaMarket: "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf",
  aaSessionKeyVerifier: "0xed44c88535650b4dd6b8d59776e6ed045462cab6",
  neoNs: "0x50ac1c37690cc2cfc594472833cf57505d5f46de",
};
const ZERO_HASH = "0x0000000000000000000000000000000000000000";
const DEFAULT_ESCAPE_TIMELOCK = 2592000;
const NNS_RECORD_TYPE_ADDRESS = 16;

if (!ADMIN_WIF || !USER_WIF) {
  console.error("TEST_SMOKE_ADMIN_WIF and TEST_SMOKE_USER_WIF are required");
  process.exit(1);
}

let admin;
let user;
let rpc;
let aaCore;
let aaMarket;
let sessionVerifier;
let neoNs;
const waitForLog = createWaitForLog({
  getApplicationLog: (txid) => rpc.getApplicationLog(txid),
  label: "live_validate_aa_ns",
});

function strip0x(value) {
  return String(value || "").trim().replace(/^0x/i, "").toLowerCase();
}

function hash160HexFromHex(hex) {
  const bytes = Buffer.from(strip0x(hex), "hex");
  return crypto.createHash("ripemd160").update(crypto.createHash("sha256").update(bytes).digest()).digest("hex");
}

function uint32LittleEndianHex(value) {
  const n = Number(value);
  return [
    n & 0xff,
    (n >>> 8) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 24) & 0xff,
  ].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function deriveRegistrationAccountIdHash({
  backupOwnerHash,
  verifierHash = ZERO_HASH,
  hookHash = ZERO_HASH,
  escapeTimelock = DEFAULT_ESCAPE_TIMELOCK,
  verifierParamsHex = "",
}) {
  return `0x${hash160HexFromHex([
    "aa524701",
    strip0x(backupOwnerHash),
    strip0x(verifierHash),
    strip0x(hookHash),
    uint32LittleEndianHex(escapeTimelock),
    strip0x(verifierParamsHex),
  ].join(""))}`;
}

function uniqueHex(label) {
  return Buffer.from(`${label}:${Date.now()}:${crypto.randomBytes(8).toString("hex")}`, "utf8").toString("hex");
}

function toByteArrayParamFromHex(hex) {
  return Neon.sc.ContractParam.byteArray(Buffer.from(strip0x(hex), "hex").toString("base64"));
}

function hash160Param(value) {
  return Neon.sc.ContractParam.hash160(value);
}

async function initNeon() {
  if (Neon) return;
  Neon = (await import("./lib/neon-compat.mjs")).default;
  admin = new Neon.wallet.Account(ADMIN_WIF);
  user = new Neon.wallet.Account(USER_WIF);
  rpc = new Neon.rpc.RPCClient(RPC_URL);
  aaCore = new Neon.experimental.SmartContract(HASHES.aaCore, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
  aaMarket = new Neon.experimental.SmartContract(HASHES.aaMarket, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
  sessionVerifier = new Neon.experimental.SmartContract(HASHES.aaSessionKeyVerifier, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
  neoNs = new Neon.experimental.SmartContract(HASHES.neoNs, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
}

async function invokeRead(contractHash, operation, args = []) {
  const res = await rpc.invokeFunction(contractHash, operation, args);
  if (String(res?.state || "").toUpperCase() === "FAULT") {
    throw new Error(`${operation} faulted: ${res.exception || "unknown error"}`);
  }
  return res.stack?.[0] ? stackValue(res.stack[0]) : null;
}

async function invokeAndWait(contract, step, operation, args, signers = undefined) {
  const tx = await withStep(`${step}.invoke`, () => contract.invoke(operation, args, signers));
  const log = await withStep(`${step}.waitForLog`, () => waitForLog(tx));
  if (log.execution.vmstate !== "HALT") {
    throw new Error(log.execution.exception || `${step} failed`);
  }
  return { tx: asTxid(tx), log };
}

function buildMarketEscrowSigner() {
  return [{
    account: admin.scriptHash,
    scopes: "CustomContracts",
    allowedcontracts: [HASHES.aaMarket, HASHES.aaCore],
  }];
}

async function registerAaAccount(label, options = {}) {
  const verifierParamsHex = options.verifierParamsHex ?? uniqueHex(label);
  const backupOwnerHash = `0x${admin.scriptHash}`;
  const verifierHash = options.verifierHash || ZERO_HASH;
  const hookHash = options.hookHash || ZERO_HASH;
  const accountId = deriveRegistrationAccountIdHash({
    backupOwnerHash,
    verifierHash,
    hookHash,
    verifierParamsHex,
  });
  const registration = await invokeAndWait(aaCore, `${label}.registerAccount`, "registerAccount", [
    hash160Param(accountId),
    hash160Param(verifierHash),
    toByteArrayParamFromHex(verifierParamsHex),
    hash160Param(hookHash),
    hash160Param(backupOwnerHash),
    Neon.sc.ContractParam.integer(String(DEFAULT_ESCAPE_TIMELOCK)),
  ]);
  const [backupOwner, verifier, hook, nonce] = await Promise.all([
    withStep(`${label}.getBackupOwner`, () => invokeRead(HASHES.aaCore, "getBackupOwner", [hash160Param(accountId)])),
    withStep(`${label}.getVerifier`, () => invokeRead(HASHES.aaCore, "getVerifier", [hash160Param(accountId)])),
    withStep(`${label}.getHook`, () => invokeRead(HASHES.aaCore, "getHook", [hash160Param(accountId)])),
    withStep(`${label}.getNonce`, () => invokeRead(HASHES.aaCore, "getNonce", [hash160Param(accountId), Neon.sc.ContractParam.integer("0")])),
  ]);
  return { accountId, registrationTx: registration.tx, backupOwner, verifier, hook, nonce };
}

async function runAccountLab() {
  const accountState = await registerAaAccount("aa-account-lab");
  return {
    appId: "miniapp-aa-account-lab",
    contractHash: HASHES.aaCore,
    ...accountState,
  };
}

async function runPermissionsLab() {
  const accountState = await registerAaAccount("aa-permissions-lab");
  const updateHook = await invokeAndWait(aaCore, "aa-permissions-lab.updateHook", "updateHook", [
    hash160Param(accountState.accountId),
    hash160Param(ZERO_HASH),
  ]);
  const updateVerifier = await invokeAndWait(aaCore, "aa-permissions-lab.updateVerifier", "updateVerifier", [
    hash160Param(accountState.accountId),
    hash160Param(ZERO_HASH),
    toByteArrayParamFromHex(""),
  ]);
  const [pendingVerifier, pendingHook] = await Promise.all([
    withStep("aa-permissions-lab.hasPendingVerifierUpdate", () =>
      invokeRead(HASHES.aaCore, "hasPendingVerifierUpdate", [hash160Param(accountState.accountId)])
    ),
    withStep("aa-permissions-lab.hasPendingHookUpdate", () =>
      invokeRead(HASHES.aaCore, "hasPendingHookUpdate", [hash160Param(accountState.accountId)])
    ),
  ]);
  return {
    appId: "miniapp-aa-permissions-lab",
    contractHash: HASHES.aaCore,
    accountId: accountState.accountId,
    registrationTx: accountState.registrationTx,
    updateHookTx: updateHook.tx,
    updateVerifierTx: updateVerifier.tx,
    pendingVerifier,
    pendingHook,
  };
}

async function runRelayConsole() {
  const accountState = await registerAaAccount("aa-relay-console");
  const [isExecutionActive, singleMode, batchMode, nonce] = await Promise.all([
    withStep("aa-relay-console.isExecutionActive", () =>
      invokeRead(HASHES.aaCore, "isExecutionActive", [hash160Param(accountState.accountId)])
    ),
    withStep("aa-relay-console.supportsExecutionMode.single", () =>
      invokeRead(HASHES.aaCore, "supportsExecutionMode", [Neon.sc.ContractParam.string("single")])
    ),
    withStep("aa-relay-console.supportsExecutionMode.batch", () =>
      invokeRead(HASHES.aaCore, "supportsExecutionMode", [Neon.sc.ContractParam.string("batch")])
    ),
    withStep("aa-relay-console.getNonce", () =>
      invokeRead(HASHES.aaCore, "getNonce", [hash160Param(accountState.accountId), Neon.sc.ContractParam.integer("0")])
    ),
  ]);
  return {
    appId: "miniapp-aa-relay-console",
    contractHash: HASHES.aaCore,
    accountId: accountState.accountId,
    registrationTx: accountState.registrationTx,
    isExecutionActive,
    supportsExecutionMode: { single: singleMode, batch: batchMode },
    nonce,
  };
}

async function runMarketHub() {
  const accountState = await registerAaAccount("aa-market-hub");
  const countBefore = Number(await withStep("aa-market-hub.getListingCount.before", () =>
    invokeRead(HASHES.aaMarket, "getListingCount")
  ));
  const create = await invokeAndWait(aaMarket, "aa-market-hub.createListing", "createListing", [
    hash160Param(HASHES.aaCore),
    hash160Param(accountState.accountId),
    Neon.sc.ContractParam.integer("1000000"),
    Neon.sc.ContractParam.string(`Codex AA ${Date.now()}`),
    Neon.sc.ContractParam.string("codex-live-smoke"),
  ], buildMarketEscrowSigner());
  const countAfter = Number(await withStep("aa-market-hub.getListingCount.after", () =>
    invokeRead(HASHES.aaMarket, "getListingCount")
  ));
  if (!Number.isFinite(countAfter) || countAfter <= countBefore) {
    throw new Error(`listing count did not increase: before=${countBefore} after=${countAfter}`);
  }
  const listingId = String(countAfter);
  const listing = await withStep("aa-market-hub.getListing.created", () =>
    invokeRead(HASHES.aaMarket, "getListing", [Neon.sc.ContractParam.integer(listingId)])
  );
  const update = await invokeAndWait(aaMarket, "aa-market-hub.updateListingPrice", "updateListingPrice", [
    Neon.sc.ContractParam.integer(listingId),
    Neon.sc.ContractParam.integer("2000000"),
  ], buildMarketEscrowSigner());
  const cancel = await invokeAndWait(aaMarket, "aa-market-hub.cancelListing", "cancelListing", [
    Neon.sc.ContractParam.integer(listingId),
  ], buildMarketEscrowSigner());
  const cancelledListing = await withStep("aa-market-hub.getListing.cancelled", () =>
    invokeRead(HASHES.aaMarket, "getListing", [Neon.sc.ContractParam.integer(listingId)])
  );
  return {
    appId: "miniapp-aa-market-hub",
    contractHash: HASHES.aaMarket,
    accountId: accountState.accountId,
    registrationTx: accountState.registrationTx,
    createListingTx: create.tx,
    updateListingPriceTx: update.tx,
    cancelListingTx: cancel.tx,
    listingId,
    listing,
    cancelledListing,
  };
}

async function runSessionKeyLab() {
  const accountState = await registerAaAccount("aa-session-key-lab");
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const publicKey = ecdh.getPublicKey(null, "compressed");
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const targetContract = `0x${admin.scriptHash}`;
  const payload = await withStep("aa-session-key-lab.getPayload", () =>
    invokeRead(HASHES.aaSessionKeyVerifier, "getPayload", [
      hash160Param(accountState.accountId),
      hash160Param(targetContract),
      Neon.sc.ContractParam.string("*"),
      { type: "Array", value: [] },
      Neon.sc.ContractParam.integer("0"),
      Neon.sc.ContractParam.integer(String(expiresAt)),
    ])
  );
  const before = await withStep("aa-session-key-lab.getSessionKey.before", () =>
    invokeRead(HASHES.aaSessionKeyVerifier, "getSessionKey", [hash160Param(accountState.accountId)])
  );

  let setSessionKeyTx = "";
  let after = before;
  try {
    const setSessionKey = await invokeAndWait(sessionVerifier, "aa-session-key-lab.setSessionKey", "setSessionKey", [
      hash160Param(accountState.accountId),
      Neon.sc.ContractParam.byteArray(publicKey.toString("base64")),
      hash160Param(targetContract),
      Neon.sc.ContractParam.string("*"),
      Neon.sc.ContractParam.integer(String(expiresAt)),
    ]);
    setSessionKeyTx = setSessionKey.tx;
    after = await withStep("aa-session-key-lab.getSessionKey.after", () =>
      invokeRead(HASHES.aaSessionKeyVerifier, "getSessionKey", [hash160Param(accountState.accountId)])
    );
  } catch (error) {
    return {
      appId: "miniapp-aa-session-key-lab",
      contractHash: HASHES.aaSessionKeyVerifier,
      accountId: accountState.accountId,
      registrationTx: accountState.registrationTx,
      payload,
      sessionKeyBefore: before,
      setSessionKeyStatus: "blocked",
      setSessionKeyError: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    appId: "miniapp-aa-session-key-lab",
    contractHash: HASHES.aaSessionKeyVerifier,
    accountId: accountState.accountId,
    registrationTx: accountState.registrationTx,
    payload,
    sessionKeyBefore: before,
    setSessionKeyTx,
    sessionKeyAfter: after,
  };
}

async function runNeoNs() {
  const baseName = `codex${Date.now()}${crypto.randomBytes(2).toString("hex")}`;
  const domain = `${baseName}.neo`;
  const availableBefore = await withStep("neo-ns.isAvailable.before", () =>
    invokeRead(HASHES.neoNs, "isAvailable", [Neon.sc.ContractParam.string(domain)])
  );
  if (availableBefore !== true) {
    throw new Error(`${domain} is unexpectedly unavailable before registration`);
  }
  const register = await invokeAndWait(neoNs, "neo-ns.register", "register", [
    Neon.sc.ContractParam.string(domain),
    hash160Param(`0x${admin.scriptHash}`),
  ]);
  const availableAfter = await withStep("neo-ns.isAvailable.after", () =>
    invokeRead(HASHES.neoNs, "isAvailable", [Neon.sc.ContractParam.string(domain)])
  );
  const setRecord = await invokeAndWait(neoNs, "neo-ns.setRecord", "setRecord", [
    Neon.sc.ContractParam.string(domain),
    Neon.sc.ContractParam.integer(String(NNS_RECORD_TYPE_ADDRESS)),
    Neon.sc.ContractParam.string(admin.address),
  ]);
  const record = await withStep("neo-ns.getRecord", () =>
    invokeRead(HASHES.neoNs, "getRecord", [
      Neon.sc.ContractParam.string(domain),
      Neon.sc.ContractParam.integer(String(NNS_RECORD_TYPE_ADDRESS)),
    ])
  );
  if (record !== admin.address) throw new Error(`record mismatch for ${domain}`);
  return {
    appId: "miniapp-neo-ns",
    contractHash: HASHES.neoNs,
    domain,
    registerTx: register.tx,
    setRecordTx: setRecord.tx,
    availableBefore,
    availableAfter,
    record,
  };
}

function selectTasks(tasks) {
  const available = tasks.map(([label]) => label);
  const requested = TARGET_FILTER;
  const unknown = requested.filter((label) => !available.includes(label));
  const selected = requested.length > 0 ? available.filter((label) => requested.includes(label)) : available;
  return { available, requested, selected, unknown };
}

async function runAll() {
  await initNeon();
  const tasks = [
    ["account", runAccountLab],
    ["permissions", runPermissionsLab],
    ["relay", runRelayConsole],
    ["market", runMarketHub],
    ["session", runSessionKeyLab],
    ["neons", runNeoNs],
  ];
  const targetInfo = selectTasks(tasks);
  if (targetInfo.unknown.length > 0) {
    throw new Error(`unknown AA_NS_MINIAPP_SMOKE_TARGETS entries: ${targetInfo.unknown.join(", ")}; valid targets: ${targetInfo.available.join(", ")}`);
  }

  const results = {};
  for (const [label, fn] of tasks) {
    if (!targetInfo.selected.includes(label)) continue;
    try {
      results[label] = { status: "pass", details: await withStep(`aa-ns.${label}`, fn) };
    } catch (error) {
      results[label] = { status: "fail", error: error instanceof Error ? error.message : String(error) };
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    rpcUrl: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    adminAddress: admin.address,
    userAddress: user.address,
    targetInfo,
    results,
  };
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2) + "\n");
  console.log(`Report: ${OUTPUT_PATH}`);

  const failed = Object.entries(results).filter(([, value]) => value.status !== "pass");
  if (failed.length > 0) {
    throw new Error(`AA/NeoNS live smoke failed: ${failed.map(([label]) => label).join(", ")}`);
  }
}

runAll().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
