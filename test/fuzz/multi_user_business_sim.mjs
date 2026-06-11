#!/usr/bin/env node
/**
 * Multi-user business workflow simulator on Neo N3 testnet.
 *
 * What it does each iteration:
 *   1. Generates N fresh sub-accounts (configurable via SIM_USERS), or
 *      reuses the ones from previous runs stored in
 *      docs/reports/multi-user-sim/sim-users.json.
 *   2. Funds every sub-account with GAS from the master WIF whenever their
 *      balance drops below the floor.
 *   3. Assigns scenarios across the sub-accounts and runs them through
 *      the real on-chain business workflow (not just read-fuzz).
 *   4. Writes a structured JSON report per iteration to
 *      docs/reports/multi-user-sim/<timestamp>.json and appends a
 *      one-line summary to docs/reports/multi-user-sim/history.log.
 *
 * Covered flows — the SELF-CONTAINED miniapp contracts (no oracle dependency):
 *   - RedEnvelope:  deposit → createEnvelope → claim (full cycle, no strand)
 *   - LastSurvivor: settle expired round if needed → deposit → buyKeys
 *   - CoinFlip:     deposit bet credit → flip (skips when bankroll is low)
 *   - Tarot:        deposit draw fee → draw → 3 distinct cards
 *   - BreakupPact:  A+B stake → sign → break (partner wins both stakes)
 *
 * Grounding (MP-W3-06): contract hashes resolve from apps/<slug>/
 * neo-manifest.json; every method used is validated against
 * contracts/build/<C>.manifest.json before any live call ("ABI drift" fails
 * fast). FUZZ_DRY_RUN=1 / --dry-run prints the plan and exits offline.
 *
 * Env:
 *   NEO_TESTNET_WIF   — master funder WIF (required for live runs;
 *                       LIVE_SMOKE_ALLOW_SKIP=1 turns absence into a skip)
 *   SIM_USERS         — sub-account count per iteration (default: 3)
 *   SIM_ITERATIONS    — cap on iterations (0 = loop forever, default: 0)
 *   SIM_LOOP_DELAY_MS — sleep between iterations (default: 30000)
 *   SIM_GAS_PER_USER  — GAS units (datoshi) to send each sub-account (default: 2e9 = 20 GAS)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveFuzzTargets, enforceAbiOrExit } from "./lib/abi.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

// ── Targets: hashes from app manifests, ABI-gated method lists ─────────────
const TARGETS = resolveFuzzTargets({
  redEnvelope: { appSlug: "red-envelope", contractName: "MiniAppRedEnvelope" },
  lastSurvivor: { appSlug: "last-survivor", contractName: "MiniAppLastSurvivor" },
  coinFlip: { appSlug: "fogplay", contractName: "MiniAppCoinFlip" },
  tarot: { appSlug: "on-chain-tarot", contractName: "MiniAppTarot" },
  breakupPact: { appSlug: "breakup-contract", contractName: "MiniAppBreakupPact" },
});
const hashOf = (key) => TARGETS[key].hash;

const PLANNED_CALLS = [
  ["redEnvelope", ["createEnvelope", "lastEnvelopeId", "claim", "claimedAmount"]],
  ["lastSurvivor", ["getCurrentRound", "currentKeyCost", "settle", "buyKeys", "playerKeys", "currentRoundId"]],
  ["coinFlip", ["bankroll", "flip"]],
  ["tarot", ["drawFee", "draw"]],
  ["breakupPact", ["createPact", "signPact", "breakPact"]],
].flatMap(([contract, methods]) => methods.map((method) => ({ contract, method })));
// Fail fast on ABI drift; FUZZ_DRY_RUN=1 prints the plan and exits offline
// BEFORE the funder WIF is required or any RPC client is constructed.
enforceAbiOrExit("multi-user-sim", TARGETS, PLANNED_CALLS);

// Load the same neon-compat shim the live validator uses, so we inherit
// its SmartContract.invoke flow (preview + estimate fees + sign + send).
const Neon = (
  await import(
    path.join(repoRoot, "deploy", "scripts", "lib", "neon-compat.mjs")
  )
).default;
const { createWaitForLog, asTxid, findNotification } = await import(
  path.join(repoRoot, "deploy", "scripts", "lib", "live_neo.js")
);
const { requireCredential } = await import(
  path.join(repoRoot, "deploy", "scripts", "lib", "live_credentials.js")
);

// Multi-endpoint RPC pool with auto-failover. The 2026-04-18 run hit a
// 7.5-hour testnet RPC outage that turned ~1,464 scenario entries into
// "fail", none of which were contract-logic failures. With this pool the sim
// rotates to the next healthy endpoint on `fetch failed` / `aborted`.
const RPC_ENDPOINTS = (
  process.env.NEO_RPC_ENDPOINTS ||
  process.env.NEO_RPC_URL ||
  [
    "https://testnet1.neo.coz.io:443",
    "https://testnet2.neo.coz.io:443",
    "https://rpc.t5.n3.nspcc.ru:20331",
    "https://neo3-testnet.unifra.io",
  ].join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const NETWORK_MAGIC = Number(
  process.env.NEO_NETWORK_MAGIC || Neon.CONST.MAGIC_NUMBER.TestNet,
);

const FUNDER_WIF = requireCredential(
  "NEO_TESTNET_WIF (or TEST_FUZZ_WIF)",
  process.env.NEO_TESTNET_WIF || process.env.TEST_FUZZ_WIF,
);

const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const SIM_USERS = parseInt(process.env.SIM_USERS || "3", 10);
const SIM_ITERATIONS = process.env.SIM_ITERATIONS
  ? parseInt(process.env.SIM_ITERATIONS, 10)
  : 0;
const SIM_LOOP_DELAY = parseInt(process.env.SIM_LOOP_DELAY_MS || "30000", 10);
const SIM_GAS_PER_USR = BigInt(process.env.SIM_GAS_PER_USER || "2000000000"); // 20 GAS

const REPORT_DIR = path.join(repoRoot, "docs", "reports", "multi-user-sim");
fs.mkdirSync(REPORT_DIR, { recursive: true });
const HISTORY_LOG = path.join(REPORT_DIR, "history.log");
const ACCOUNT_STATE_FILE = path.join(REPORT_DIR, "sim-users.json");

const funder = new Neon.wallet.Account(FUNDER_WIF);

let currentEndpointIdx = 0;
function currentRpcUrl() {
  return RPC_ENDPOINTS[currentEndpointIdx];
}
let rpcClient = new Neon.rpc.RPCClient(currentRpcUrl());

function ts() {
  return new Date().toISOString();
}
function log(line) {
  console.log(`[${ts()}] ${line}`);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientNetErr(err) {
  const msg = String(err?.message || err || "");
  return /fetch failed|operation was aborted|ECONN|ETIMEDOUT|socket hang up|ENOTFOUND|getaddrinfo|network|EAI_AGAIN/i.test(
    msg,
  );
}

function rotateEndpoint(reason) {
  if (RPC_ENDPOINTS.length <= 1) return;
  const failed = currentRpcUrl();
  currentEndpointIdx = (currentEndpointIdx + 1) % RPC_ENDPOINTS.length;
  rpcClient = new Neon.rpc.RPCClient(currentRpcUrl());
  log(`  rpc-failover ${failed} → ${currentRpcUrl()} (${reason})`);
}

// Wrap any RPC call so that on a transient network error we rotate to the
// next endpoint and retry. We cap attempts at 2*endpoints.length to give
// concurrent callers (e.g. Promise.all in fundIfLow) a chance to settle.
//
// Race-safety: if a parallel caller already rotated past the URL we used,
// don't rotate again — just retry on the now-current endpoint.
async function withRpcFailover(fn, label) {
  let lastErr;
  for (let attempt = 0; attempt < RPC_ENDPOINTS.length * 2; attempt++) {
    const usedUrl = currentRpcUrl();
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientNetErr(err)) throw err;
      if (currentRpcUrl() === usedUrl) {
        rotateEndpoint(`${label}: ${String(err?.message || err).slice(0, 80)}`);
      }
    }
  }
  throw lastErr;
}

const waitForLog = createWaitForLog({
  getApplicationLog: (txid) =>
    withRpcFailover(
      () => rpcClient.getApplicationLog(txid),
      "getApplicationLog",
    ),
  label: "multi-user-sim",
});

/* ─── Helpers ─────────────────────────────────────────────────────── */

