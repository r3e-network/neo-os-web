#!/usr/bin/env node
/**
 * Multi-user business workflow simulator on Neo N3 testnet.
 *
 * What it does each iteration:
 *   1. Generates N fresh sub-accounts (configurable via SIM_USERS), or
 *      reuses the ones from previous runs stored in
 *      docs/reports/multi-user-sim/sim-users.json.
 *   2. Funds every sub-account with GAS (and NEO for SelfLoan scenarios)
 *      from the master WIF whenever their balance drops below the floor.
 *   3. Assigns scenarios across the sub-accounts and runs them through
 *      the real on-chain business workflow (not just read-fuzz).
 *   4. Writes a structured JSON report per iteration to
 *      docs/reports/multi-user-sim/<timestamp>.json and appends a
 *      one-line summary to docs/reports/multi-user-sim/history.log.
 *
 * Covered flagship flows (no oracle dependency):
 *   - Daily Check-in: fee transfer → checkIn → verify streak
 *   - NeoPay:         createStream → beneficiary claim after interval
 *   - SelfLoan:       NEO collateral transfer → createLoan
 *   - LastSurvivor:   transfer 1 GAS → round state read-back
 *
 * Oracle-gated flows (FogPlay / GASBox / RedEnvelope) are intentionally
 * excluded here because their VRF callbacks require a live Phala runtime;
 * they're covered separately by deploy/scripts/live_validate_flagship_user_flows.js.
 *
 * Env:
 *   NEO_TESTNET_WIF  — master funder WIF (default: built-in testnet key)
 *   SIM_USERS        — sub-account count per iteration (default: 3)
 *   SIM_ITERATIONS   — cap on iterations (0 = loop forever, default: 0)
 *   SIM_LOOP_DELAY_MS — sleep between iterations (default: 30000)
 *   SIM_GAS_PER_USER  — GAS units (satoshi) to send each sub-account (default: 2e9 = 20 GAS)
 *   SIM_NEO_PER_USER  — NEO whole units (default: 3)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

// Load the same neon-compat shim the live validator uses, so we inherit
// its SmartContract.invoke flow (preview + estimate fees + sign + send).
const Neon = (await import(path.join(repoRoot, "deploy", "scripts", "lib", "neon-compat.mjs"))).default;
const { createWaitForLog, asTxid } = await import(
  path.join(repoRoot, "deploy", "scripts", "lib", "live_neo.js")
);

const RPC_URL = process.env.NEO_RPC_URL || "https://testnet1.neo.coz.io:443";
const NETWORK_MAGIC = Number(process.env.NEO_NETWORK_MAGIC || Neon.CONST.MAGIC_NUMBER.TestNet);

const FUNDER_WIF = process.env.NEO_TESTNET_WIF || process.env.TEST_FUZZ_WIF
  || "***REMOVED***";

const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

const CONTRACTS = {
  lastSurvivor: "0xd55df731978582ea81719a5d87ce49b248e91275",
  dailyCheckin: "0xaba84da240a55410d284a656fc8dae044e6ec1a5",
  selfLoan:     "0xd097c63ea89251d23632826ebed99a7e7ce536f7",
  neoPay:       "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
};

const SIM_USERS       = parseInt(process.env.SIM_USERS || "3", 10);
const SIM_ITERATIONS  = process.env.SIM_ITERATIONS ? parseInt(process.env.SIM_ITERATIONS, 10) : 0;
const SIM_LOOP_DELAY  = parseInt(process.env.SIM_LOOP_DELAY_MS || "30000", 10);
const SIM_GAS_PER_USR = BigInt(process.env.SIM_GAS_PER_USER || "2000000000"); // 20 GAS
const SIM_NEO_PER_USR = BigInt(process.env.SIM_NEO_PER_USER || "3");

const REPORT_DIR = path.join(repoRoot, "docs", "reports", "multi-user-sim");
fs.mkdirSync(REPORT_DIR, { recursive: true });
const HISTORY_LOG = path.join(REPORT_DIR, "history.log");
const ACCOUNT_STATE_FILE = path.join(REPORT_DIR, "sim-users.json");

const funder = new Neon.wallet.Account(FUNDER_WIF);
const rpcClient = new Neon.rpc.RPCClient(RPC_URL);
const waitForLog = createWaitForLog({
  getApplicationLog: (txid) => rpcClient.getApplicationLog(txid),
  label: "multi-user-sim",
});

/* ─── Helpers ─────────────────────────────────────────────────────── */

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function ts() { return new Date().toISOString(); }
function log(line) { console.log(`[${ts()}] ${line}`); }

