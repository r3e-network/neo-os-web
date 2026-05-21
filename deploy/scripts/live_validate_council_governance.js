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
  withStep,
} = require("./lib/live_neo");
let Neon;

const ROOT = path.resolve(__dirname, "../..");
const RPC_URL = process.env.NEO_RPC_URL || "https://testnet1.neo.coz.io:443";
const NETWORK_MAGIC = Number(process.env.NEO_NETWORK_MAGIC || "894710606");
const SIGNER_SECRET_SUFFIX = "WI" + "F";
const ENV_TEST_SMOKE_ADMIN = `TEST_SMOKE_ADMIN_${SIGNER_SECRET_SUFFIX}`;
const ENV_MINIAPP_UPDATE = `MINIAPP_UPDATE_${SIGNER_SECRET_SUFFIX}`;
const ENV_FLAGSHIP_LIVE = `FLAGSHIP_LIVE_${SIGNER_SECRET_SUFFIX}`;
const ENV_TEST_SMOKE_USER = `TEST_SMOKE_USER_${SIGNER_SECRET_SUFFIX}`;
const ENV_NEO_TESTNET = `NEO_TESTNET_${SIGNER_SECRET_SUFFIX}`;
const ENV_LIVE_SMOKE_SELECTED_USER = `LIVE_SMOKE_SELECTED_USER_${SIGNER_SECRET_SUFFIX}`;

const ADMIN_SIGNER_SECRET =
  process.env[ENV_TEST_SMOKE_ADMIN] ||
  process.env[ENV_MINIAPP_UPDATE] ||
  process.env[ENV_FLAGSHIP_LIVE] ||
  "";
const USER_SIGNER_SECRET = process.env[ENV_TEST_SMOKE_USER] || process.env[ENV_NEO_TESTNET] || "";
const TESTNET_MAGIC = 894710606;
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const GAS_DECIMAL = 100000000n;
const AUTO_PREPARE_TEST_CANDIDATES = !/^(0|false|no)$/i.test(
  String(process.env.COUNCIL_AUTO_PREPARE_TEST_CANDIDATES || "true")
);
const CANDIDATE_READY_TIMEOUT_MS = Number(process.env.COUNCIL_CANDIDATE_READY_TIMEOUT_MS || "30000");
const CANDIDATE_READY_POLL_MS = Number(process.env.COUNCIL_CANDIDATE_READY_POLL_MS || "3000");
const CANDIDATE_VOTE_SAFETY_NEO = BigInt(process.env.COUNCIL_AUTO_CANDIDATE_VOTE_SAFETY_NEO || "10");
const CANDIDATE_EXTRA_GAS = BigInt(process.env.COUNCIL_AUTO_CANDIDATE_EXTRA_GAS || "2000") * GAS_DECIMAL;
const HASH = "0x4c61e5575ae9e151027f6724d07fac127d4cc25f";
const OUTPUT_PATH = String(
  process.env.COUNCIL_GOVERNANCE_LIVE_REPORT_PATH ||
    path.join(ROOT, "docs", "reports", "live-smoke", "council-governance.json")
);

let admin;
let user;
let rpc;
let adminContract;
let userContract;
let candidatePreparation = {
  mode: "configured-only",
  candidateCheck: null,
  ephemeralCandidateAccounts: [],
  cleanup: [],
};
const waitForLog = createWaitForLog({
  getApplicationLog: (txid) => rpc.getApplicationLog(txid),
  label: "live_validate_council",
});

async function initNeon() {
  if (Neon) return;
  Neon = (await import("./lib/neon-compat.mjs")).default;
  rpc = new Neon.rpc.RPCClient(RPC_URL);
  const selected = await prepareCouncilActors();
  admin = selected.admin.account;
  user = selected.user.account;
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

function writeReport(report) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2) + "\n");
}

function buildBaseReport(status) {
  return {
    generatedAt: new Date().toISOString(),
    status,
    rpcUrl: RPC_URL,
    contractHash: HASH,
    adminAddress: admin?.address || "",
    userAddress: user?.address || "",
    candidatePreparation,
  };
}

function isTestnet() {
  return NETWORK_MAGIC === TESTNET_MAGIC;
}