function smartContract(hash, account) {
  return new Neon.experimental.SmartContract(hash, {
    rpcAddress: currentRpcUrl(),
    networkMagic: NETWORK_MAGIC,
    account,
  });
}

async function invokeRead(scriptHash, operation, args = []) {
  return withRpcFailover(
    () => rpcClient.invokeFunction(scriptHash, operation, args),
    `invokeRead:${operation}`,
  );
}

async function waitForTx(txid) {
  const normalized = asTxid(txid);
  const { execution } = await waitForLog(normalized, 120000);
  return execution;
}

async function transferAsset(account, assetHash, toHash, amount, data = null) {
  return withRpcFailover(
    () => {
      const contract = smartContract(assetHash, account);
      return contract.invoke("transfer", [
        Neon.sc.ContractParam.hash160(account.scriptHash),
        Neon.sc.ContractParam.hash160(toHash),
        Neon.sc.ContractParam.integer(amount.toString()),
        data === null ? Neon.sc.ContractParam.any(null) : data,
      ]);
    },
    `transfer:${assetHash.slice(0, 10)}`,
  );
}

async function readInteger(scriptHash, operation, args = []) {
  const res = await invokeRead(scriptHash, operation, args);
  return BigInt(String(res.stack?.[0]?.value || "0"));
}