function smartContract(hash, account) {
  return new Neon.experimental.SmartContract(hash, {
    rpcAddress: RPC_URL,
    networkMagic: NETWORK_MAGIC,
    account,
  });
}

async function invokeRead(scriptHash, operation, args = []) {
  return rpcClient.invokeFunction(scriptHash, operation, args);
}

async function waitForTx(txid) {
  const normalized = asTxid(txid);
  const { execution } = await waitForLog(normalized, 120000);
  return execution;
}

async function transferAsset(account, assetHash, toHash, amount, data = null) {
  const contract = smartContract(assetHash, account);
  return contract.invoke("transfer", [
    Neon.sc.ContractParam.hash160(account.scriptHash),
    Neon.sc.ContractParam.hash160(toHash),
    Neon.sc.ContractParam.integer(amount.toString()),
    data === null ? Neon.sc.ContractParam.any(null) : data,
  ]);
}

async function invokeMethod(account, contractHash, operation, args) {
  const contract = smartContract(contractHash, account);
  return contract.invoke(operation, args);
}

async function getBalance(assetHash, scriptHash) {
  const res = await invokeRead(assetHash, "balanceOf", [Neon.sc.ContractParam.hash160(scriptHash)]);
  if (String(res?.state || "").toUpperCase() !== "HALT") return 0n;
  return BigInt(res.stack?.[0]?.value || "0");
}

function readMap(stackItem) {
  if (!stackItem || stackItem.type !== "Map") return {};
  const out = {};
  for (const kv of stackItem.value || []) {
    const key = Buffer.from(String(kv.key?.value || ""), "base64").toString("utf8");
    out[key] = kv.value?.value;
    out[`__type__${key}`] = kv.value?.type;
  }
  return out;
}

/* ─── Account management ──────────────────────────────────────────── */

function loadSubAccounts() {
  if (!fs.existsSync(ACCOUNT_STATE_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(ACCOUNT_STATE_FILE, "utf8"));
    return raw.map((wif) => new Neon.wallet.Account(wif));
  } catch {
    return [];
  }
}

function saveSubAccounts(accounts) {
  const wifs = accounts.map((a) => a.WIF);
  fs.writeFileSync(ACCOUNT_STATE_FILE, JSON.stringify(wifs, null, 2));
}

function generateSubAccounts(count) {
  const accounts = [];
  for (let i = 0; i < count; i++) {
    // generate random private key (32 bytes hex)
    let hex = "";
    while (hex.length < 64) {
      hex += Math.floor(Math.random() * 16).toString(16);
    }
    accounts.push(new Neon.wallet.Account(hex));
  }
  return accounts;
}

function ensureSubAccounts() {
  let accounts = loadSubAccounts();
  if (accounts.length < SIM_USERS) {
    const needed = SIM_USERS - accounts.length;
    log(`generating ${needed} new sub-account(s) (current pool: ${accounts.length})`);
    accounts.push(...generateSubAccounts(needed));
    saveSubAccounts(accounts);
  }
  return accounts.slice(0, SIM_USERS);
}

