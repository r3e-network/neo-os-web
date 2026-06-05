/**
 * Live testnet validation for MiniAppCoinFlip (0x238488397884ad0bf1db99aecce62290e9f47971).
 *
 *   1. house funds bankroll (2 GAS, memo "miniapp-fogplay:fund")
 *   2. player deposits 0.5 GAS bet credit (memo "miniapp-fogplay:bet")
 *   3. 5 flips at 0.1 GAS each — each win pays 2x atomically, each loss funds the house
 *   4. assert per-flip accounting (Flipped events), stats, bankroll math, and that the
 *      contract is EXACTLY solvent (held GAS == bankroll; no strand, no over-pay)
 *
 * Asserts via the tx's own Flipped events (lag-free). Testnet-pinned; no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
const { sc, wallet, rpc, tx, u } = pkg;

const RPC = "https://testnet1.neo.coz.io:443";
const MAGIC = 894710606;
const CONTRACT = "0x238488397884ad0bf1db99aecce62290e9f47971";
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const A = new wallet.Account(process.env.NEO_TESTNET_WIF);
const client = new rpc.RPCClient(RPC);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retry = async (fn) => { for (let i = 0; i < 6; i++) { try { return await fn(); } catch (e) { if (i === 5) throw e; await sleep(3000); } } };
const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const P_H = (a) => ({ type: "Hash160", value: a });

async function invoke(label, scriptHash, op, args) {
  const script = sc.createScript({ scriptHash, operation: op, args });
  const count = await retry(() => client.getBlockCount());
  const signers = [tx.Signer.fromJson({ account: "0x" + A.scriptHash, scopes: "CalledByEntry" })];
  const txn = new tx.Transaction({ signers, validUntilBlock: count + 50, script });
  const inv = await retry(() => client.invokeScript(u.HexString.fromHex(script), signers));
  if (inv.state !== "HALT") throw new Error(`${label} test FAULT: ${inv.exception}`);
  txn.systemFee = u.BigInteger.fromNumber(inv.gasconsumed);
  txn.sign(A, MAGIC);
  txn.networkFee = u.BigInteger.fromNumber(await retry(() => client.calculateNetworkFee(txn)));
  txn.sign(A, MAGIC);
  const txid = await retry(() => client.sendRawTransaction(txn));
  for (let i = 0; i < 45; i++) {
    await sleep(4000);
    let log; try { log = await client.getApplicationLog(txid); } catch { continue; }
    const ex = log.executions?.[0];
    if (ex?.vmstate === "HALT") { console.log(`  ${label} ✓`); return { txid, log }; }
    throw new Error(`${label} FAULT: ${JSON.stringify(ex?.exception)}`);
  }
  throw new Error(`${label} not confirmed`);
}
async function read(method, params = []) {
  const res = await retry(() => client.invokeFunction(CONTRACT, method, params));
  if (res.state !== "HALT") throw new Error(`${method} FAULT`);
  return res.stack;
}
const decInt = (s) => BigInt(s?.[0]?.value ?? "0");
async function gasBal(h) { const r = await retry(() => client.invokeFunction(GAS, "balanceOf", [P_H(h)])); return BigInt(r.stack?.[0]?.value ?? "0"); }
function ev(log, name) { for (const n of log?.executions?.[0]?.notifications ?? []) if (n.eventname === name) return n.state?.value ?? []; return null; }
function mapField(stack, key) { for (const kv of stack?.[0]?.value ?? []) { const raw = kv.key?.value; const d = typeof raw === "string" ? Buffer.from(raw, "base64").toString() : raw; if (d === key) return kv.value; } return null; }

async function main() {
  console.log("contract:", CONTRACT, "\nplayer/house:", A.address);
  const FUND = 200000000n, DEPOSIT = 50000000n, BET = 10000000n, FLIPS = 5;

  console.log("\n[1] fund bankroll 2 GAS…");
  await invoke("fund", GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(FUND), S("miniapp-fogplay:fund")]);
  console.log("    bankroll =", decInt(await read("bankroll")).toString(), "(expect 200000000)");

  console.log("\n[2] deposit 0.5 GAS bet credit…");
  await invoke("deposit", GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(DEPOSIT), S("miniapp-fogplay:bet")]);
  console.log("    creditOf =", decInt(await read("creditOf", [P_H(A.scriptHash)])).toString());

  console.log("\n[3] 5 flips at 0.1 GAS (choice=heads/0)…");
  let wins = 0n, losses = 0n, sumPayout = 0n;
  for (let i = 0; i < FLIPS; i++) {
    const { log } = await invoke(`flip${i + 1}`, CONTRACT, "flip", [H(A.scriptHash), I(0), I(BET)]);
    const e = ev(log, "Flipped"); // (gameId, player, choice, outcome, won, payout)
    const outcome = BigInt(e[3].value), won = e[4].value === true || e[4].value === 1 || e[4].value === "1", payout = BigInt(e[5].value);
    if (won) { wins++; sumPayout += payout; } else losses++;
    console.log(`    flip${i + 1}: outcome=${outcome} ${won ? "WON " + (Number(payout) / 1e8).toFixed(2) + " GAS" : "lost"}`);
  }

  console.log("\n[4] invariants:");
  await sleep(6000);
  const bankroll = decInt(await read("bankroll"));
  const held = await gasBal("0x" + CONTRACT.slice(2));
  const stats = await read("getStats", [P_H(A.scriptHash)]);
  const sWins = BigInt(mapField(stats, "wins")?.value), sLosses = BigInt(mapField(stats, "losses")?.value);
  // each win pays an extra BET from bankroll; each loss adds BET to bankroll
  const expectBankroll = FUND + (losses - wins) * BET;
  // contract received FUND + DEPOSIT, paid sumPayout, consumed all 5*BET credit
  const expectHeld = FUND + DEPOSIT - sumPayout;
  const okBankroll = bankroll === expectBankroll;
  const okSolvent = held === bankroll;            // all credit consumed -> held == bankroll
  const okHeld = held === expectHeld;
  const okStats = sWins === wins && sLosses === losses;
  const okCount = (wins + losses) === BigInt(FLIPS);
  console.log("    wins/losses (events)   =", wins.toString(), "/", losses.toString());
  console.log("    bankroll               =", bankroll.toString(), "expect", expectBankroll.toString(), okBankroll ? "✓" : "✗");
  console.log("    contract held GAS      =", held.toString(), "== bankroll", okSolvent ? "✓ (exactly solvent)" : "✗", "| == expect", okHeld ? "✓" : "✗");
  console.log("    on-chain stats         = wins", sWins.toString(), "losses", sLosses.toString(), okStats ? "✓" : "✗");
  console.log("    games counted          =", (wins + losses).toString(), okCount ? "✓ (5)" : "✗");

  const pass = okBankroll && okSolvent && okHeld && okStats && okCount;
  console.log("\n" + (pass
    ? "RESULT: PASS ✓ — coin flips settled on-chain via GetRandom; wins paid 2x, losses funded the house; contract exactly solvent; no oracle."
    : "RESULT: FAIL ✗"));
  if (!pass) process.exit(1);
}
main().catch((e) => { console.error("error:", String(e?.message || e).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***")); process.exit(1); });