async function invokeMethod(account, contractHash, operation, args) {
  return withRpcFailover(() => {
    const contract = smartContract(contractHash, account);
    return contract.invoke(operation, args);
  }, `invoke:${operation}`);
}

async function getBalance(assetHash, scriptHash) {
  const res = await invokeRead(assetHash, "balanceOf", [
    Neon.sc.ContractParam.hash160(scriptHash),
  ]);
  if (String(res?.state || "").toUpperCase() !== "HALT") return 0n;
  return BigInt(res.stack?.[0]?.value || "0");
}

function readMap(stackItem) {
  if (!stackItem || stackItem.type !== "Map") return {};
  const out = {};
  for (const kv of stackItem.value || []) {
    const key = Buffer.from(String(kv.key?.value || ""), "base64").toString(
      "utf8",
    );
    out[key] = kv.value?.value;
    out[`__type__${key}`] = kv.value?.type;
  }
  return out;
}

/** Read an event's state array from an execution's notifications. */
function eventState(execution, contractHash, name) {
  const found = findNotification(execution, contractHash, name);
  return found ? found.state?.value ?? [] : null;
}

const H = (v) => Neon.sc.ContractParam.hash160(v);
const I = (v) => Neon.sc.ContractParam.integer(v.toString());
const S = (v) => Neon.sc.ContractParam.string(v);

/** Deposit GAS to a miniapp contract with the memo its onNEP17Payment expects. */
async function depositWithMemo(user, contractHash, amount, memo) {
  const txid = await transferAsset(user, GAS_HASH, contractHash, amount, S(memo));
  const execution = await waitForTx(txid);
  if (execution.vmstate !== "HALT") {
    throw new Error(`deposit (${memo}) FAULT: ${execution.exception}`);
  }
  return txid;
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
    log(
      `generating ${needed} new sub-account(s) (current pool: ${accounts.length})`,
    );
    accounts.push(...generateSubAccounts(needed));
    saveSubAccounts(accounts);
  }
  return accounts.slice(0, SIM_USERS);
}