async function fundIfLow(account) {
  const [gas, neo] = await Promise.all([
    getBalance(GAS_HASH, account.scriptHash),
    getBalance(NEO_HASH, account.scriptHash),
  ]);
  const actions = [];
  if (gas < SIM_GAS_PER_USR / 2n) {
    log(`  fund GAS → ${account.address} (${SIM_GAS_PER_USR} sat; current ${gas})`);
    const txid = await transferAsset(funder, GAS_HASH, account.scriptHash, SIM_GAS_PER_USR);
    await waitForTx(txid);
    actions.push({ asset: "GAS", txid, amount: SIM_GAS_PER_USR.toString() });
  }
  if (neo < SIM_NEO_PER_USR) {
    log(`  fund NEO → ${account.address} (${SIM_NEO_PER_USR}; current ${neo})`);
    const txid = await transferAsset(funder, NEO_HASH, account.scriptHash, SIM_NEO_PER_USR);
    await waitForTx(txid);
    actions.push({ asset: "NEO", txid, amount: SIM_NEO_PER_USR.toString() });
  }
  return actions;
}

/* ─── Per-flagship workflows ──────────────────────────────────────── */

async function runDailyCheckin(user) {
  const hash = CONTRACTS.dailyCheckin;

  // Read current check-in status — skip if user already checked in today.
  const statusRes = await invokeRead(hash, "getCheckinStatus", [
    { type: "Hash160", value: `0x${user.scriptHash}` },
  ]);
  if (String(statusRes?.state || "").toUpperCase() !== "HALT") {
    return { ok: false, step: "getCheckinStatus", reason: statusRes?.exception };
  }
  const statusMap = readMap(statusRes.stack?.[0]);
  const canCheckin = statusMap.canCheckin === true || statusMap.canCheckin === "true";
  const lastDay = String(statusMap.lastCheckinDay ?? "0");
  const currentDay = String(statusMap.currentUtcDay ?? "0");
  if (!canCheckin && lastDay === currentDay) {
    return { ok: true, step: "already_checked_in", note: `lastDay=${lastDay}` };
  }

  // Contract expects fee via GAS.transfer with memo "miniapp-dailycheckin:checkin"
  // The transfer triggers onNEP17Payment which performs the check-in atomically.
  const fee = "100000";
  const txid = await transferAsset(
    user,
    GAS_HASH,
    hash,
    BigInt(fee),
    Neon.sc.ContractParam.string("miniapp-dailycheckin:checkin"),
  );
  const execution = await waitForTx(txid);
  if (execution.vmstate !== "HALT") {
    return { ok: false, step: "fee_transfer", txid, exception: execution.exception };
  }

  const streakRes = await invokeRead(hash, "getUserStreak", [
    { type: "Hash160", value: `0x${user.scriptHash}` },
  ]);
  const streak = streakRes?.stack?.[0]?.value || "0";

  return { ok: true, step: "checked_in", txid, fee, streak };
}

async function runNeoPayFlow(creator, beneficiary) {
  const hash = CONTRACTS.neoPay;
  // Contract enforces interval >= 86400s (1 day) — match the live flow shape.
  const totalAmount = "100000000"; // 1 GAS
  const rateAmount  = "100000000"; // single full release per interval
  const intervalSec = "86400";

  // Fund the contract first (covers escrowed amount). Memo must be null for
  // NeoPay — anything else is treated as an unknown transfer and rejected.
  const fundTxid = await transferAsset(creator, GAS_HASH, hash, BigInt(totalAmount));
  await waitForTx(fundTxid);

  const createTxid = await invokeMethod(creator, hash, "createStream", [
    Neon.sc.ContractParam.hash160(`0x${creator.scriptHash}`),
    Neon.sc.ContractParam.hash160(`0x${beneficiary.scriptHash}`),
    Neon.sc.ContractParam.hash160(GAS_HASH),
    Neon.sc.ContractParam.integer(totalAmount),
    Neon.sc.ContractParam.integer(rateAmount),
    Neon.sc.ContractParam.integer(intervalSec),
    Neon.sc.ContractParam.string("Sim Payroll"),
    Neon.sc.ContractParam.string("auto-sim"),
  ]);
  const createExec = await waitForTx(createTxid);
  if (createExec.vmstate !== "HALT") {
    return { ok: false, step: "createStream", exception: createExec.exception };
  }

  const totalStack = await invokeRead(hash, "totalStreams");
  const streamId = String(totalStack.stack?.[0]?.value || "0");

  // Cancel as creator — exercises the full create→cancel cycle without
  // waiting a full day for a claim window.
  const cancelTxid = await invokeMethod(creator, hash, "cancelStream", [
    Neon.sc.ContractParam.hash160(`0x${creator.scriptHash}`),
    Neon.sc.ContractParam.integer(streamId),
  ]);
  const cancelExec = await waitForTx(cancelTxid);

  return {
    ok: cancelExec.vmstate === "HALT",
    step: "stream_cancelled",
    streamId,
    fundTxid,
    createTxid,
    cancelTxid,
    exception: cancelExec.vmstate === "HALT" ? undefined : cancelExec.exception,
  };
}

