/**
 * Live testnet validation for MiniAppCoinFlipV2 (FogPlay commit/reveal).
 *
 * 1. Fund the house bankroll with the required `miniapp-fogplay:fund` memo.
 * 2. Prepay reusable player credit with `miniapp-fogplay:bet`.
 * 3. Commit each choice, wait for the complete 3-block beacon window, settle,
 *    and verify the exact Committed/Settled event identity and 2x payout.
 * 4. Prove reservation release, state/accounting deltas, and credit withdrawal.
 *
 * Testnet only. Credentials are read from NEO_TESTNET_WIF and never printed.
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const CONTRACT = getManifestContractHash("fogplay", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const BEACON_BLOCKS = 3;
const account = new wallet.Account(
  requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF),
);
const live = createLiveRpc({
  network: "testnet",
  neon: pkg,
  label: "live_validate_coinflip_v2",
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const H = (value) => sc.ContractParam.hash160(value);
const I = (value) => sc.ContractParam.integer(value.toString());
const S = (value) => sc.ContractParam.string(value);
const P_H = (value) => ({ type: "Hash160", value });
const invoke = (label, operation, args, systemFeeBuffer = 0) =>
  live.invokeAndConfirm({
    label,
    account,
    scriptHash: CONTRACT,
    operation,
    args,
    systemFeeBuffer,
  });
const transfer = (label, amount, memo) =>
  live.invokeAndConfirm({
    label,
    account,
    scriptHash: GAS,
    operation: "transfer",
    args: [H(account.scriptHash), H(CONTRACT), I(amount), S(memo)],
  });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const integer = (stack) => BigInt(stack?.[0]?.value ?? "0");

function event(log, name) {
  for (const notification of log?.executions?.[0]?.notifications ?? []) {
    if (notification.eventname === name) return notification.state?.value ?? [];
  }
  return null;
}

function mapField(stack, key) {
  for (const entry of stack?.[0]?.value ?? []) {
    const raw = entry.key?.value;
    const decoded = typeof raw === "string"
      ? Buffer.from(raw, "base64").toString()
      : raw;
    if (decoded === key) return entry.value;
  }
  return null;
}

function hash160Value(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^[0-9a-f]{40}$/i.test(raw.replace(/^0x/, ""))) {
    return raw.replace(/^0x/, "").toLowerCase();
  }
  try {
    const bytes = Buffer.from(raw, "base64");
    if (bytes.length !== 20) return "";
    return [...bytes]
      .reverse()
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

async function currentIndex() {
  return Number(await live.client.getBlockCount()) - 1;
}

async function waitForBeacon(commitIndex) {
  const requiredIndex = commitIndex + BEACON_BLOCKS + 1;
  const deadline = Date.now() + 110_000;
  let index = await currentIndex();
  while (index < requiredIndex && Date.now() < deadline) {
    await sleep(4_000);
    index = await currentIndex();
  }
  assert(index >= requiredIndex, `beacon window did not complete (${index} < ${requiredIndex})`);
}

async function waitForInteger(method, params, predicate, label) {
  const deadline = Date.now() + 35_000;
  let value = integer(await read(method, params));
  while (!predicate(value) && Date.now() < deadline) {
    await sleep(2_500);
    value = integer(await read(method, params));
  }
  assert(predicate(value), `${label}: observed ${value}`);
  return value;
}

async function waitForBalance(predicate, label) {
  const deadline = Date.now() + 35_000;
  let value = await live.nep17BalanceOf(GAS, CONTRACT);
  while (!predicate(value) && Date.now() < deadline) {
    await sleep(2_500);
    value = await live.nep17BalanceOf(GAS, CONTRACT);
  }
  assert(predicate(value), `${label}: observed ${value}`);
  return value;
}

async function main() {
  console.log("contract:", CONTRACT, "\nplayer/house:", account.address);

  const FUND = 200_000_000n;
  const DEPOSIT = 300_000_000n;
  const BET = 100_000_000n;
  const ROUNDS = 2;

  const bank0 = integer(await read("bankroll"));
  const credit0 = integer(await read("creditOf", [P_H(account.scriptHash)]));
  const held0 = await live.nep17BalanceOf(GAS, CONTRACT);
  const pending0 = integer(await read("pendingBetCount"));
  const stats0 = await read("getStats", [P_H(account.scriptHash)]);
  const wins0 = BigInt(mapField(stats0, "wins")?.value ?? "0");
  const losses0 = BigInt(mapField(stats0, "losses")?.value ?? "0");

  console.log("\n[1] fund bankroll 2 GAS...");
  const { log: fundLog } = await transfer(
    "fund",
    FUND,
    "miniapp-fogplay:fund",
  );
  assert(event(fundLog, "BankrollFunded"), "BankrollFunded event missing");
  await waitForInteger(
    "bankroll",
    [],
    (value) => value === bank0 + FUND,
    `bankroll did not reach ${bank0 + FUND}`,
  );

  console.log("\n[2] deposit 3 GAS reusable wager credit...");
  const { log: depositLog } = await transfer(
    "deposit",
    DEPOSIT,
    "miniapp-fogplay:bet",
  );
  assert(event(depositLog, "Credited"), "Credited event missing");
  await waitForInteger(
    "creditOf",
    [P_H(account.scriptHash)],
    (value) => value === credit0 + DEPOSIT,
    `credit did not reach ${credit0 + DEPOSIT}`,
  );

  console.log(`\n[3] ${ROUNDS} commit/reveal rounds at 1 GAS...`);
  let wins = 0n;
  let losses = 0n;
  let payoutTotal = 0n;
  for (let round = 0; round < ROUNDS; round += 1) {
    const choice = round % 2;
    const { log: commitLog } = await invoke(
      `commit${round + 1}`,
      "commit",
      [H(account.scriptHash), I(choice), I(BET)],
    );
    const committed = event(commitLog, "Committed");
    assert(committed, `commit${round + 1} missing Committed event`);
    const betId = BigInt(committed[0].value);
    const eventPlayer = hash160Value(committed[1].value);
    const eventChoice = BigInt(committed[2].value);
    const eventAmount = BigInt(committed[3].value);
    const commitIndex = Number(committed[4].value);
    assert(eventPlayer === account.scriptHash.toLowerCase(), "Committed player mismatch");
    assert(eventChoice === BigInt(choice), "Committed choice mismatch");
    assert(eventAmount === BET, "Committed amount mismatch");
    assert(
      integer(await read("reservedBankroll")) >= BET,
      "house exposure was not reserved",
    );

    await waitForBeacon(commitIndex);
    const { log: settleLog } = await invoke(
      `settle${round + 1}`,
      "settle",
      [I(betId)],
      200_000_000,
    );
    const settled = event(settleLog, "Settled");
    assert(settled, `settle${round + 1} missing Settled event`);
    assert(BigInt(settled[0].value) === betId, "Settled bet id mismatch");
    assert(hash160Value(settled[1].value) === eventPlayer, "Settled player mismatch");
    assert(BigInt(settled[2].value) === eventChoice, "Settled choice mismatch");
    const outcome = BigInt(settled[3].value);
    const won = settled[4].value === true || settled[4].value === 1 || settled[4].value === "1";
    const payout = BigInt(settled[5].value);
    assert(outcome === 0n || outcome === 1n, "outcome outside heads/tails range");
    if (won) {
      wins += 1n;
      payoutTotal += payout;
      assert(outcome === eventChoice, "win outcome does not match choice");
      assert(payout === BET * 2n, `2x payout mismatch: ${payout}`);
    } else {
      losses += 1n;
      assert(outcome !== eventChoice, "loss outcome unexpectedly matches choice");
      assert(payout === 0n, "loss paid a non-zero payout");
    }
    console.log(
      `    round${round + 1}: betId=${betId} choice=${choice} outcome=${outcome} ${won ? "WON 2.00" : "lost"}`,
    );
  }

  console.log("\n[4] accounting, stats, and reservation invariants...");
  const expectedBank = bank0 + FUND + (losses - wins) * BET;
  const expectedCredit = credit0 + DEPOSIT - BigInt(ROUNDS) * BET;
  const expectedHeld = held0 + FUND + DEPOSIT - payoutTotal;
  const bankEnd = await waitForInteger(
    "bankroll",
    [],
    (value) => value === expectedBank,
    `bankroll did not reach ${expectedBank}`,
  );
  const creditEnd = await waitForInteger(
    "creditOf",
    [P_H(account.scriptHash)],
    (value) => value === expectedCredit,
    `credit did not reach ${expectedCredit}`,
  );
  const heldEnd = await waitForBalance(
    (value) => value === expectedHeld,
    `held GAS did not reach ${expectedHeld}`,
  );
  const pendingEnd = await waitForInteger(
    "pendingBetCount",
    [],
    (value) => value === pending0,
    `pending count did not return to ${pending0}`,
  );
  const reservedEnd = await waitForInteger(
    "reservedBankroll",
    [],
    (value) => value === 0n,
    "reserved bankroll did not return to zero",
  );
  let statsEnd = await read("getStats", [P_H(account.scriptHash)]);
  let winsEnd = BigInt(mapField(statsEnd, "wins")?.value ?? "0");
  let lossesEnd = BigInt(mapField(statsEnd, "losses")?.value ?? "0");
  const statsDeadline = Date.now() + 35_000;
  while (
    (winsEnd - wins0 !== wins || lossesEnd - losses0 !== losses) &&
    Date.now() < statsDeadline
  ) {
    await sleep(2_500);
    statsEnd = await read("getStats", [P_H(account.scriptHash)]);
    winsEnd = BigInt(mapField(statsEnd, "wins")?.value ?? "0");
    lossesEnd = BigInt(mapField(statsEnd, "losses")?.value ?? "0");
  }

  assert(bankEnd === expectedBank, `bankroll ${bankEnd} != ${expectedBank}`);
  assert(creditEnd === expectedCredit, `credit ${creditEnd} != ${expectedCredit}`);
  assert(heldEnd === expectedHeld, `held GAS ${heldEnd} != ${expectedHeld}`);
  assert(pendingEnd === pending0, `pending count ${pendingEnd} != baseline ${pending0}`);
  assert(reservedEnd === 0n, `reserved bankroll not released: ${reservedEnd}`);
  assert(winsEnd - wins0 === wins, "win stats delta mismatch");
  assert(lossesEnd - losses0 === losses, "loss stats delta mismatch");

  console.log("\n[5] withdraw all remaining reusable credit...");
  if (creditEnd > 0n) {
    const heldBeforeWithdraw = await live.nep17BalanceOf(GAS, CONTRACT);
    const { log: withdrawLog } = await invoke(
      "withdraw",
      "withdraw",
      [H(account.scriptHash)],
    );
    const withdrawn = event(withdrawLog, "CreditWithdrawn");
    assert(withdrawn, "CreditWithdrawn event missing");
    assert(BigInt(withdrawn[1].value) === creditEnd, "withdraw amount mismatch");
    await waitForInteger(
      "creditOf",
      [P_H(account.scriptHash)],
      (value) => value === 0n,
      "credit was not cleared",
    );
    await waitForBalance(
      (value) => value === heldBeforeWithdraw - creditEnd,
      "contract balance did not decrease by withdrawn credit",
    );
  }

  console.log(
    `\nPASS - FogPlay V2: ${wins} win(s), ${losses} loss(es), exact tx/event identity, 3-block reveal, 2x payout, reservation release, and credit recovery verified.`,
  );
}

main().catch((error) => {
  const message = String(error?.message || error).replace(
    /\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g,
    "***WIF***",
  );
  console.error("error:", message);
  process.exit(1);
});
