/**
 * Live testnet validation for MiniAppDiceGame (the dice-game miniapp standalone contract).
 *
 * Hash resolves from apps/dice-game/neo-manifest.json (testnet) or CONTRACT_OVERRIDE.
 *
 *   1. house funds bankroll (3 GAS, memo "miniapp-dice-game:fund")
 *   2. player deposits 1 GAS bet credit (memo "miniapp-dice-game:stake")
 *   3. 8 rolls of face=1 at 0.1 GAS — each win pays 5.70x atomically, each loss funds the house
 *   4. assert per-roll accounting (Rolled events), stats, bankroll math, EXACT solvency
 *      (held GAS == bankroll + outstanding credit; no strand, no over-pay)
 *   5. withdraw remaining credit and re-check solvency
 *
 * Asserts via the tx's own Rolled events (lag-free). Testnet-pinned; no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

// Resolve from the dice-game manifest (testnet) so the live-harness runner can
// invoke this without env wiring; CONTRACT_OVERRIDE wins for ad-hoc runs.
const CONTRACT =
  process.env.CONTRACT_OVERRIDE ||
  process.env.CONTRACT_OVERRIDE_DICE ||
  getManifestContractHash("dice-game", { network: "testnet" });
if (!CONTRACT) { console.error("set CONTRACT_OVERRIDE=0x<dice hash>"); process.exit(1); }
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const A = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_dicegame" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const P_H = (a) => ({ type: "Hash160", value: a });
const invoke = (label, scriptHash, op, args) => live.invokeAndConfirm({ label, account: A, scriptHash, operation: op, args });
// Rolls are GetRandom-driven: a win adds a payout transfer the fee-estimate
// test-invoke may have missed (it can roll a cheap loss). Buffer +2 GAS so the
// win path is always covered. The buffer is paid by the signer, not the contract.
const invokeRoll = (label, args) => live.invokeAndConfirm({ label, account: A, scriptHash: CONTRACT, operation: "roll", args, systemFeeBuffer: 200000000 });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const decInt = (s) => BigInt(s?.[0]?.value ?? "0");
const gasBal = (h) => live.nep17BalanceOf(GAS, h);
function ev(log, name) { for (const n of log?.executions?.[0]?.notifications ?? []) if (n.eventname === name) return n.state?.value ?? []; return null; }

function assert(cond, msg) { if (!cond) { console.error("ASSERT FAILED:", msg); process.exit(1); } }

async function main() {
  console.log("contract:", CONTRACT, "\nplayer/house:", A.address);
  const FUND = 300000000n, DEPOSIT = 100000000n, BET = 10000000n, ROLLS = 8;

  const bankroll0 = decInt(await read("bankroll"));
  console.log("\n[1] fund bankroll 3 GAS (memo miniapp-dice-game:fund)…");
  await invoke("fund", GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(FUND), S("miniapp-dice-game:fund")]);
  await sleep(6000);
  const bankroll1 = decInt(await read("bankroll"));
  assert(bankroll1 === bankroll0 + FUND, `bankroll after fund ${bankroll1} != ${bankroll0 + FUND}`);
  console.log("    bankroll =", bankroll1.toString());

  console.log("\n[2] deposit 1 GAS bet credit (memo miniapp-dice-game:stake)…");
  await invoke("deposit", GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(DEPOSIT), S("miniapp-dice-game:stake")]);
  await sleep(6000);
  const credit0 = decInt(await read("creditOf", [P_H(A.scriptHash)]));
  console.log("    creditOf =", credit0.toString());
  assert(credit0 >= DEPOSIT, "credit not recorded");

  console.log("\n[3] 8 rolls of face=1 at 0.1 GAS…");
  let wins = 0n, losses = 0n, sumPayout = 0n;
  for (let i = 0; i < ROLLS; i++) {
    const { log } = await invokeRoll(`roll${i + 1}`, [H(A.scriptHash), I(1), I(BET)]);
    const e = ev(log, "Rolled"); // (gameId, player, face, rolled, won, payout)
    assert(e, `roll${i + 1} emitted no Rolled event`);
    const rolled = BigInt(e[3].value), won = e[4].value === true || e[4].value === 1 || e[4].value === "1", payout = BigInt(e[5].value);
    if (won) { wins++; sumPayout += payout; assert(rolled === 1n, "won but rolled!=face"); assert(payout === BET * 57n / 10n, `payout ${payout} != 5.7x`); }
    else { losses++; assert(rolled !== 1n, "lost but rolled==face"); assert(payout === 0n, "lost but payout>0"); }
    console.log(`    roll${i + 1}: rolled=${rolled} ${won ? "WON " + (Number(payout) / 1e8).toFixed(2) + " GAS" : "lost"}`);
  }
  console.log(`    wins=${wins} losses=${losses} sumPayout=${(Number(sumPayout) / 1e8).toFixed(2)} GAS`);

  console.log("\n[4] solvency invariants…");
  await sleep(6000);
  const bankroll = decInt(await read("bankroll"));
  const credit = decInt(await read("creditOf", [P_H(A.scriptHash)]));
  const held = await gasBal(CONTRACT);
  // held GAS must equal bankroll + outstanding credit (no strand, no overpay)
  console.log(`    bankroll=${bankroll} credit=${credit} heldGAS=${held}`);
  assert(held === bankroll + credit, `NOT solvent: held ${held} != bankroll+credit ${bankroll + credit}`);
  // expected bankroll = bankroll1 + losses*BET - wins*(payout-bet)
  const expectedBankroll = bankroll1 + losses * BET - wins * (BET * 57n / 10n - BET);
  assert(bankroll === expectedBankroll, `bankroll math ${bankroll} != ${expectedBankroll}`);

  console.log("\n[5] withdraw remaining credit…");
  if (credit > 0n) {
    await invoke("withdraw", CONTRACT, "withdraw", [H(A.scriptHash)]);
    await sleep(6000);
    const creditAfter = decInt(await read("creditOf", [P_H(A.scriptHash)]));
    const bankrollAfter = decInt(await read("bankroll"));
    const heldAfter = await gasBal(CONTRACT);
    assert(creditAfter === 0n, `credit not refunded: ${creditAfter}`);
    assert(heldAfter === bankrollAfter, `after withdraw not solvent: held ${heldAfter} != bankroll ${bankrollAfter}`);
    console.log("    credit refunded; held==bankroll ✓");
  }

  console.log("\nPASS — MiniAppDiceGame atomic rolls, 5.70x payouts, exactly solvent, withdrawable credit ✓");
}
main().catch((e) => { console.error(e); process.exit(1); });