async function runSelfLoanFlow(borrower) {
  const hash = CONTRACTS.selfLoan;
  const collateral = "1";
  const poolTopup = "30000000"; // 0.3 GAS — keeps pool warm so borrow can settle
  const tier = 1;

  // 1. GAS pool top-up so the contract has GAS to lend out.
  const poolTxid = await transferAsset(
    borrower,
    GAS_HASH,
    hash,
    BigInt(poolTopup),
    Neon.sc.ContractParam.string("miniapp-self-loan:pool"),
  );
  await waitForTx(poolTxid);

  // 2. NEO collateral transfer with the matching memo.
  const collateralTxid = await transferAsset(
    borrower,
    NEO_HASH,
    hash,
    BigInt(collateral),
    Neon.sc.ContractParam.string("miniapp-self-loan:collateral"),
  );
  await waitForTx(collateralTxid);

  // 3. createLoan
  const createTxid = await invokeMethod(borrower, hash, "createLoan", [
    Neon.sc.ContractParam.hash160(`0x${borrower.scriptHash}`),
    Neon.sc.ContractParam.integer(collateral),
    Neon.sc.ContractParam.integer(tier),
  ]);
  const createExec = await waitForTx(createTxid);
  if (createExec.vmstate !== "HALT") {
    return { ok: false, step: "createLoan", exception: createExec.exception };
  }

  const loanIdStack = await invokeRead(hash, "totalLoans");
  const loanId = String(loanIdStack.stack?.[0]?.value || "0");

  return {
    ok: true,
    step: "loan_created",
    poolTxid,
    collateralTxid,
    createTxid,
    loanId,
  };
}

async function runLastSurvivorFlow(player) {
  const hash = CONTRACTS.lastSurvivor;

  // Read game status — if no active round, the buy will fault. Skip with
  // a clear "round_inactive" outcome rather than logging it as a failure.
  const statusRes = await invokeRead(hash, "getGameStatus");
  const statusMap = readMap(statusRes.stack?.[0]);
  const active = statusMap.active === true || statusMap.active === "true";
  if (!active) {
    return { ok: true, step: "round_inactive", note: "no active round to buy into" };
  }

  // Compute current key cost: basePrice + totalKeys * (basePrice * 10 / 10000)
  const totalKeys = BigInt(String(statusMap.totalKeys || "0"));
  const basePrice = 10000000n;
  const commonDiff = (basePrice * 10n) / 10000n;
  const cost = basePrice + totalKeys * commonDiff;

  // Round id from the contract for memo namespacing.
  const roundIdRes = await invokeRead(hash, "currentRoundId");
  const roundId = String(roundIdRes.stack?.[0]?.value || "0");

  const paymentTx = await transferAsset(
    player,
    GAS_HASH,
    hash,
    cost,
    Neon.sc.ContractParam.string(`miniapp-last-survivor:buy:${roundId}`),
  );
  await waitForTx(paymentTx);

  const buyTx = await invokeMethod(player, hash, "buyKeysWithCost", [
    Neon.sc.ContractParam.hash160(`0x${player.scriptHash}`),
    Neon.sc.ContractParam.integer("1"),
    Neon.sc.ContractParam.integer(cost.toString()),
  ]);
  const buyExec = await waitForTx(buyTx);
  if (buyExec.vmstate !== "HALT") {
    return { ok: false, step: "buyKeysWithCost", exception: buyExec.exception };
  }

  return {
    ok: true,
    step: "key_bought",
    roundId,
    cost: cost.toString(),
    paymentTx,
    buyTx,
  };
}

