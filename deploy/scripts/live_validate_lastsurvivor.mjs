/**
 * Live Neo N3 testnet validation for MiniAppLastSurvivor.
 *
 * Uses two configured test accounts, buys one key each on the rising curve,
 * waits for expiry, settles permissionlessly, proves the winner receives
 * claimable contract credit (not an unsafe push payment), withdraws all test
 * credit, and verifies that the next round opens. No WIF is printed.
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;
const CONTRACT = process.env.CONTRACT_OVERRIDE ||
  getManifestContractHash("last-survivor", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const BUY_MEMO = "miniapp-lastsurvivor:buy";
const accountA = new wallet.Account(
  requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF),
);
const accountB = new wallet.Account(
  requireCredential("SIM_WIF_1", process.env.SIM_WIF_1),
);
const live = createLiveRpc({
  network: "testnet",
  neon: pkg,
  label: "live_validate_lastsurvivor",
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const H = (value) => sc.ContractParam.hash160(value);
const I = (value) => sc.ContractParam.integer(value.toString());
const S = (value) => sc.ContractParam.string(value);
const P_H = (value) => ({ type: "Hash160", value });
const P_I = (value) => ({ type: "Integer", value: value.toString() });
const invoke = (label, account, operation, args) =>
  live.invokeAndConfirm({
    label,
    account,
    scriptHash: CONTRACT,
    operation,
    args,
  });
const transfer = (label, account, amount) =>
  live.invokeAndConfirm({
    label,
    account,
    scriptHash: GAS,
    operation: "transfer",
    args: [H(account.scriptHash), H(CONTRACT), I(amount), S(BUY_MEMO)],
  });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const integer = (stack) => BigInt(stack?.[0]?.value ?? "0");

function event(log, name) {
  for (const notification of log?.executions?.[0]?.notifications ?? []) {
    if (notification.eventname === name) return notification.state?.value ?? [];
  }
  return null;
}

function hasGasTransferTo(log, recipientHash) {
  const gas = GAS.replace(/^0x/, "").toLowerCase();
  const recipient = recipientHash.replace(/^0x/, "").toLowerCase();
  return (log?.executions?.[0]?.notifications ?? []).some((notification) => {
    const contract = String(notification.contract ?? "")
      .replace(/^0x/, "")
      .toLowerCase();
    const state = notification.state?.value ?? [];
    return (
      contract === gas &&
      notification.eventname === "Transfer" &&
      hash160Value(state[1]?.value) === recipient
    );
  });
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

async function currentRound() {
  const stack = await read("getCurrentRound");
  return {
    stack,
    id: BigInt(mapField(stack, "roundId")?.value ?? "0"),
    pot: BigInt(mapField(stack, "pot")?.value ?? "0"),
    totalKeys: BigInt(mapField(stack, "totalKeys")?.value ?? "0"),
    lastBuyer: hash160Value(mapField(stack, "lastBuyer")?.value),
    remaining: BigInt(mapField(stack, "remainingTime")?.value ?? "0"),
    settled: mapField(stack, "settled")?.value,
  };
}

async function waitForRound(predicate, label) {
  const deadline = Date.now() + 35_000;
  let round = await currentRound();
  while (!predicate(round) && Date.now() < deadline) {
    await sleep(2_500);
    round = await currentRound();
  }
  assert(predicate(round), `${label}: observed round ${round.id} with ${round.totalKeys} keys and pot ${round.pot}`);
  return round;
}

async function waitForRoundExpiry() {
  const deadline = Date.now() + 110_000;
  let round = await currentRound();
  while (round.remaining > 0n && Date.now() < deadline) {
    process.stdout.write(`    remaining ${round.remaining}s...\r`);
    await sleep(5_000);
    round = await currentRound();
  }
  process.stdout.write("\n");
  assert(round.remaining === 0n, "round did not expire within the live timeout");
  return round;
}

async function ensureFreshRound() {
  let round = await currentRound();
  if (round.totalKeys === 0n) return round;
  if (round.remaining > 0n) round = await waitForRoundExpiry();
  await invoke("settle-existing", accountA, "settle", []);
  await waitForInteger(
    "currentRoundId",
    [],
    (value) => value === round.id + 1n,
    `existing round did not advance from ${round.id}`,
  );
  // Public testnet RPCs can serve reads from replicas a block behind even after
  // another read has observed the new round id. Require one coherent fresh
  // snapshot before funding the validation round.
  return waitForRound(
    (snapshot) =>
      snapshot.id === round.id + 1n &&
      snapshot.totalKeys === 0n &&
      snapshot.pot === 0n,
    `fresh round ${round.id + 1n} did not become readable`,
  );
}

async function topUpToCost(label, account, cost) {
  const params = [P_H(account.scriptHash)];
  const creditBefore = integer(await read("creditOf", params));
  const shortfall = cost > creditBefore ? cost - creditBefore : 0n;
  if (shortfall > 0n) {
    const { log } = await transfer(`${label}-deposit`, account, shortfall);
    assert(event(log, "Credited"), `${label} Credited event missing`);
    await waitForInteger(
      "creditOf",
      params,
      (value) => value === creditBefore + shortfall,
      `${label} credit did not reach ${creditBefore + shortfall}`,
    );
  }
  return creditBefore + shortfall - cost;
}

async function withdrawCredit(label, account) {
  const params = [P_H(account.scriptHash)];
  const credit = integer(await read("creditOf", params));
  if (credit <= 0n) return 0n;
  const { log } = await invoke(label, account, "withdraw", [H(account.scriptHash)]);
  const withdrawn = event(log, "CreditWithdrawn");
  assert(withdrawn, `${label} CreditWithdrawn event missing`);
  assert(BigInt(withdrawn[1].value) === credit, `${label} withdraw amount mismatch`);
  await waitForInteger(
    "creditOf",
    params,
    (value) => value === 0n,
    `${label} credit was not cleared`,
  );
  return credit;
}

async function main() {
  console.log("contract:", CONTRACT);
  console.log("player A:", accountA.address);
  console.log("player B:", accountB.address);

  const round0 = await ensureFreshRound();
  assert(round0.totalKeys === 0n, "fresh round already has keys");
  console.log(`\n[1] round ${round0.id}: A buys the opening key...`);
  const costA = integer(await read("currentKeyCost", [P_I(1)]));
  assert(costA === 10_000_000n, `opening key cost ${costA} != 0.1 GAS`);
  const aCreditAfterBuy = await topUpToCost("A", accountA, costA);
  const { log: buyALog } = await invoke(
    "A-buy",
    accountA,
    "buyKeys",
    [H(accountA.scriptHash), I(1)],
  );
  const boughtA = event(buyALog, "KeysBought");
  assert(boughtA, "A KeysBought event missing");
  assert(BigInt(boughtA[0].value) === round0.id, "A round id mismatch");
  assert(hash160Value(boughtA[1].value) === accountA.scriptHash.toLowerCase(), "A player mismatch");
  assert(BigInt(boughtA[2].value) === 1n, "A key count mismatch");
  assert(BigInt(boughtA[3].value) === costA, "A key cost mismatch");
  await waitForInteger(
    "creditOf",
    [P_H(accountA.scriptHash)],
    (value) => value === aCreditAfterBuy,
    "A credit was not consumed",
  );

  console.log("\n[2] B buys the rising-price key and becomes last buyer...");
  const costB = integer(await read("currentKeyCost", [P_I(1)]));
  assert(costB === 10_010_000n, `second key cost ${costB} != 0.1001 GAS`);
  const bCreditAfterBuy = await topUpToCost("B", accountB, costB);
  const { log: buyBLog } = await invoke(
    "B-buy",
    accountB,
    "buyKeys",
    [H(accountB.scriptHash), I(1)],
  );
  const boughtB = event(buyBLog, "KeysBought");
  assert(boughtB, "B KeysBought event missing");
  assert(BigInt(boughtB[0].value) === round0.id, "B round id mismatch");
  assert(hash160Value(boughtB[1].value) === accountB.scriptHash.toLowerCase(), "B player mismatch");
  assert(BigInt(boughtB[2].value) === 1n, "B key count mismatch");
  assert(BigInt(boughtB[3].value) === costB, "B key cost mismatch");
  await waitForInteger(
    "creditOf",
    [P_H(accountB.scriptHash)],
    (value) => value === bCreditAfterBuy,
    "B credit was not consumed",
  );

  const liveRound = await currentRound();
  const expectedPot = costA + costB;
  assert(liveRound.pot === expectedPot, `pot ${liveRound.pot} != ${expectedPot}`);
  assert(liveRound.totalKeys === 2n, "round totalKeys != 2");
  assert(liveRound.lastBuyer === accountB.scriptHash.toLowerCase(), "B is not last buyer");

  console.log("\n[3] wait for the authoritative countdown to expire...");
  await waitForRoundExpiry();

  console.log("\n[4] A settles; B receives pull-payment credit...");
  const { log: settleLog } = await invoke("settle", accountA, "settle", []);
  const settled = event(settleLog, "RoundSettled");
  assert(settled, "RoundSettled event missing");
  assert(BigInt(settled[0].value) === round0.id, "settled round id mismatch");
  assert(hash160Value(settled[1].value) === accountB.scriptHash.toLowerCase(), "winner mismatch");
  assert(BigInt(settled[2].value) === expectedPot, "settled pot mismatch");
  assert(BigInt(settled[3].value) === round0.id + 1n, "next round mismatch");
  // Exact transaction evidence: settlement must not emit a GAS Transfer to the
  // winner. Comparing two latest-state balance reads is unsafe on public RPC
  // replicas because one read may lag the preceding buy by a block.
  assert(
    !hasGasTransferTo(settleLog, accountB.scriptHash),
    "settle pushed GAS instead of crediting the winner",
  );
  await waitForInteger(
    "creditOf",
    [P_H(accountB.scriptHash)],
    (value) => value === bCreditAfterBuy + expectedPot,
    "winner claimable credit did not include the pot",
  );
  await waitForInteger(
    "currentRoundId",
    [],
    (value) => value === round0.id + 1n,
    "round did not advance",
  );

  console.log("\n[5] both test accounts withdraw all reusable/winner credit...");
  const withdrawnA = await withdrawCredit("A-withdraw", accountA);
  const withdrawnB = await withdrawCredit("B-withdraw", accountB);
  assert(withdrawnB === bCreditAfterBuy + expectedPot, "B did not withdraw the full winner credit");
  const nextRound = await currentRound();
  assert(nextRound.id === round0.id + 1n, "next round id changed unexpectedly");
  assert(nextRound.totalKeys === 0n && nextRound.pot === 0n, "next round is not fresh");

  console.log(
    `\nPASS - Last Survivor: 0.1 -> 0.1001 GAS curve, two buyers, B last, ${expectedPot} pot credited on settle, A/B credit withdrawn (${withdrawnA}/${withdrawnB}), next round opened.`,
  );
}

main().catch((error) => {
  const message = String(error?.message || error).replace(
    /\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g,
    "***WIF***",
  );
  console.error("validation error:", message);
  process.exit(1);
});