async function fundIfLow(account) {
  const gas = await getBalance(GAS_HASH, account.scriptHash);
  const actions = [];
  if (gas < SIM_GAS_PER_USR / 2n) {
    log(
      `  fund GAS → ${account.address} (${SIM_GAS_PER_USR} datoshi; current ${gas})`,
    );
    const txid = await transferAsset(
      funder,
      GAS_HASH,
      account.scriptHash,
      SIM_GAS_PER_USR,
    );
    await waitForTx(txid);
    actions.push({ asset: "GAS", txid, amount: SIM_GAS_PER_USR.toString() });
  }
  return actions;
}

/* ─── Per-miniapp workflows ───────────────────────────────────────── */

async function runRedEnvelope(user) {
  const hash = hashOf("redEnvelope");
  const TOTAL = 10000000n; // 0.1 GAS, 1 packet → claimed back in full

  await depositWithMemo(user, hash, TOTAL, "miniapp-redenvelope:create");

  const createTx = await invokeMethod(user, hash, "createEnvelope", [
    H(user.scriptHash), I(TOTAL), I(1), I(3600),
  ]);
  const createExec = await waitForTx(createTx);
  if (createExec.vmstate !== "HALT") {
    return { ok: false, step: "createEnvelope", exception: createExec.exception };
  }

  const envId = await readInteger(hash, "lastEnvelopeId");

  const claimTx = await invokeMethod(user, hash, "claim", [I(envId), H(user.scriptHash)]);
  const claimExec = await waitForTx(claimTx);
  if (claimExec.vmstate !== "HALT") {
    return { ok: false, step: "claim", envId: envId.toString(), exception: claimExec.exception };
  }

  const share = await readInteger(hash, "claimedAmount", [
    { type: "Integer", value: envId.toString() },
    { type: "Hash160", value: `0x${user.scriptHash}` },
  ]);
  if (share !== TOTAL) {
    return {
      ok: false,
      step: "claimed_amount_mismatch",
      envId: envId.toString(),
      share: share.toString(),
      expected: TOTAL.toString(),
    };
  }

  return { ok: true, step: "envelope_cycle_complete", envId: envId.toString(), createTx, claimTx };
}

async function runLastSurvivor(player) {
  const hash = hashOf("lastSurvivor");

  // If the previous round has expired, settle it first (permissionless) so
  // the buy lands in a fresh round instead of faulting on "round over".
  let round = readMap((await invokeRead(hash, "getCurrentRound")).stack?.[0]);
  const remaining = BigInt(String(round.remainingTime ?? "0"));
  const totalKeys = BigInt(String(round.totalKeys ?? "0"));
  let settleTx = null;
  if (remaining === 0n && totalKeys > 0n) {
    settleTx = await invokeMethod(player, hash, "settle", []);
    const settleExec = await waitForTx(settleTx);
    if (settleExec.vmstate !== "HALT") {
      return { ok: false, step: "settle", exception: settleExec.exception };
    }
  }

  const cost = await readInteger(hash, "currentKeyCost", [
    { type: "Integer", value: "1" },
  ]);
  await depositWithMemo(player, hash, cost, "miniapp-lastsurvivor:buy");

  const buyTx = await invokeMethod(player, hash, "buyKeys", [H(player.scriptHash), I(1)]);
  const buyExec = await waitForTx(buyTx);
  if (buyExec.vmstate !== "HALT") {
    return { ok: false, step: "buyKeys", exception: buyExec.exception };
  }

  const roundId = await readInteger(hash, "currentRoundId");
  const keys = await readInteger(hash, "playerKeys", [
    { type: "Integer", value: roundId.toString() },
    { type: "Hash160", value: `0x${player.scriptHash}` },
  ]);
  if (keys < 1n) {
    return { ok: false, step: "player_keys_not_recorded", roundId: roundId.toString() };
  }

  return {
    ok: true,
    step: "key_bought",
    roundId: roundId.toString(),
    cost: cost.toString(),
    keys: keys.toString(),
    settleTx,
    buyTx,
  };
}

