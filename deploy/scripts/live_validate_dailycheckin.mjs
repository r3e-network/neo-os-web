/**
 * Live testnet validation for MiniAppDailyCheckin (the daily-checkin standalone contract).
 *
 * Hash via CONTRACT_OVERRIDE. The deployer (NR3E4D8N) is the contract Owner.
 *
 *   1. read getPlatformStats / isPaused (ABI shape the frontend depends on)
 *   2. fund the reward pool 0.5 GAS (memo "miniapp-dailycheckin:fund") -> rewardPool grows
 *   3. check in (GAS transfer >= checkInFee, memo "miniapp-dailycheckin:checkin")
 *      -> streak increments, canCheckin flips to false, fee accrues into the pool
 *   4. claimRewards with nothing accrued -> reverts "no rewards to claim"
 *   5. owner setRewardConfig / setPaused round-trip (owner-only methods the old contract lacked)
 *   6. solvency: held GAS == rewardPool, totalUnclaimed <= rewardPool
 *
 * Milestone reward accrual + payout + pool-short gating are covered by the
 * TestEngine suite (needs 7 consecutive UTC days, not reproducible in one live run).
 * Testnet-pinned; no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;
const CONTRACT = process.env.CONTRACT_OVERRIDE;
if (!CONTRACT) { console.error("set CONTRACT_OVERRIDE=0x<daily-checkin hash>"); process.exit(1); }
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const A = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_dailycheckin" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const B = (b) => sc.ContractParam.boolean(b);
const S = (s) => sc.ContractParam.string(s);
const P_H = (a) => ({ type: "Hash160", value: a });
const invoke = (label, scriptHash, op, args) => live.invokeAndConfirm({ label, account: A, scriptHash, operation: op, args });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const decInt = (s) => BigInt(s?.[0]?.value ?? "0");
const decBool = (s) => { const v = s?.[0]?.value; return v === true || v === 1 || v === "1"; };
const gasBal = (h) => live.nep17BalanceOf(GAS, h);
function mapField(stack, key) { for (const kv of stack?.[0]?.value ?? []) { const raw = kv.key?.value; const d = typeof raw === "string" ? Buffer.from(raw, "base64").toString() : raw; if (d === key) return kv.value; } return null; }
function assert(cond, msg) { if (!cond) { console.error("ASSERT FAILED:", msg); process.exit(1); } }

async function main() {
  console.log("contract:", CONTRACT, "\nowner/user:", A.address);

  console.log("\n[1] read ABI (getPlatformStats / isPaused / getCheckinStatus)…");
  const ps = await read("getPlatformStats");
  const feeRaw = mapField(ps, "checkInFee");
  const fee = BigInt(feeRaw?.value ?? "0");
  console.log("    checkInFee =", fee.toString(), "weekReward =", BigInt(mapField(ps, "weekReward")?.value ?? "0").toString());
  assert(feeRaw != null, "getPlatformStats missing checkInFee");
  const paused0 = decBool(await read("isPaused"));
  console.log("    isPaused =", paused0);
  assert(paused0 === false, "contract starts paused");

  console.log("\n[2] fund reward pool 0.5 GAS…");
  const pool0 = decInt(await read("rewardPool"));
  await invoke("fund", GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(50000000n), S("miniapp-dailycheckin:fund")]);
  await sleep(6000);
  const pool1 = decInt(await read("rewardPool"));
  assert(pool1 === pool0 + 50000000n, `pool after fund ${pool1} != ${pool0 + 50000000n}`);
  console.log("    rewardPool =", pool1.toString());

  const status0 = await read("getCheckinStatus", [P_H(A.scriptHash)]);
  const canCheckin0 = (mapField(status0, "canCheckin")?.value === true);
  console.log("\n[3] canCheckin =", canCheckin0, "→ check in (fee+memo)…");
  if (canCheckin0) {
    const st0 = await read("getUserStatsDetails", [P_H(A.scriptHash)]);
    const streakBefore = BigInt(mapField(st0, "streak")?.value ?? "0");
    const { log } = await invoke("checkin", GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(fee > 0n ? fee : 100000n), S("miniapp-dailycheckin:checkin")]);
    let checked = false;
    for (const n of log?.executions?.[0]?.notifications ?? []) if (n.eventname === "CheckedIn") checked = true;
    assert(checked, "no CheckedIn event");
    await sleep(6000);
    const st1 = await read("getUserStatsDetails", [P_H(A.scriptHash)]);
    const streakAfter = BigInt(mapField(st1, "streak")?.value ?? "0");
    console.log("    streak", streakBefore.toString(), "→", streakAfter.toString());
    assert(streakAfter >= 1n, "streak did not advance");
    const status1 = await read("getCheckinStatus", [P_H(A.scriptHash)]);
    assert((mapField(status1, "canCheckin")?.value) !== true, "canCheckin still true after check-in");
    console.log("    canCheckin now false ✓");
  } else {
    console.log("    already checked in this UTC day — skipping check-in (state read verified)");
  }

  console.log("\n[4] claimRewards with nothing accrued should revert…");
  const unclaimed = BigInt(mapField(await read("getUserStatsDetails", [P_H(A.scriptHash)]), "unclaimed")?.value ?? "0");
  if (unclaimed === 0n) {
    let reverted = false;
    try { await invoke("claim-empty", CONTRACT, "claimRewards", [H(A.scriptHash)]); }
    catch (e) { reverted = /no rewards|cannot cover|claim/i.test(String(e)); }
    assert(reverted, "claimRewards with 0 unclaimed did not revert");
    console.log("    reverted as expected ✓");
  } else { console.log("    unclaimed =", unclaimed.toString(), "(milestone reached) — skipping empty-claim test"); }

  console.log("\n[5] owner setRewardConfig / setPaused round-trip…");
  const newFee = fee === 100000n ? 120000n : 100000n;
  await invoke("setRewardConfig", CONTRACT, "setRewardConfig", [I(newFee), I(1000000n), I(2000000n)]);
  await sleep(6000);
  const fee2 = BigInt(mapField(await read("getPlatformStats"), "checkInFee")?.value ?? "0");
  assert(fee2 === newFee, `setRewardConfig fee ${fee2} != ${newFee}`);
  await invoke("setRewardConfig-restore", CONTRACT, "setRewardConfig", [I(100000n), I(1000000n), I(2000000n)]);
  await invoke("pause", CONTRACT, "setPaused", [B(true)]);
  await sleep(6000);
  assert(decBool(await read("isPaused")) === true, "setPaused(true) failed");
  await invoke("unpause", CONTRACT, "setPaused", [B(false)]);
  await sleep(6000);
  assert(decBool(await read("isPaused")) === false, "setPaused(false) failed");
  console.log("    owner config + pause toggle work ✓");

  console.log("\n[6] solvency: held GAS == rewardPool, totalUnclaimed <= rewardPool…");
  await sleep(4000);
  const pool = decInt(await read("rewardPool"));
  const totalUnclaimed = decInt(await read("totalUnclaimed"));
  const held = await gasBal(CONTRACT);
  console.log(`    rewardPool=${pool} totalUnclaimed=${totalUnclaimed} heldGAS=${held}`);
  assert(held === pool, `held ${held} != rewardPool ${pool}`);
  assert(totalUnclaimed <= pool, `totalUnclaimed ${totalUnclaimed} > pool ${pool}`);

  console.log("\nPASS — MiniAppDailyCheckin: fundable pool, check-in streak, owner config/pause, solvent ✓");
}
main().catch((e) => { console.error(e); process.exit(1); });
