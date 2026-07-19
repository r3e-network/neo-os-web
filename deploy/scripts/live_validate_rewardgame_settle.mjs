/**
 * Live testnet validation: FULL RewardGame settlement loop through the
 * PRIVATE Morpheus kernel (the H4 lane) — write path.
 *
 *   registerGame (back-compat, gameType 5) → pool fund → entry deposit →
 *   startGame → finalizeGame (submits a kernel request to the private
 *   kernel 0x2e67d3a6…, PlatformGame's repointed oracle) → fulfill via
 *   deploy_private_kernel.go (verifier = operator) with a valid 79-byte
 *   game.session result → verify the win settled: player credit posted,
 *   active pointer cleared, status 2, pool drawn down, liability intact.
 *
 * Uses the platform-game engine at its testnet hash (0xc75b18…, oracle
 * already repointed to the private kernel). The appId is the wired
 * kernel-registered smoketest app (deploy_private_kernel.go wire action).
 * Amounts are small and come from / return to the operator account.
 */
import pkg from "@cityofzion/neon-js";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const ENGINE = "0xc75b181b4561462903bb27d8d9e0b32b637bec12"; // PlatformGame v2 testnet
// The appId under test: env override for per-app settle verification during the
// absorption cohort (default = the wired kernel-registered smoketest app).
const APP = (process.env.REWARDGAME_SETTLE_APP || "smoketest-1784285342").trim();
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const GAME_TYPE_REWARD = 5;
const FUND = 50_000_000;   // 0.5 GAS pool
const ENTRY0 = 2_000_000;  // 0.02 GAS entry (difficulty 0)
const REWARD0 = 10_000_000; // 0.1 GAS base reward (difficulty 0)
const DIFFICULTY = 0;

// Per-app difficulty-0 economics: read from the absorption manifest when the
// app is a migration-cohort clone (values must mirror the pushed descriptors),
// else fall back to the engine DefaultEconomics (smoketest app).
function gameParams(appId) {
  try {
    const manifest = JSON.parse(readFileSync(new URL("../config/rewardgame-absorption-manifest.json", import.meta.url)));
    const d = manifest?.apps?.[appId]?.descriptors;
    if (d) {
      const elapsed = Math.min(d.minSolveMs0 + 5_000, d.limitMs0);
      return { elapsedMs: elapsed, score: d.targetScore0, minSolveMs: d.minSolveMs0, limitMs: d.limitMs0, targetScore: d.targetScore0 };
    }
  } catch { /* manifest absent — defaults */ }
  return { elapsedMs: 15_000, score: 5, minSolveMs: 10_000, limitMs: 60_000, targetScore: 3 };
}
const PARAMS = gameParams(APP);

const account = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const verifierWif = requireCredential("PRIVATE_KERNEL_VERIFIER_WIF", process.env.PRIVATE_KERNEL_VERIFIER_WIF);
const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_rewardgame_settle" });

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const P_I = (n) => ({ type: "Integer", value: n.toString() });
const P_H = (a) => ({ type: "Hash160", value: a });
const P_S = (s) => ({ type: "String", value: s });
const decInt = (v) => BigInt(v?.value ?? "0");
const read = (method, params = []) => live.readStack(ENGINE, method, params);
const invoke = (label, scriptHash, operation, args) =>
  live.invokeAndConfirm({ label, account, scriptHash, operation, args });

let failures = 0;
const check = (ok, label, detail = "") => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

function firstEventInt(execution, eventName, index) {
  for (const n of execution?.notifications ?? []) {
    if ((n?.eventname ?? n?.event_name) !== eventName) continue;
    return BigInt(n?.state?.value?.[index]?.value ?? "0");
  }
  return 0n;
}

function mapGet(stack, key) {
  for (const kv of stack?.[0]?.value ?? []) {
    const k = Buffer.from(String(kv?.key?.value ?? ""), "base64").toString("utf8");
    if (k === key) return kv?.value;
  }
  return undefined;
}

// 79-byte game.session result codec: 0x02 ‖ commitment(32) ‖ answerHash(32)
// ‖ elapsedMs(u64BE) ‖ undos(u8) ‖ score(u32BE) ‖ difficulty(u8)
function buildResult(gameId) {
  const commitment = createHash("sha256").update(`rg-problem-${gameId}`).digest();
  const answerHash = createHash("sha256").update(`rg-answer-${gameId}`).digest();
  const out = Buffer.alloc(79);
  out[0] = 0x02;
  commitment.copy(out, 1);
  answerHash.copy(out, 33);
  out.writeBigUInt64BE(BigInt(PARAMS.elapsedMs), 65);
  out[73] = 0; // undos
  out.writeUInt32BE(PARAMS.score, 74);
  out[78] = DIFFICULTY;
  return out;
}

