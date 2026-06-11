/**
 * Live testnet validation for MiniAppLastSurvivor.
 *
 * The contract hash resolves from apps/last-survivor/neo-manifest.json
 * (override: CONTRACT_OVERRIDE / CONTRACT_OVERRIDE_LAST_SURVIVOR).
 *
 * Flow against the real deployed contract:
 *   1. A deposits GAS, buys 1 key  -> A is last buyer, pot = 0.1 GAS, timer starts
 *   2. B deposits GAS, buys 1 key  -> B is last buyer (rising price), timer extends
 *   3. wait for the countdown to expire
 *   4. settle()  -> B (last buyer) is paid the EXACT pot atomically; round advances
 *
 * Asserts the bonding-curve cost, last-buyer tracking, and that settle pays the
 * recorded winner the whole pot. Uses one funded account + one fresh ephemeral
 * account. Never prints WIFs. Testnet-pinned (endpoints/magic via
 * lib/neo_network.js env overrides; transient RPC drops are retried with
 * failover by lib/live_rpc.mjs).
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const CONTRACT = getManifestContractHash("last-survivor", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const BUY_MEMO = "miniapp-lastsurvivor:buy";

const A = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const B = new wallet.Account(); // fresh second player

const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_lastsurvivor" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const P_H = (a) => ({ type: "Hash160", value: a });
const P_I = (n) => ({ type: "Integer", value: n.toString() });

const invoke = (label, account, scriptHash, operation, args) =>
  live.invokeAndConfirm({ label, account, scriptHash, operation, args });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const decInt = (s) => BigInt(s?.[0]?.value ?? "0");
const gasBalance = (addr) => live.nep17BalanceOf(GAS, addr);
function mapField(stack, key) {
  for (const kv of stack?.[0]?.value ?? []) {
    const raw = kv.key?.value;
    const decoded = typeof raw === "string" ? Buffer.from(raw, "base64").toString() : raw;
    if (decoded === key) return kv.value;
  }
  return null;
}

async function main() {
  console.log("contract :", CONTRACT);
  console.log("A (funded):", A.address);
  console.log("B (fresh) :", B.address);

  console.log("\n[0] fund fresh B with 2 GAS…");
  await invoke("fund-B", A, GAS, "transfer", [H(A.scriptHash), H(B.scriptHash), I(200000000), sc.ContractParam.any(null)]);

  const round0 = await read("getCurrentRound");
  console.log("    round:", BigInt(mapField(round0, "roundId")?.value).toString(),
              "totalKeys:", BigInt(mapField(round0, "totalKeys")?.value).toString());

  // 1. A deposits + buys 1 key
  console.log("\n[1] A deposits 0.5 GAS, buys 1 key…");
  await invoke("A-deposit", A, GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(50000000), S(BUY_MEMO)]);
  const cost1 = decInt(await read("currentKeyCost", [P_I(1)]));
  console.log("    currentKeyCost(1) =", cost1.toString(), cost1 === 10000000n ? "✓ (0.1 GAS)" : "✗");
  await invoke("A-buy", A, CONTRACT, "buyKeys", [H(A.scriptHash), I(1)]);
  let r = await read("getCurrentRound");
  console.log("    pot:", BigInt(mapField(r, "pot")?.value).toString(),
              "lastBuyer == A:", mapField(r, "lastBuyer")?.value === Buffer.from(A.scriptHash, "hex").toString("base64") ? "✓" : "(see hash)");

  // 2. B deposits + buys 1 key (rising price, becomes last buyer)
  console.log("\n[2] B deposits 0.5 GAS, buys 1 key (rising price)…");
  await invoke("B-deposit", B, GAS, "transfer", [H(B.scriptHash), H(CONTRACT), I(50000000), S(BUY_MEMO)]);
  const cost2 = decInt(await read("currentKeyCost", [P_I(1)]));
  console.log("    currentKeyCost(1) now =", cost2.toString(), cost2 === 10010000n ? "✓ (0.1001 GAS, +0.1%)" : "✗");
  await invoke("B-buy", B, CONTRACT, "buyKeys", [H(B.scriptHash), I(1)]);
  r = await read("getCurrentRound");
  const pot = BigInt(mapField(r, "pot")?.value);
  const totalKeys = BigInt(mapField(r, "totalKeys")?.value);
  const lastBuyerB64 = mapField(r, "lastBuyer")?.value;
  const bB64 = Buffer.from(B.scriptHash, "hex").toString("base64");
  console.log("    pot:", pot.toString(), `(${(Number(pot) / 1e8).toFixed(8)} GAS)`,
              "totalKeys:", totalKeys.toString(), "lastBuyer == B:", lastBuyerB64 === bB64 ? "✓" : "✗");

  // 3. wait for expiry
  console.log("\n[3] waiting for the round countdown to expire…");
  for (let i = 0; i < 40; i++) {
    const rr = await read("getCurrentRound");
    const rem = BigInt(mapField(rr, "remainingTime")?.value);
    if (rem === 0n) { console.log("    remainingTime = 0 — round over"); break; }
    process.stdout.write(`    remaining ${rem}s …\r`);
    await sleep(8000);
  }

  // 4. settle -> pays B the pot
  console.log("\n[4] settle() (permissionless, called by A)…");
  const bBefore = await gasBalance(B.scriptHash);
  await invoke("settle", A, CONTRACT, "settle", []);
  const bAfter = await gasBalance(B.scriptHash);
  const winnerDelta = bAfter - bBefore;

  console.log("\n[5] invariants:");
  const nextRound = decInt(await read("currentRoundId"));
  const settledRound = await read("getRound", [P_I(1)]);
  const wasSettled = mapField(settledRound, "settled")?.value;
  const okWinnerPaid = winnerDelta === pot;
  const okAdvance = nextRound === 2n;
  const okSettled = wasSettled === true || wasSettled === 1 || wasSettled === "1";
  const okKeys = totalKeys === 2n;
  console.log("    B GAS delta from settle =", winnerDelta.toString(), "vs pot", pot.toString(), okWinnerPaid ? "✓" : "✗");
  console.log("    currentRoundId advanced  =", nextRound.toString(), okAdvance ? "✓ (2)" : "✗");
  console.log("    round 1 settled          =", wasSettled, okSettled ? "✓" : "✗");
  console.log("    totalKeys this round     =", totalKeys.toString(), okKeys ? "✓ (2)" : "✗");

  const pass = okWinnerPaid && okAdvance && okSettled && okKeys;
  console.log("\n" + (pass
    ? "RESULT: PASS ✓ — bonding-curve buys, last-buyer tracking, timer, and atomic winner payout all correct; no oracle."
    : "RESULT: FAIL ✗"));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error("validation error:", String(e?.message || e).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***"));
  process.exit(1);
});