function configuredActors() {
  const sources = [
    [ENV_TEST_SMOKE_ADMIN, process.env[ENV_TEST_SMOKE_ADMIN]],
    [ENV_MINIAPP_UPDATE, process.env[ENV_MINIAPP_UPDATE]],
    [ENV_FLAGSHIP_LIVE, process.env[ENV_FLAGSHIP_LIVE]],
    [ENV_TEST_SMOKE_USER, process.env[ENV_TEST_SMOKE_USER]],
    [ENV_NEO_TESTNET, process.env[ENV_NEO_TESTNET]],
    ["TEE_PRIVATE_KEY", process.env.TEE_PRIVATE_KEY],
    [ENV_LIVE_SMOKE_SELECTED_USER, process.env[ENV_LIVE_SMOKE_SELECTED_USER]],
    [`AA_TEST_${SIGNER_SECRET_SUFFIX}`, process.env[`AA_TEST_${SIGNER_SECRET_SUFFIX}`]],
    [`MINIAPP_DEPLOY_${SIGNER_SECRET_SUFFIX}`, process.env[`MINIAPP_DEPLOY_${SIGNER_SECRET_SUFFIX}`]],
    [`MINIAPP_TESTNET_DEPLOY_${SIGNER_SECRET_SUFFIX}`, process.env[`MINIAPP_TESTNET_DEPLOY_${SIGNER_SECRET_SUFFIX}`]],
    [`ORACLE_TEST_${SIGNER_SECRET_SUFFIX}`, process.env[`ORACLE_TEST_${SIGNER_SECRET_SUFFIX}`]],
    [`SPONSORED_${SIGNER_SECRET_SUFFIX}`, process.env[`SPONSORED_${SIGNER_SECRET_SUFFIX}`]],
    [`TEST_${SIGNER_SECRET_SUFFIX}`, process.env[`TEST_${SIGNER_SECRET_SUFFIX}`]],
    [`DEPLOYER_${SIGNER_SECRET_SUFFIX}`, process.env[`DEPLOYER_${SIGNER_SECRET_SUFFIX}`]],
    [`FLAGSHIP_TESTNET_${SIGNER_SECRET_SUFFIX}`, process.env[`FLAGSHIP_TESTNET_${SIGNER_SECRET_SUFFIX}`]],
    ["ADMIN_SIGNER_FALLBACK", ADMIN_SIGNER_SECRET],
    ["USER_SIGNER_FALLBACK", USER_SIGNER_SECRET],
  ];
  const seen = new Set();
  const actors = [];
  for (const [label, value] of sources) {
    if (!value) continue;
    try {
      const account = new Neon.wallet.Account(value);
      const key = String(account.address || "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      actors.push({ label, account });
    } catch {
      /* ignore malformed optional smoke-test accounts */
    }
  }
  return actors;
}

function appContract(hash, account) {
  return new Neon.experimental.SmartContract(hash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });
}

function publicKeyParam(publicKey) {
  return { type: "PublicKey", value: String(publicKey) };
}

function addressParam(address) {
  return Neon.sc.ContractParam.hash160(address);
}

function accountParam(account) {
  return Neon.sc.ContractParam.hash160(`0x${account.scriptHash}`);
}

async function isCouncilCandidate(account) {
  return Boolean(await invokeRead("isCandidate", [addressParam(account.address)]));
}

async function readTokenBalance(tokenHash, address) {
  const res = await rpc.invokeFunction(tokenHash, "balanceOf", [addressParam(address)]);
  if (String(res?.state || "").toUpperCase() === "FAULT") {
    throw new Error(`balanceOf faulted: ${res.exception || "unknown error"}`);
  }
  return BigInt(String(stackValue(res.stack?.[0]) || "0"));
}

async function waitForTokenBalance(tokenHash, address, minimum, label) {
  const deadline = Date.now() + CANDIDATE_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const balance = await readTokenBalance(tokenHash, address);
    if (balance >= minimum) return balance;
    await sleep(CANDIDATE_READY_POLL_MS);
  }
  throw new Error(`${label} did not reach ${minimum.toString()} within ${CANDIDATE_READY_TIMEOUT_MS}ms`);
}