async function main() {
  console.log(`engine: ${ENGINE}\napp:    ${APP}\nparams: elapsedMs=${PARAMS.elapsedMs} score>=${PARAMS.score} (minSolve ${PARAMS.minSolveMs}, limit ${PARAMS.limitMs}, target ${PARAMS.targetScore})`);

  // 1. register (idempotent)
  const existingType = Number(decInt((await read("getGameType", [P_S(APP)]))?.[0]));
  if (existingType === 0) {
    await invoke("registerGame", ENGINE, "registerGame", [S(APP), I(GAME_TYPE_REWARD), H(account.scriptHash), sc.ContractParam.byteArray("")]);
  }
  let gameType = 0;
  for (let i = 0; i < 10 && gameType !== GAME_TYPE_REWARD; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    gameType = Number(decInt((await read("getGameType", [P_S(APP)]))?.[0]));
  }
  check(gameType === GAME_TYPE_REWARD, `app registered as RewardGame (gameType 5)`);

  // 2. fund pool + entry deposit
  await invoke("fund", GAS, "transfer", [H(account.scriptHash), H(ENGINE), I(FUND), S(`${APP}:fund`)]);
  await invoke("entry", GAS, "transfer", [H(account.scriptHash), H(ENGINE), I(ENTRY0), S(`${APP}:entry`)]);
  const poolBefore = decInt((await read("poolBalance", [P_S(APP)]))?.[0]);
  check(poolBefore >= BigInt(FUND), `pool funded (${poolBefore})`);

  // 3. startGame → gameId from the GameStarted event
  const startRes = await invoke("startGame", ENGINE, "startGame", [S(APP), H(account.scriptHash), I(DIFFICULTY)]);
  const gameId = firstEventInt(startRes.execution, "GameStarted", 1);
  check(gameId > 0n, `startGame issued gameId ${gameId}`);
  const activePtr = decInt((await read("activeGameOf", [P_S(APP), P_H(account.scriptHash)]))?.[0]);
  check(activePtr === gameId, `active-game pointer set (${activePtr})`);

  // 4. finalizeGame → kernel request id from the Finalizing event
  const finRes = await invoke("finalizeGame", ENGINE, "finalizeGame", [S(APP), H(account.scriptHash), S("00")]);
  const requestId = firstEventInt(finRes.execution, "Finalizing", 3);
  check(requestId > 0n, `finalizeGame submitted kernel request ${requestId}`);

  // 5. fulfill through the private kernel (verifier = operator)
  const resultHex = buildResult(gameId).toString("hex");
  console.log(`  fulfilling request ${requestId} with 79-byte result (${resultHex.slice(0, 32)}…)`);
  execFileSync("go", ["run", "-tags=scripts", "deploy/scripts/deploy_private_kernel.go"], {
    env: {
      ...process.env,
      PRIVATE_KERNEL_ACTION: "fulfill",
      PRIVATE_KERNEL_FULFILL_REQUEST_ID: requestId.toString(),
      PRIVATE_KERNEL_FULFILL_RESULT_HEX: resultHex,
      PRIVATE_KERNEL_DEPLOY_DRY_RUN: "false",
      CONFIRM_PRIVATE_KERNEL: "I_UNDERSTAND_THIS_WRITES_CHAIN",
      NEO_TESTNET_WIF: process.env.NEO_TESTNET_WIF,
      PRIVATE_KERNEL_VERIFIER_WIF: verifierWif,
    },
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "inherit"],
  }).toString().split("\n").slice(-3).forEach((l) => console.log(`  kernel: ${l}`));

  // 6. verify settlement (poll through node lag)
  let credit = 0n, status = 0n, activeAfter = -1n;
  for (let i = 0; i < 15 && (credit === 0n || status !== 2n); i++) {
    await new Promise((r) => setTimeout(r, 3000));
    credit = decInt((await read("creditOf", [P_S(APP), P_H(account.scriptHash)]))?.[0]);
    const g = await read("getGame", [P_S(APP), P_I(gameId)]);
    status = decInt(mapGet(g, "status"));
    activeAfter = decInt((await read("activeGameOf", [P_S(APP), P_H(account.scriptHash)]))?.[0]);
  }
  check(credit === BigInt(REWARD0), `winner credit posted (${credit} == ${REWARD0})`);
  check(status === 2n, `game status is 2 (settled)`, `${status}`);
  check(activeAfter === 0n, "active-game pointer cleared");

  const poolAfter = decInt((await read("poolBalance", [P_S(APP)]))?.[0]);
  check(poolAfter === poolBefore + BigInt(ENTRY0) - BigInt(REWARD0),
    `pool drawn down correctly (${poolBefore} + ${ENTRY0} - ${REWARD0} = ${poolAfter})`);
  const held = decInt((await read("heldForApp", [P_S(APP)]))?.[0]);
  check(held === poolAfter + credit, `liability identity held==pool+credit (${held} == ${poolAfter + credit})`);

  // 7. withdraw the winnings (pull payment) back to the operator
  if (credit === BigInt(REWARD0)) {
    const gasBefore = decInt((await live.readStack(GAS, "balanceOf", [P_H(account.scriptHash)]))?.[0]);
    await invoke("withdraw", ENGINE, "withdraw", [S(APP), H(account.scriptHash)]);
    let gasAfter = gasBefore;
    for (let i = 0; i < 15 && gasAfter === gasBefore; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      gasAfter = decInt((await live.readStack(GAS, "balanceOf", [P_H(account.scriptHash)]))?.[0]);
    }
    check(gasAfter >= gasBefore + BigInt(REWARD0) - 2_000_000n,
      `withdraw paid the credit out (gas ${gasBefore} → ${gasAfter}, minus ~0.01 GAS fees)`);
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nRewardGame private-kernel settle loop: ALL CHECKS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
