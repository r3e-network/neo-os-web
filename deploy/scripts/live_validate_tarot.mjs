/**
 * Live testnet validation for MiniAppTarot (0x8cd0342f2129c07b2d3de1dae51ba09e4045d331).
 *
 *   1. A deposits 0.2 GAS (memo "miniapp-tarot:draw")
 *   2. draw() -> three DISTINCT cards in [0,78) drawn on-chain (Runtime.GetRandom)
 *   3. draw() again -> a different reading, fee consumed each time, revenue accrues
 *
 * Asserts on the ReadingDrawn event (lag-free) + getReading + credit/revenue.
 * Testnet-pinned; no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
const { sc, wallet, rpc, tx, u } = pkg;

const RPC = "https://testnet1.neo.coz.io:443";
const MAGIC = 894710606;
const CONTRACT = "0x8cd0342f2129c07b2d3de1dae51ba09e4045d331";
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const A = new wallet.Account(process.env.NEO_TESTNET_WIF);
const client = new rpc.RPCClient(RPC);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retry = async (fn) => { for (let i = 0; i < 6; i++) { try { return await fn(); } catch (e) { if (i === 5) throw e; await sleep(3000); } } };
const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const P_H = (a) => ({ type: "Hash160", value: a });
const P_I = (n) => ({ type: "Integer", value: n.toString() });

async function invoke(label, account, scriptHash, operation, args) {
  const script = sc.createScript({ scriptHash, operation, args });
  const count = await retry(() => client.getBlockCount());
  const signers = [tx.Signer.fromJson({ account: "0x" + account.scriptHash, scopes: "CalledByEntry" })];
  const txn = new tx.Transaction({ signers, validUntilBlock: count + 50, script });
  const inv = await retry(() => client.invokeScript(u.HexString.fromHex(script), signers));
  if (inv.state !== "HALT") throw new Error(`${label} test-invoke FAULT: ${inv.exception}`);
  txn.systemFee = u.BigInteger.fromNumber(inv.gasconsumed);
  txn.sign(account, MAGIC);
  txn.networkFee = u.BigInteger.fromNumber(await retry(() => client.calculateNetworkFee(txn)));
  txn.sign(account, MAGIC);
  const txid = await retry(() => client.sendRawTransaction(txn));
  for (let i = 0; i < 45; i++) {
    await sleep(4000);
    let log; try { log = await client.getApplicationLog(txid); } catch { continue; }
    const ex = log.executions?.[0];
    if (ex?.vmstate === "HALT") { console.log(`  ${label} ✓ (${txid.slice(0, 12)}…)`); return { txid, log }; }
    throw new Error(`${label} FAULT: ${JSON.stringify(ex?.exception)}`);
  }
  throw new Error(`${label} not confirmed`);
}
async function read(method, params = []) {
  const res = await retry(() => client.invokeFunction(CONTRACT, method, params));
  if (res.state !== "HALT") throw new Error(`${method} FAULT: ${res.exception}`);
  return res.stack;
}
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