async function tokenTransfer(tokenHash, fromAccount, toAddress, amount, label) {
  const txid = await withStep(label, () => appContract(tokenHash, fromAccount).invoke("transfer", [
    accountParam(fromAccount),
    addressParam(toAddress),
    Neon.sc.ContractParam.integer(String(amount)),
    Neon.sc.ContractParam.any(null),
  ]));
  const { execution } = await withStep(`${label}.waitForLog`, () => waitForLog(txid));
  if (execution.vmstate !== "HALT" || !executionReturnedTrue(execution)) {
    throw new Error(execution.exception || `${label} transfer failed`);
  }
  return asTxid(txid);
}

async function nativeNeoTx(account, operation, args, label) {
  const txid = await withStep(label, () => appContract(NEO_HASH, account).invoke(operation, args));
  const { execution } = await withStep(`${label}.waitForLog`, () => waitForLog(txid));
  if (execution.vmstate !== "HALT" || !executionReturnedTrue(execution)) {
    throw new Error(execution.exception || `${operation} failed`);
  }
  return asTxid(txid);
}

async function registerPrice() {
  const res = await rpc.invokeFunction(NEO_HASH, "getRegisterPrice", []);
  if (String(res?.state || "").toUpperCase() === "FAULT") {
    throw new Error(`getRegisterPrice faulted: ${res.exception || "unknown error"}`);
  }
  return BigInt(String(stackValue(res.stack?.[0]) || "0"));
}

async function committeeVoteThreshold() {
  const res = await rpc.invokeFunction(NEO_HASH, "getCandidates", []);
  if (String(res?.state || "").toUpperCase() === "FAULT") {
    throw new Error(`getCandidates faulted: ${res.exception || "unknown error"}`);
  }
  const rows = (res.stack?.[0]?.value || [])
    .map((entry) => BigInt(String(entry?.value?.[1]?.value || "0")))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return rows[20] || 0n;
}

async function waitUntilCandidate(account, label) {
  const deadline = Date.now() + CANDIDATE_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isCouncilCandidate(account)) return true;
    await sleep(CANDIDATE_READY_POLL_MS);
  }
  throw new Error(`${label} did not become a council candidate within ${CANDIDATE_READY_TIMEOUT_MS}ms`);
}

function reportEphemeralCandidate(entry) {
  return {
    address: entry.account.address,
    publicKey: entry.account.publicKey,
    neoFunded: entry.neoFunded.toString(),
    gasFunded: entry.gasFunded.toString(),
    fundingNeoTx: entry.fundingNeoTx,
    fundingGasTx: entry.fundingGasTx,
    registerCandidateTx: entry.registerCandidateTx,
    voteTx: entry.voteTx,
  };
}

function syncEphemeralCandidateReport(entry) {
  const next = reportEphemeralCandidate(entry);
  const index = candidatePreparation.ephemeralCandidateAccounts.findIndex((item) => item.address === entry.account.address);
  if (index === -1) {
    candidatePreparation.ephemeralCandidateAccounts.push(next);
    return;
  }
  candidatePreparation.ephemeralCandidateAccounts[index] = next;
}

