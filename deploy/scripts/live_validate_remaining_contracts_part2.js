#!/usr/bin/env node

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
const OUTPUT_PATH = String(
  process.env.REMAINING_MINIAPP_SMOKE_PART2_REPORT_PATH
    || path.join(ROOT, "docs", "reports", "live-smoke", "remaining-contracts-part2.json"),
);
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
  eventticket: "0x7792dbe7cd09c3d65971d010e36e6f03bbf4df72",
  gassponsor: "0x31888679572bf2de61462ff9934b6265d60284f2",
  memorial: "0x87f0fe2ba69cd973a3274471234d3cc13ef943c5",
  milestone: "0x2a3691aa2da68512e9bf1363f383f354b6a02aad",
  soulbound: "0x14a4101b5098c38a18bebeb79dc809c80ff87f9e",
  trustanchor: "0x57e6e62e0a123ac8bac2ab58636d50b54ef054f2",
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
  label: "live_validate_p2",
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

async function runEventTicket() {
  const hash = ADDRESSES.eventticket;
  const adminContract = appContract(hash, admin);
  const createTx = await adminContract.invoke("createEvent", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.string(uniqueLabel("Event")),
    Neon.sc.ContractParam.string("NeoTokyo"),
    Neon.sc.ContractParam.integer(String(Math.floor(Date.now() / 1000) + 3600)),
    Neon.sc.ContractParam.integer(String(Math.floor(Date.now() / 1000) + 7200)),
    Neon.sc.ContractParam.integer("100"),
    Neon.sc.ContractParam.string("codex smoke event"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createEvent failed");
  const eventId = String(stackValue(findNotification(createLog.execution, hash, "EventCreated")?.state?.value?.[0]));

  const issueTx = await adminContract.invoke("issueTicket", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer(eventId),
    Neon.sc.ContractParam.string("A-1"),
    Neon.sc.ContractParam.string("codex smoke ticket"),
  ]);
  const issueLog = await waitForLog(issueTx);
  if (issueLog.execution.vmstate !== "HALT") throw new Error(issueLog.execution.exception || "issueTicket failed");
  const tokenId = stackValue(findNotification(issueLog.execution, hash, "TicketIssued")?.state?.value?.[0]);

  const checkInTx = await adminContract.invoke("checkIn", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.byteArray(Buffer.from(String(tokenId), "utf8").toString("base64")),
  ]);
  const checkInLog = await waitForLog(checkInTx);
  if (checkInLog.execution.vmstate !== "HALT") throw new Error(checkInLog.execution.exception || "checkIn failed");
  const details = await invokeRead(hash, "getTicketDetails", [{ type: "ByteArray", value: Buffer.from(String(tokenId), "utf8").toString("base64") }]);
  return { contractHash: hash, eventId, tokenId, createTx: asTxid(createTx), issueTx: asTxid(issueTx), checkInTx: asTxid(checkInTx), details };
}

async function runGasSponsor() {
  const hash = ADDRESSES.gassponsor;
  const adminContract = appContract(hash, admin);
  const userContract = appContract(hash, user);
  const poolAmount = "100000000";
  await transfer(gasByAdmin, admin, hash, poolAmount, "miniapp-gas-sponsor:create-pool");
  const createTx = await adminContract.invoke("createPool", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(poolAmount),
    Neon.sc.ContractParam.integer("10000000"),
    Neon.sc.ContractParam.integer("1"),
    Neon.sc.ContractParam.string("codex public gas pool"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createPool failed");
  const poolId = String(stackValue(findNotification(createLog.execution, hash, "SponsorshipCreated")?.state?.value?.[2]));

  const claimTx = await userContract.invoke("claimSponsorship", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer(poolId),
    Neon.sc.ContractParam.integer("5000000"),
  ]);
  const claimLog = await waitForLog(claimTx);
  if (claimLog.execution.vmstate !== "HALT") throw new Error(claimLog.execution.exception || "claimSponsorship failed");

  const withdrawTx = await adminContract.invoke("withdrawPool", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(poolId),
  ]);
  const withdrawLog = await waitForLog(withdrawTx);
  if (withdrawLog.execution.vmstate !== "HALT") throw new Error(withdrawLog.execution.exception || "withdrawPool failed");
  return { contractHash: hash, poolId, createTx: asTxid(createTx), claimTx: asTxid(claimTx), withdrawTx: asTxid(withdrawTx) };
}

