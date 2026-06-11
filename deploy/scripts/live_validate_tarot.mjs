/**
 * Live testnet validation for MiniAppTarot.
 *
 * The contract hash resolves from apps/on-chain-tarot/neo-manifest.json
 * (override: CONTRACT_OVERRIDE / CONTRACT_OVERRIDE_ON_CHAIN_TAROT).
 *
 *   1. A deposits 0.2 GAS (memo "miniapp-tarot:draw")
 *   2. draw() -> three DISTINCT cards in [0,78) drawn on-chain (Runtime.GetRandom)
 *   3. draw() again -> a different reading, fee consumed each time, revenue accrues
 *
 * Asserts on the ReadingDrawn event (lag-free) + getReading + credit/revenue.
 * Testnet-pinned (endpoints/magic via lib/neo_network.js env overrides); no
 * WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const CONTRACT = getManifestContractHash("on-chain-tarot", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const A = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));

const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_tarot" });
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
function eventState(log, name) {
  for (const n of log?.executions?.[0]?.notifications ?? []) if (n.eventname === name) return n.state?.value ?? [];
  return null;
}
function cardsFromEvent(ev) { return [BigInt(ev[2].value), BigInt(ev[3].value), BigInt(ev[4].value)]; }
const distinctInDeck = (c) => c.every((x) => x >= 0n && x < 78n) && new Set(c.map(String)).size === 3;

async function main() {
  console.log("contract :", CONTRACT, "\nplayer A :", A.address);

  console.log("\n[1] deposit 0.2 GAS (memo draw)…");
  await invoke("deposit", A, GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(20000000), S("miniapp-tarot:draw")]);
  console.log("    creditOf(A) =", decInt(await read("creditOf", [P_H(A.scriptHash)])).toString(), "(expect 20000000)");

  console.log("\n[2] draw #1…");
  const { log: d1 } = await invoke("draw1", A, CONTRACT, "draw", [H(A.scriptHash)]);
  const ev1 = eventState(d1, "ReadingDrawn");
  const id1 = BigInt(ev1[0].value), cards1 = cardsFromEvent(ev1);
  console.log("    reading", id1.toString(), "cards:", cards1.map(String), distinctInDeck(cards1) ? "✓ (3 distinct, 0..77)" : "✗");
  const getR = await read("getReading", [P_I(id1)]);
  // getReading.cards is an array under map key "cards"
  let stored = null;
  for (const kv of getR[0].value) { const k = Buffer.from(kv.key.value, "base64").toString(); if (k === "cards") stored = kv.value.value.map((x) => BigInt(x.value)); }
  const storedOk = stored && stored.length === 3 && stored.every((x, i) => x === cards1[i]);
  console.log("    getReading.cards match event:", storedOk ? "✓" : "✗", stored?.map(String));

  console.log("\n[3] draw #2 (should differ, fee consumed)…");
  const { log: d2 } = await invoke("draw2", A, CONTRACT, "draw", [H(A.scriptHash)]);
  const ev2 = eventState(d2, "ReadingDrawn");
  const cards2 = cardsFromEvent(ev2);
  console.log("    cards:", cards2.map(String), distinctInDeck(cards2) ? "✓" : "✗");
  await sleep(6000);
  const creditAfter = decInt(await read("creditOf", [P_H(A.scriptHash)]));
  const revenue = decInt(await read("revenue"));
  const readingsCount = decInt(await read("readingsCount"));

  console.log("\n[4] invariants:");
  const okDistinct1 = distinctInDeck(cards1), okDistinct2 = distinctInDeck(cards2);
  const okStored = !!storedOk;
  const okCredit = creditAfter === 0n; // 0.2 deposited - 2*0.1 draws
  const okRevenue = revenue >= 20000000n; // >= 0.2 (this run's two draws; may include prior runs)
  console.log("    draw1 distinct/in-deck =", okDistinct1 ? "✓" : "✗");
  console.log("    draw2 distinct/in-deck =", okDistinct2 ? "✓" : "✗");
  console.log("    stored == event        =", okStored ? "✓" : "✗");
  console.log("    credit after 2 draws   =", creditAfter.toString(), okCredit ? "✓ (0)" : "✗");
  console.log("    revenue (>= 0.2 GAS)   =", revenue.toString(), okRevenue ? "✓" : "✗");
  console.log("    readingsCount          =", readingsCount.toString());

  const pass = okDistinct1 && okDistinct2 && okStored && okCredit && okRevenue;
  console.log("\n" + (pass
    ? "RESULT: PASS ✓ — fee consumed, three distinct cards drawn on-chain via GetRandom and stored; revenue accrues; no oracle."
    : "RESULT: FAIL ✗"));
  if (!pass) process.exit(1);
}
main().catch((e) => { console.error("error:", String(e?.message || e).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***")); process.exit(1); });