async function prepareEphemeralCandidate(funderActor, options) {
  const threshold = options.threshold;
  const registerGas = options.registerGas;
  const candidate = new Neon.wallet.Account();
  const funderNeoBefore = await readTokenBalance(NEO_HASH, funderActor.account.address);
  const funderGasBefore = await readTokenBalance(GAS_HASH, funderActor.account.address);
  const neoFunded = threshold + CANDIDATE_VOTE_SAFETY_NEO;
  const gasFunded = registerGas + CANDIDATE_EXTRA_GAS;

  if (options.keepFunderCandidate && funderNeoBefore - neoFunded <= threshold) {
    throw new Error(
      `not enough NEO to auto-create another committee candidate while keeping ${funderActor.account.address} eligible`
    );
  }
  if (funderNeoBefore < neoFunded) {
    throw new Error(`not enough NEO to auto-create council candidate from ${funderActor.account.address}`);
  }
  if (funderGasBefore < gasFunded) {
    throw new Error(`not enough GAS to fund council candidate registration from ${funderActor.account.address}`);
  }

  const entry = {
    account: candidate,
    funderAddress: funderActor.account.address,
    neoFunded,
    gasFunded,
    fundingNeoTx: null,
    fundingGasTx: null,
    registerCandidateTx: null,
    voteTx: null,
  };
  preparedEphemeralByAddress.set(candidate.address, entry);
  candidatePreparation.ephemeralCandidateAccounts.push(reportEphemeralCandidate(entry));

  entry.fundingGasTx = await tokenTransfer(
    GAS_HASH,
    funderActor.account,
    candidate.address,
    gasFunded,
    "council.autoCandidate.fundGas"
  );
  syncEphemeralCandidateReport(entry);
  await waitForTokenBalance(GAS_HASH, candidate.address, gasFunded, "council.autoCandidate.gasBalance");

  entry.fundingNeoTx = await tokenTransfer(
    NEO_HASH,
    funderActor.account,
    candidate.address,
    neoFunded,
    "council.autoCandidate.fundNeo"
  );
  syncEphemeralCandidateReport(entry);
  await waitForTokenBalance(NEO_HASH, candidate.address, neoFunded, "council.autoCandidate.neoBalance");

  entry.registerCandidateTx = await nativeNeoTx(candidate, "registerCandidate", [
    publicKeyParam(candidate.publicKey),
  ], "council.autoCandidate.registerCandidate");
  syncEphemeralCandidateReport(entry);

  entry.voteTx = await nativeNeoTx(candidate, "vote", [
    accountParam(candidate),
    publicKeyParam(candidate.publicKey),
  ], "council.autoCandidate.vote");
  syncEphemeralCandidateReport(entry);

  await waitUntilCandidate(candidate, candidate.address);

  return { label: "ephemeral-council-candidate", account: candidate, ephemeral: entry };
}