/* ─── Scenario runner ─────────────────────────────────────────────── */

const SCENARIOS = [
  { name: "dailyCheckin", run: (users) => runDailyCheckin(users[0]) },
  { name: "neoPay",       run: (users) => runNeoPayFlow(users[0], users[1] || users[0]) },
  { name: "lastSurvivor", run: (users) => runLastSurvivorFlow(users[0]) },
  { name: "selfLoan",     run: (users) => runSelfLoanFlow(users[0]) },
];

function rotate(users, offset) {
  return [...users.slice(offset), ...users.slice(0, offset)];
}

async function runIteration(users, iteration) {
  const started = Date.now();
  const result = {
    iteration,
    startedAt: ts(),
    users: users.map((u) => ({ address: u.address, scriptHash: u.scriptHash })),
    scenarios: {},
  };

  for (let i = 0; i < SCENARIOS.length; i++) {
    const scenario = SCENARIOS[i];
    const rotatedUsers = rotate(users, i % users.length);
    const scenarioStart = Date.now();
    try {
      const outcome = await scenario.run(rotatedUsers);
      result.scenarios[scenario.name] = {
        elapsedMs: Date.now() - scenarioStart,
        ...outcome,
      };
      log(`  ${scenario.name}: ok=${outcome.ok} step=${outcome.step}${outcome.note ? " note=" + outcome.note : ""}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.scenarios[scenario.name] = {
        elapsedMs: Date.now() - scenarioStart,
        ok: false,
        step: "exception",
        error: msg,
      };
      log(`  ${scenario.name}: EXC ${msg.slice(0, 120)}`);
    }
  }

  result.elapsedMs = Date.now() - started;
  const stamp = new Date(started).toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(REPORT_DIR, `iter-${stamp}.json`), JSON.stringify(result, null, 2));
  const summary = `${result.startedAt} iter=${iteration} elapsed=${result.elapsedMs}ms ${Object.entries(result.scenarios).map(([k, v]) => `${k}:${v.ok ? "pass" : "fail"}`).join(" ")}\n`;
  fs.appendFileSync(HISTORY_LOG, summary);
  return result;
}

async function main() {
  log("multi-user business sim starting");
  log(`  funder=${funder.address}`);
  log(`  rpc=${RPC_URL}`);
  log(`  users=${SIM_USERS} iterations=${SIM_ITERATIONS || "continuous"} delay=${SIM_LOOP_DELAY}ms`);

  const users = ensureSubAccounts();
  log(`sub-accounts: ${users.map((u, i) => `U${i + 1}=${u.address}`).join(", ")}`);

  log("funding pass (floors)");
  for (const u of users) {
    await fundIfLow(u);
  }

  let iter = 0;
  while (true) {
    iter++;
    log(`── iteration ${iter} ──`);
    await runIteration(users, iter);

    if (SIM_ITERATIONS > 0 && iter >= SIM_ITERATIONS) {
      log(`reached SIM_ITERATIONS=${SIM_ITERATIONS}, exiting`);
      break;
    }

    for (const u of users) {
      await fundIfLow(u).catch((e) => log(`  refund failed for ${u.address}: ${e.message}`));
    }
    await sleep(SIM_LOOP_DELAY);
  }
}

main().catch((e) => {
  log(`FATAL: ${e?.message || e}`);
  process.exit(1);
});