async function runCoinFlip(player) {
  const hash = hashOf("coinFlip");
  const BET = 5000000n; // 0.05 GAS

  // A win pays 2x out of the house bankroll — when the bankroll cannot cover
  // it the contract rightly rejects the flip, so skip instead of failing.
  const bankroll = await readInteger(hash, "bankroll");
  if (bankroll < BET * 2n) {
    return { ok: true, step: "bankroll_low_skip", bankroll: bankroll.toString() };
  }

  await depositWithMemo(player, hash, BET, "miniapp-fogplay:bet");

  const choice = Math.random() < 0.5 ? 0 : 1;
  const flipTx = await invokeMethod(player, hash, "flip", [
    H(player.scriptHash), I(choice), I(BET),
  ]);
  const flipExec = await waitForTx(flipTx);
  if (flipExec.vmstate !== "HALT") {
    return { ok: false, step: "flip", exception: flipExec.exception };
  }

  // Flipped(gameId, player, choice, outcome, won, payout)
  const flipped = eventState(flipExec, hash, "Flipped");
  if (!flipped) {
    return { ok: false, step: "missing_flipped_event", txid: flipTx };
  }
  const won = flipped[4]?.value === true || flipped[4]?.value === 1 || flipped[4]?.value === "1";
  const payout = String(flipped[5]?.value ?? "0");

  return { ok: true, step: won ? "flip_won" : "flip_lost", choice, payout, flipTx };
}

async function runTarot(player) {
  const hash = hashOf("tarot");

  const fee = await readInteger(hash, "drawFee");
  await depositWithMemo(player, hash, fee, "miniapp-tarot:draw");

  const drawTx = await invokeMethod(player, hash, "draw", [H(player.scriptHash)]);
  const drawExec = await waitForTx(drawTx);
  if (drawExec.vmstate !== "HALT") {
    return { ok: false, step: "draw", exception: drawExec.exception };
  }

  // ReadingDrawn(id, player, card1, card2, card3)
  const drawn = eventState(drawExec, hash, "ReadingDrawn");
  if (!drawn) {
    return { ok: false, step: "missing_reading_event", txid: drawTx };
  }
  const cards = [drawn[2], drawn[3], drawn[4]].map((c) => BigInt(String(c?.value ?? "-1")));
  const distinct =
    cards.every((c) => c >= 0n && c < 78n) && new Set(cards.map(String)).size === 3;
  if (!distinct) {
    return { ok: false, step: "cards_invalid", cards: cards.map(String) };
  }

  return { ok: true, step: "reading_drawn", cards: cards.map(String), fee: fee.toString(), drawTx };
}

async function runBreakupPact(partyA, partyB) {
  const hash = hashOf("breakupPact");
  const STAKE = 5000000n; // 0.05 GAS each

  // A stakes and creates the pact.
  await depositWithMemo(partyA, hash, STAKE, "miniapp-breakup:stake");
  const createTx = await invokeMethod(partyA, hash, "createPact", [
    H(partyA.scriptHash), H(partyB.scriptHash), I(STAKE), I(3600),
  ]);
  const createExec = await waitForTx(createTx);
  if (createExec.vmstate !== "HALT") {
    return { ok: false, step: "createPact", exception: createExec.exception };
  }
  const created = eventState(createExec, hash, "PactCreated");
  if (!created) {
    return { ok: false, step: "missing_pact_created_event", txid: createTx };
  }
  const pactId = BigInt(String(created[0]?.value ?? "0"));

  // B stakes and signs — the pact goes active.
  await depositWithMemo(partyB, hash, STAKE, "miniapp-breakup:stake");
  const signTx = await invokeMethod(partyB, hash, "signPact", [I(pactId), H(partyB.scriptHash)]);
  const signExec = await waitForTx(signTx);
  if (signExec.vmstate !== "HALT") {
    return { ok: false, step: "signPact", pactId: pactId.toString(), exception: signExec.exception };
  }

  // A breaks — B (the non-breaker) must receive BOTH stakes atomically.
  const breakTx = await invokeMethod(partyA, hash, "breakPact", [I(pactId), H(partyA.scriptHash)]);
  const breakExec = await waitForTx(breakTx);
  if (breakExec.vmstate !== "HALT") {
    return { ok: false, step: "breakPact", pactId: pactId.toString(), exception: breakExec.exception };
  }
  // PactBroken(id, breaker, paidTo, amount)
  const broken = eventState(breakExec, hash, "PactBroken");
  const paid = BigInt(String(broken?.[3]?.value ?? "0"));
  if (paid !== STAKE * 2n) {
    return {
      ok: false,
      step: "breaker_forfeit_mismatch",
      pactId: pactId.toString(),
      paid: paid.toString(),
      expected: (STAKE * 2n).toString(),
    };
  }

  return { ok: true, step: "pact_cycle_complete", pactId: pactId.toString(), createTx, signTx, breakTx };
}