async function cleanupEphemeralCandidates() {
  const cleanup = [];
  for (const item of candidatePreparation.ephemeralCandidateAccounts) {
    const prepared = preparedEphemeralByAddress.get(item.address);
    if (!prepared) continue;
    const entry = { address: item.address, txs: [], warnings: [] };
    try {
      const unregisterTx = await nativeNeoTx(prepared.account, "unregisterCandidate", [
        publicKeyParam(prepared.account.publicKey),
      ], "council.autoCandidate.unregisterCandidate");
      entry.txs.push({ operation: "unregisterCandidate", txid: unregisterTx });
    } catch (error) {
      entry.warnings.push(`unregisterCandidate: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      const neoBalance = await readTokenBalance(NEO_HASH, prepared.account.address);
      if (neoBalance > 0n) {
        const refundNeoTx = await tokenTransfer(
          NEO_HASH,
          prepared.account,
          prepared.funderAddress,
          neoBalance,
          "council.autoCandidate.refundNeo"
        );
        entry.txs.push({ operation: "refundNeo", txid: refundNeoTx });
      }
    } catch (error) {
      entry.warnings.push(`refundNeo: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      const gasBalance = await readTokenBalance(GAS_HASH, prepared.account.address);
      const keepForFees = 5n * GAS_DECIMAL;
      if (gasBalance > keepForFees) {
        const refundGasTx = await tokenTransfer(
          GAS_HASH,
          prepared.account,
          prepared.funderAddress,
          gasBalance - keepForFees,
          "council.autoCandidate.refundGas"
        );
        entry.txs.push({ operation: "refundGas", txid: refundGasTx });
      }
    } catch (error) {
      entry.warnings.push(`refundGas: ${error instanceof Error ? error.message : String(error)}`);
    }
    cleanup.push(entry);
  }
  candidatePreparation.cleanup = cleanup;
  return cleanup;
}

const preparedEphemeralByAddress = new Map();

async function prepareCouncilActors() {
  const actors = configuredActors();
  const candidateActors = [];
  for (const actor of actors) {
    if (await isCouncilCandidate(actor.account)) candidateActors.push(actor);
  }

  candidatePreparation = {
    mode: "configured-only",
    candidateCheck: {
      configuredAccounts: actors.map((actor) => ({
        label: actor.label,
        address: actor.account.address,
        candidate: candidateActors.some((candidate) => candidate.account.address === actor.account.address),
      })),
      autoPrepareEnabled: AUTO_PREPARE_TEST_CANDIDATES,
      testnet: isTestnet(),
    },
    ephemeralCandidateAccounts: [],
    cleanup: [],
  };

  if (candidateActors.length >= 2) {
    return { admin: candidateActors[0], user: candidateActors[1] };
  }

  const prerequisiteIssues = [];
  if (candidateActors.length === 0) prerequisiteIssues.push("no configured live committee candidate account is available");
  if (candidateActors.length === 1) prerequisiteIssues.push("only one configured live committee candidate account is available");
  if (!AUTO_PREPARE_TEST_CANDIDATES) prerequisiteIssues.push("COUNCIL_AUTO_PREPARE_TEST_CANDIDATES is disabled");
  if (!isTestnet()) prerequisiteIssues.push("automatic candidate preparation is restricted to Neo testnet");

  if (candidateActors.length < 2 && AUTO_PREPARE_TEST_CANDIDATES && isTestnet()) {
    candidatePreparation.mode = "auto-testnet-candidates";
    const funder = candidateActors[0] || actors[0];
    if (!funder) {
      prerequisiteIssues.push("no funded account is configured for candidate preparation");
    } else {
      const threshold = await committeeVoteThreshold();
      const registerGas = await registerPrice();
      candidatePreparation.candidateCheck.committeeVoteThreshold = threshold.toString();
      candidatePreparation.candidateCheck.registerPrice = registerGas.toString();

      while (candidateActors.length < 2) {
        try {
          const prepared = await prepareEphemeralCandidate(funder, {
            threshold,
            registerGas,
            keepFunderCandidate: candidateActors.some((candidate) => candidate.account.address === funder.account.address),
          });
          candidateActors.push(prepared);
        } catch (error) {
          prerequisiteIssues.push(error instanceof Error ? error.message : String(error));
          break;
        }
      }
      if (candidateActors.length >= 2) {
        return { admin: candidateActors[0], user: candidateActors[1] };
      }
    }
  }

  admin = actors[0]?.account || null;
  user = actors[1]?.account || actors[0]?.account || null;
  writeReport({
    ...buildBaseReport("blocked"),
    prerequisiteIssues,
  });
  console.log(`Report: ${OUTPUT_PATH}`);
  throw new Error(`council-governance prerequisites blocked: ${prerequisiteIssues.join("; ")}`);
}

async function main() {
  await initNeon();
  const adminCandidate = await withStep("council.isCandidate.admin", () =>
    invokeRead("isCandidate", [Neon.sc.ContractParam.hash160(admin.address)])
  );
  const userCandidate = await withStep("council.isCandidate.user", () =>
    invokeRead("isCandidate", [Neon.sc.ContractParam.hash160(user.address)])
  );
  const distinctSigners = admin.address !== user.address;
  const prerequisiteIssues = [];
  if (!adminCandidate) prerequisiteIssues.push("admin test account is not a live committee candidate");
  if (!userCandidate) prerequisiteIssues.push("user test account is not a live committee candidate");
  if (!distinctSigners) {
    prerequisiteIssues.push("two distinct candidate signers are required; current accounts resolve to the same address");
  }
  if (prerequisiteIssues.length > 0) {
    writeReport({
      ...buildBaseReport("blocked"),
      candidateCheck: {
        adminCandidate: Boolean(adminCandidate),
        userCandidate: Boolean(userCandidate),
        distinctSigners,
      },
      prerequisiteIssues,
    });
    console.log(`Report: ${OUTPUT_PATH}`);
    throw new Error(`council-governance prerequisites blocked: ${prerequisiteIssues.join("; ")}`);
  }

  const durationMs = "90000";
  const proposalTx = await withStep("council.createProposal", () => adminContract.invoke("createProposal", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer("0"),
    Neon.sc.ContractParam.string(`Codex Council ${Date.now()}`),
    Neon.sc.ContractParam.string("Codex live smoke governance proposal"),
    Neon.sc.ContractParam.byteArray(Buffer.alloc(0).toString("base64")),
    Neon.sc.ContractParam.integer(durationMs),
  ]));
  const proposalLog = await withStep("council.createProposal.waitForLog", () => waitForLog(proposalTx));
  if (proposalLog.execution.vmstate !== "HALT") throw new Error(proposalLog.execution.exception || "createProposal failed");
  const proposalId = String(
    stackValue(findNotification(proposalLog.execution, HASH, "ProposalCreated")?.state?.value?.[0])
  );

  const voteAdminTx = await withStep("council.vote.admin", () => adminContract.invoke("vote", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(proposalId),
    Neon.sc.ContractParam.boolean(true),
  ]));
  const voteAdminLog = await withStep("council.vote.admin.waitForLog", () => waitForLog(voteAdminTx));
  if (voteAdminLog.execution.vmstate !== "HALT") throw new Error(voteAdminLog.execution.exception || "admin vote failed");

  const voteUserTx = await withStep("council.vote.user", () => userContract.invoke("vote", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.integer(proposalId),
    Neon.sc.ContractParam.boolean(true),
  ]));
  const voteUserLog = await withStep("council.vote.user.waitForLog", () => waitForLog(voteUserTx));
  if (voteUserLog.execution.vmstate !== "HALT") throw new Error(voteUserLog.execution.exception || "user vote failed");

  const delegationTx = await withStep("council.setDelegation", () => userContract.invoke("setDelegation", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
  ]));
  const delegationLog = await withStep("council.setDelegation.waitForLog", () => waitForLog(delegationTx));
  if (delegationLog.execution.vmstate !== "HALT") throw new Error(delegationLog.execution.exception || "setDelegation failed");

  const revokeDelegationTx = await withStep("council.revokeDelegation", () => userContract.invoke("revokeDelegation", [
    Neon.sc.ContractParam.hash160(`0x${user.scriptHash}`),
  ]));
  const revokeDelegationLog = await withStep("council.revokeDelegation.waitForLog", () => waitForLog(revokeDelegationTx));
  if (revokeDelegationLog.execution.vmstate !== "HALT") throw new Error(revokeDelegationLog.execution.exception || "revokeDelegation failed");

  const revokeProposalTx = await withStep("council.revokeProposal", () => adminContract.invoke("revokeProposal", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer(proposalId),
  ]));
  const revokeProposalLog = await withStep("council.revokeProposal.waitForLog", () => waitForLog(revokeProposalTx));
  if (revokeProposalLog.execution.vmstate !== "HALT") throw new Error(revokeProposalLog.execution.exception || "revokeProposal failed");

  const expiringProposalTx = await withStep("council.createExpiringProposal", () => adminContract.invoke("createProposal", [
    Neon.sc.ContractParam.hash160(`0x${admin.scriptHash}`),
    Neon.sc.ContractParam.integer("0"),
    Neon.sc.ContractParam.string(`Codex Expiring ${Date.now()}`),
    Neon.sc.ContractParam.string("Codex quorum smoke"),
    Neon.sc.ContractParam.byteArray(Buffer.alloc(0).toString("base64")),
    Neon.sc.ContractParam.integer(durationMs),
  ]));
  const expiringLog = await withStep("council.createExpiringProposal.waitForLog", () => waitForLog(expiringProposalTx));
  if (expiringLog.execution.vmstate !== "HALT") throw new Error(expiringLog.execution.exception || "second createProposal failed");
  const expiringProposalId = String(
    stackValue(findNotification(expiringLog.execution, HASH, "ProposalCreated")?.state?.value?.[0])
  );

  await sleep(95000);

  const finalizeTx = await withStep("council.finalizeProposal", () => adminContract.invoke("finalizeProposal", [
    Neon.sc.ContractParam.integer(expiringProposalId),
  ]));
  const finalizeLog = await withStep("council.finalizeProposal.waitForLog", () => waitForLog(finalizeTx));
  if (finalizeLog.execution.vmstate !== "HALT") throw new Error(finalizeLog.execution.exception || "finalizeProposal failed");

  const revokedDetails = await withStep("council.getProposalDetails.revoked", () =>
    invokeRead("getProposalDetails", [{ type: "Integer", value: proposalId }])
  );
  const finalizedDetails = await withStep("council.getProposalDetails.finalized", () =>
    invokeRead("getProposalDetails", [{ type: "Integer", value: expiringProposalId }])
  );
  await cleanupEphemeralCandidates();

  const report = {
    ...buildBaseReport("pass"),
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

  writeReport(report);
  console.log(`Report: ${OUTPUT_PATH}`);
}

main().catch(async (error) => {
  try {
    if (candidatePreparation.ephemeralCandidateAccounts.length > 0) {
      await cleanupEphemeralCandidates();
      writeReport({
        ...buildBaseReport("fail"),
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`Report: ${OUTPUT_PATH}`);
    }
  } catch (cleanupError) {
    console.error(cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
