#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  sleep,
  asTxid,
  stackValue,
  findNotification,
  createWaitForLog,
} = require("./lib/live_neo");
let Neon;

const RPC_URL = process.env.NEO_RPC_URL || "https://testnet1.neo.coz.io:443";
const NETWORK_MAGIC = Number(process.env.NEO_NETWORK_MAGIC || "894710606");
const ADMIN_WIF = process.env.TEST_SMOKE_ADMIN_WIF || process.env.MINIAPP_UPDATE_WIF || process.env.FLAGSHIP_LIVE_WIF || "";
const USER_WIF = process.env.TEST_SMOKE_USER_WIF || process.env.NEO_TESTNET_WIF || "";
const HASH = "0x4c61e5575ae9e151027f6724d07fac127d4cc25f";
const OUTPUT_PATH = path.join(path.resolve(__dirname, "../.."), "docs", "reports", "2026-03-19-council-governance-live-smoke.json");

if (!ADMIN_WIF || !USER_WIF) {
  console.error("TEST_SMOKE_ADMIN_WIF and TEST_SMOKE_USER_WIF are required");
  process.exit(1);
}

let admin;
let user;
let rpc;
let adminContract;
let userContract;
const waitForLog = createWaitForLog({
  getApplicationLog: (txid) => rpc.getApplicationLog(txid),
  label: "live_validate_council",
});

async function initNeon() {
  if (Neon) return;
  Neon = (await import("./lib/neon-compat.mjs")).default;
  admin = new Neon.wallet.Account(ADMIN_WIF);
  user = new Neon.wallet.Account(USER_WIF);
  rpc = new Neon.rpc.RPCClient(RPC_URL);
  adminContract = new Neon.experimental.SmartContract(HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: admin });
  userContract = new Neon.experimental.SmartContract(HASH, { rpcAddress: RPC_URL, networkMagic: NETWORK_MAGIC, account: user });
}

async function invokeRead(operation, args = []) {
  const res = await rpc.invokeFunction(HASH, operation, args);
  if (String(res?.state || "").toUpperCase() === "FAULT") {
    throw new Error(`${operation} faulted: ${res.exception || "unknown error"}`);
  }
  return res.stack?.[0] ? stackValue(res.stack[0]) : null;
}

async function main() {
  await initNeon();
  const adminCandidate = await invokeRead("isCandidate", [Neon.sc.ContractParam.hash160(admin.address)]);
  const userCandidate = await invokeRead("isCandidate", [Neon.sc.ContractParam.hash160(user.address)]);
  if (!adminCandidate || !userCandidate) {
    throw new Error("current test accounts are not live committee candidates");
  }

  const durationMs = "90000";
  const proposalTx = await adminContract.invoke("createProposal", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer("0"),
    Neon.sc.ContractParam.string(`Codex Council ${Date.now()}`),
    Neon.sc.ContractParam.string("Codex live smoke governance proposal"),
    Neon.sc.ContractParam.byteArray(Buffer.alloc(0).toString("base64")),
    Neon.sc.ContractParam.integer(durationMs),
  ]);
  const proposalLog = await waitForLog(proposalTx);
  if (proposalLog.execution.vmstate !== "HALT") throw new Error(proposalLog.execution.exception || "createProposal failed");
  const proposalId = String(
    stackValue(findNotification(proposalLog.execution, HASH, "ProposalCreated")?.state?.value?.[0])
  );

  const voteAdminTx = await adminContract.invoke("vote", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(proposalId),
    Neon.sc.ContractParam.boolean(true),
  ]);
  const voteAdminLog = await waitForLog(voteAdminTx);
  if (voteAdminLog.execution.vmstate !== "HALT") throw new Error(voteAdminLog.execution.exception || "admin vote failed");

  let voteUserTx = "";
  if (admin.address !== user.address) {
    voteUserTx = await userContract.invoke("vote", [
      Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
      Neon.sc.ContractParam.integer(proposalId),
      Neon.sc.ContractParam.boolean(true),
    ]);
    const voteUserLog = await waitForLog(voteUserTx);
    if (voteUserLog.execution.vmstate !== "HALT") throw new Error(voteUserLog.execution.exception || "user vote failed");
  }

  const delegationTx = await userContract.invoke("setDelegation", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
  ]);
  const delegationLog = await waitForLog(delegationTx);
  if (delegationLog.execution.vmstate !== "HALT") throw new Error(delegationLog.execution.exception || "setDelegation failed");

  const revokeDelegationTx = await userContract.invoke("revokeDelegation", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
  ]);
  const revokeDelegationLog = await waitForLog(revokeDelegationTx);
  if (revokeDelegationLog.execution.vmstate !== "HALT") throw new Error(revokeDelegationLog.execution.exception || "revokeDelegation failed");

  const revokeProposalTx = await adminContract.invoke("revokeProposal", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(proposalId),
  ]);
  const revokeProposalLog = await waitForLog(revokeProposalTx);
  if (revokeProposalLog.execution.vmstate !== "HALT") throw new Error(revokeProposalLog.execution.exception || "revokeProposal failed");

  const expiringProposalTx = await adminContract.invoke("createProposal", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer("0"),
    Neon.sc.ContractParam.string(`Codex Expiring ${Date.now()}`),
    Neon.sc.ContractParam.string("Codex quorum smoke"),
    Neon.sc.ContractParam.byteArray(Buffer.alloc(0).toString("base64")),
    Neon.sc.ContractParam.integer(durationMs),
  ]);
  const expiringLog = await waitForLog(expiringProposalTx);
  if (expiringLog.execution.vmstate !== "HALT") throw new Error(expiringLog.execution.exception || "second createProposal failed");
  const expiringProposalId = String(
    stackValue(findNotification(expiringLog.execution, HASH, "ProposalCreated")?.state?.value?.[0])
  );

  await sleep(95000);

  const finalizeTx = await adminContract.invoke("finalizeProposal", [
    Neon.sc.ContractParam.integer(expiringProposalId),
  ]);
  const finalizeLog = await waitForLog(finalizeTx);
  if (finalizeLog.execution.vmstate !== "HALT") throw new Error(finalizeLog.execution.exception || "finalizeProposal failed");

  const revokedDetails = await invokeRead("getProposalDetails", [{ type: "Integer", value: proposalId }]);
  const finalizedDetails = await invokeRead("getProposalDetails", [{ type: "Integer", value: expiringProposalId }]);

  const report = {
    generatedAt: new Date().toISOString(),
    rpcUrl: RPC_URL,
    adminAddress: admin.address,
    userAddress: user.address,
    proposalId,
    expiringProposalId,
    proposalTx: asTxid(proposalTx),
    voteAdminTx: asTxid(voteAdminTx),
    voteUserTx: asTxid(voteUserTx),
    delegationTx: asTxid(delegationTx),
    revokeDelegationTx: asTxid(revokeDelegationTx),
    revokeProposalTx: asTxid(revokeProposalTx),
    expiringProposalTx: asTxid(expiringProposalTx),
    finalizeTx: asTxid(finalizeTx),
    revokedDetails,
    finalizedDetails,
    limitations: [
      "passed+execute path requires quorum > two available candidate signers",
      "submitSignature/executeProposal for policy proposals not exercised because quorum cannot be met with current available keys",
    ],
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2) + "\n");
  console.log(`Report: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
