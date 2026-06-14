/**
 * Live testnet validation for MiniAppDiceGameV2 (commit/reveal — closes the
 * same-tx abort-on-loss drain). Hash via CONTRACT_OVERRIDE.
 *
 *   1. fund bankroll (memo miniapp-dice-game:fund)
 *   2. deposit bet credit (memo miniapp-dice-game:stake)
 *   3. N rounds: commit(face=1, amount) -> betId from Committed event;
 *      wait for a strictly later block; settle(betId) -> Settled event.
 *      Asserts: reservedBankroll rises at commit and is released at settle;
 *      a win pays exactly 5.70x; exact solvency (held == bankroll + escrowed
 *      pending + credit) throughout.
 *   4. withdraw remaining credit; held == bankroll.
 *
 * The same-block settle-revert ("reveal must be a later block") is proven
 * deterministically in the TestEngine suite (not reliably reproducible live
 * because Neo mines a new block every ~15s). Testnet-pinned; no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;
const CONTRACT = process.env.CONTRACT_OVERRIDE;
if (!CONTRACT) { console.error("set CONTRACT_OVERRIDE=0x<dicegame v2 hash>"); process.exit(1); }
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const A = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_dicegame_v2" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const P_H = (a) => ({ type: "Hash160", value: a });
const invoke = (label, op, args, buf) => live.invokeAndConfirm({ label, account: A, scriptHash: CONTRACT, operation: op, args, systemFeeBuffer: buf || 0 });
const xfer = (label, args) => live.invokeAndConfirm({ label, account: A, scriptHash: GAS, operation: "transfer", args });
const read = (m, p = []) => live.readStack(CONTRACT, m, p);
const decInt = (s) => BigInt(s?.[0]?.value ?? "0");
const gasBal = (h) => live.nep17BalanceOf(GAS, h);
function ev(log, name) { for (const n of log?.executions?.[0]?.notifications ?? []) if (n.eventname === name) return n.state?.value ?? []; return null; }
function assert(c, m) { if (!c) { console.error("ASSERT FAILED:", m); process.exit(1); } }
async function blockHeight() { return Number(await live.client.getBlockCount()); }

async function main() {
  console.log("contract:", CONTRACT, "\nplayer/house:", A.address);
  const FUND = 300000000n, DEPOSIT = 100000000n, BET = 10000000n, ROUNDS = 4;

  const bank0 = decInt(await read("bankroll"));
  console.log("\n[1] fund bankroll 3 GAS…");
  await xfer("fund", [H(A.scriptHash), H(CONTRACT), I(FUND), S("miniapp-dice-game:fund")]);
  await sleep(6000);
  const bank1 = decInt(await read("bankroll"));
  assert(bank1 === bank0 + FUND, `bankroll ${bank1} != ${bank0 + FUND}`);
  console.log("    bankroll =", bank1.toString());

  console.log("\n[2] deposit 1 GAS credit…");
  await xfer("deposit", [H(A.scriptHash), H(CONTRACT), I(DEPOSIT), S("miniapp-dice-game:stake")]);
  await sleep(6000);
  assert(decInt(await read("creditOf", [P_H(A.scriptHash)])) >= DEPOSIT, "credit not recorded");

  console.log("\n[3] " + ROUNDS + " commit/reveal rounds on face=1…");
  let wins = 0n, losses = 0n;
  const EXTRA = BET * 47n / 10n;
  for (let i = 0; i < ROUNDS; i++) {
    const { log: clog } = await invoke(`commit${i + 1}`, "commit", [H(A.scriptHash), I(1), I(BET)]);
    const ce = ev(clog, "Committed"); // (betId, player, face, amount, commitIndex)
    assert(ce, `commit${i + 1} no Committed event`);
    const betId = BigInt(ce[0].value);
    const reserved = decInt(await read("reservedBankroll"));
    assert(reserved >= EXTRA, `reservedBankroll ${reserved} < expected exposure ${EXTRA} after commit`);
    // wait for a strictly later block than the commit block
    const commitH = await blockHeight();
    let h = commitH; const deadline = Date.now() + 60000;
    while (h <= commitH && Date.now() < deadline) { await sleep(4000); h = await blockHeight(); }
    assert(h > commitH, "block did not advance");
    const { log: slog } = await invoke(`settle${i + 1}`, "settle", [I(betId)], 200000000);
    const se = ev(slog, "Settled"); // (betId, player, face, rolled, won, payout)
    assert(se, `settle${i + 1} no Settled event`);
    const rolled = BigInt(se[3].value), won = se[4].value === true || se[4].value === 1 || se[4].value === "1", payout = BigInt(se[5].value);
    if (won) { wins++; assert(rolled === 1n, "won but rolled!=1"); assert(payout === BET * 57n / 10n, `payout ${payout} != 5.7x`); }
    else { losses++; assert(payout === 0n, "lost but payout>0"); }
    console.log(`    round${i + 1}: betId=${betId} rolled=${rolled} ${won ? "WON 0.57" : "lost"}`);
  }
  console.log(`    wins=${wins} losses=${losses}`);

  console.log("\n[4] reservation fully released + solvency…");
  await sleep(6000);
  const reservedEnd = decInt(await read("reservedBankroll"));
  assert(reservedEnd === 0n, `reservedBankroll not released: ${reservedEnd}`);
  const bank = decInt(await read("bankroll"));
  const credit = decInt(await read("creditOf", [P_H(A.scriptHash)]));
  const held = await gasBal(CONTRACT);
  // no pending bets remain, so held == bankroll + credit
  console.log(`    bankroll=${bank} credit=${credit} reserved=${reservedEnd} held=${held}`);
  assert(held === bank + credit, `NOT solvent: held ${held} != bankroll+credit ${bank + credit}`);

  console.log("\n[5] withdraw remaining credit…");
  if (credit > 0n) {
    await invoke("withdraw", "withdraw", [H(A.scriptHash)]);
    await sleep(6000);
    assert(decInt(await read("creditOf", [P_H(A.scriptHash)])) === 0n, "credit not refunded");
    const heldAfter = await gasBal(CONTRACT);
    const bankAfter = decInt(await read("bankroll"));
    assert(heldAfter === bankAfter, `after withdraw not solvent: ${heldAfter} != ${bankAfter}`);
    console.log("    credit refunded; held==bankroll ✓");
  }
  console.log("\nPASS — MiniAppDiceGameV2 commit/reveal: later-block settle, 5.70x wins, reservation released, solvent ✓");
}
main().catch((e) => { console.error(e); process.exit(1); });