async function runMemorialShrine() {
  const hash = ADDRESSES.memorial;
  const adminContract = appContract(hash, admin);
  const userContract = appContract(hash, user);
  const createTx = await adminContract.invoke("createMemorial", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.string(uniqueLabel("Ancestor")),
    Neon.sc.ContractParam.string(""),
    Neon.sc.ContractParam.string("friend"),
    Neon.sc.ContractParam.integer("1950"),
    Neon.sc.ContractParam.integer("2024"),
    Neon.sc.ContractParam.string("codex memorial"),
    Neon.sc.ContractParam.string("rest in peace"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createMemorial failed");
  const memorialId = String(stackValue(findNotification(createLog.execution, hash, "MemorialCreated")?.state?.value?.[0]));

  await transfer(gasByUser, user, hash, "1000000", "miniapp-memorial-shrine:incense");
  const tributeTx = await userContract.invoke("offerIncense", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer(memorialId),
  ]);
  const tributeLog = await waitForLog(tributeTx);
  if (tributeLog.execution.vmstate !== "HALT") throw new Error(tributeLog.execution.exception || "offerIncense failed");
  return { contractHash: hash, memorialId, createTx: asTxid(createTx), tributeTx: asTxid(tributeTx) };
}

async function runMilestoneEscrow() {
  const hash = ADDRESSES.milestone;
  const adminContract = appContract(hash, admin);
  const userContract = appContract(hash, user);
  await transfer(gasByAdmin, admin, hash, "20000000", "miniapp-milestone-escrow:create");
  const createTx = await adminContract.invoke("createEscrow", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.hash160(GAS_HASH),
    Neon.sc.ContractParam.integer("20000000"),
    { type: "Array", value: [{ type: "Integer", value: "10000000" }, { type: "Integer", value: "10000000" }] },
    Neon.sc.ContractParam.string(uniqueLabel("Escrow")),
    Neon.sc.ContractParam.string("codex smoke escrow"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createEscrow failed");
  const escrowId = String(stackValue(findNotification(createLog.execution, hash, "EscrowCreated")?.state?.value?.[0]));

  const approveTx = await adminContract.invoke("approveMilestone", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(escrowId),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const approveLog = await waitForLog(approveTx);
  if (approveLog.execution.vmstate !== "HALT") throw new Error(approveLog.execution.exception || "approveMilestone failed");

  const claimTx = await userContract.invoke("claimMilestone", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer(escrowId),
    Neon.sc.ContractParam.integer("1"),
  ]);
  const claimLog = await waitForLog(claimTx);
  if (claimLog.execution.vmstate !== "HALT") throw new Error(claimLog.execution.exception || "claimMilestone failed");
  return { contractHash: hash, escrowId, createTx: asTxid(createTx), approveTx: asTxid(approveTx), claimTx: asTxid(claimTx) };
}

async function runSoulbound() {
  const hash = ADDRESSES.soulbound;
  const adminContract = appContract(hash, admin);
  const createTx = await adminContract.invoke("createTemplate", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.string(uniqueLabel("Template")),
    Neon.sc.ContractParam.string("Codex Issuer"),
    Neon.sc.ContractParam.string("achievement"),
    Neon.sc.ContractParam.integer("10"),
    Neon.sc.ContractParam.string("codex soulbound template"),
  ]);
  const createLog = await waitForLog(createTx);
  if (createLog.execution.vmstate !== "HALT") throw new Error(createLog.execution.exception || "createTemplate failed");
  const templateId = String(stackValue(findNotification(createLog.execution, hash, "TemplateCreated")?.state?.value?.[0]));

  const issueTx = await adminContract.invoke("issueCertificate", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer(templateId),
    Neon.sc.ContractParam.string("Codex User"),
    Neon.sc.ContractParam.string("validation"),
    Neon.sc.ContractParam.string("smoke"),
  ]);
  const issueLog = await waitForLog(issueTx);
  if (issueLog.execution.vmstate !== "HALT") throw new Error(issueLog.execution.exception || "issueCertificate failed");
  const tokenId = stackValue(findNotification(issueLog.execution, hash, "CertificateIssued")?.state?.value?.[0]);

  const revokeTx = await adminContract.invoke("revokeCertificate", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.byteArray(Buffer.from(String(tokenId), "utf8").toString("base64")),
  ]);
  const revokeLog = await waitForLog(revokeTx);
  if (revokeLog.execution.vmstate !== "HALT") throw new Error(revokeLog.execution.exception || "revokeCertificate failed");
  return { contractHash: hash, templateId, tokenId, createTx: asTxid(createTx), issueTx: asTxid(issueTx), revokeTx: asTxid(revokeTx) };
}

async function runTrustAnchor() {
  const hash = ADDRESSES.trustanchor;
  const contract = appContract(hash, user);
  const stakeBefore = await invokeRead(hash, "stakeOf", [{ type: "Hash160", value: `0x${user.scriptHash}` }]);
  const depositTx = await transfer(neoByUser, user, hash, "1", "stake");
  const overview = await invokeRead(hash, "getUserOverview", [{ type: "Hash160", value: `0x${user.scriptHash}` }]);
  const stakeAfter = BigInt(String(overview.stake || "0"));
  if (stakeAfter <= BigInt(String(stakeBefore || "0"))) throw new Error("stake did not increase");

  const rewardDepositTx = await transfer(gasByAdmin, admin, hash, "1000000", null);
  await sleep(3000);
  const overviewAfterReward = await invokeRead(hash, "getUserOverview", [{ type: "Hash160", value: `0x${user.scriptHash}` }]);
  const reward = BigInt(String(overviewAfterReward.reward || "0"));
  let claimRewardTx = null;
  if (reward > 0n) {
    claimRewardTx = await contract.invoke("claimReward", [
      Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    ]);
    const claimLog = await waitForLog(claimRewardTx);
    if (claimLog.execution.vmstate !== "HALT") throw new Error(claimLog.execution.exception || "claimReward failed");
  }
  return { contractHash: hash, depositTx, rewardDepositTx, reward: reward.toString(), claimRewardTx: claimRewardTx ? asTxid(claimRewardTx) : null };
}

async function runAll() {
  await initNeon();
  const results = {};
  const tasks = [
    ["eventticket", runEventTicket],
    ["gassponsor", runGasSponsor],
    ["memorial", runMemorialShrine],
    ["milestone", runMilestoneEscrow],
    ["soulbound", runSoulbound],
    ["trustanchor", runTrustAnchor],
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

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
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