/* ─── Scenario runner ─────────────────────────────────────────────── */

const SCENARIOS = [
  { name: "redEnvelope", run: (users) => runRedEnvelope(users[0]) },
  { name: "lastSurvivor", run: (users) => runLastSurvivor(users[0]) },
  { name: "coinFlip", run: (users) => runCoinFlip(users[0]) },
  { name: "tarot", run: (users) => runTarot(users[0]) },
  {
    name: "breakupPact",
    run: (users) => runBreakupPact(users[0], users[1] || users[0]),
  },
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
      log(
        `  ${scenario.name}: ok=${outcome.ok} step=${outcome.step}${outcome.note ? " note=" + outcome.note : ""}`,
      );
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
  fs.writeFileSync(
    path.join(REPORT_DIR, `iter-${stamp}.json`),
    JSON.stringify(result, null, 2),
  );
  const summary = `${result.startedAt} iter=${iteration} elapsed=${result.elapsedMs}ms ${Object.entries(
    result.scenarios,
  )
    .map(([k, v]) => `${k}:${v.ok ? "pass" : "fail"}`)
    .join(" ")}\n`;
  fs.appendFileSync(HISTORY_LOG, summary);
  return result;
}

async function main() {
  log("multi-user business sim starting");
  log(`  funder=${funder.address}`);
  log(`  rpc-pool=[${RPC_ENDPOINTS.join(", ")}]  initial=${currentRpcUrl()}`);
  log(
    `  contracts: ${Object.keys(TARGETS).map((k) => `${k}=${hashOf(k)}`).join(", ")}`,
  );
  log(
    `  users=${SIM_USERS} iterations=${SIM_ITERATIONS || "continuous"} delay=${SIM_LOOP_DELAY}ms`,
  );

  const users = ensureSubAccounts();
  log(
    `sub-accounts: ${users.map((u, i) => `U${i + 1}=${u.address}`).join(", ")}`,
  );

  log("funding pass (floors)");
  for (const u of users) {
    await fundIfLow(u);
  }

  let iter = 0;
  let hadScenarioFailure = false;
  while (true) {
    iter++;
    log(`── iteration ${iter} ──`);
    const iterationResult = await runIteration(users, iter);
    if (
      Object.values(iterationResult.scenarios).some((scenario) => !scenario.ok)
    ) {
      hadScenarioFailure = true;
    }

    if (SIM_ITERATIONS > 0 && iter >= SIM_ITERATIONS) {
      log(`reached SIM_ITERATIONS=${SIM_ITERATIONS}, exiting`);
      if (hadScenarioFailure) {
        log("one or more scenarios failed");
        process.exit(1);
      }
      break;
    }

    for (const u of users) {
      await fundIfLow(u).catch((e) =>
        log(`  refund failed for ${u.address}: ${e.message}`),
      );
    }
    await sleep(SIM_LOOP_DELAY);
  }
}

main().catch((e) => {
  log(`FATAL: ${e?.message || e}`);
  process.exit(1);
});
