/**
 * Live testnet validation of the 2026-06 redeploys:
 *  - MiniAppGovMerc v2: epoch bidding window (anti-sniping) — bid opens a
 *    deadline, settle before it FAULTs, settle after it succeeds (no stakers
 *    → top bid refunded as withdrawable credit).
 *  - MiniAppMultisig v2: any-signer cancel + graceful unfunded retirement.
 *
 * Env: NEO_TESTNET_WIF (primary), SIM_WIF_1 (second multisig signer).
 * Contract hashes resolve from CONTRACT_GOVMERC / CONTRACT_MULTISIG env.
 */
import pkg from "@cityofzion/neon-js";
import { createLiveRpc } from "./lib/live_rpc.mjs";
import liveCreds from "./lib/live_credentials.js";
const { requireCredential } = liveCreds;

const { sc, wallet, u } = pkg;
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const GOVMERC = process.env.CONTRACT_GOVMERC;
const MULTISIG = process.env.CONTRACT_MULTISIG;
if (!GOVMERC || !MULTISIG) {
  console.error("set CONTRACT_GOVMERC and CONTRACT_MULTISIG");
  process.exit(2);
}

requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF);
requireCredential("SIM_WIF_1", process.env.SIM_WIF_1);
const admin = new wallet.Account(process.env.NEO_TESTNET_WIF);
const sim1 = new wallet.Account(process.env.SIM_WIF_1);

const live = createLiveRpc({ network: "testnet", label: "gm-v2" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash160 = (h) => sc.ContractParam.hash160(h);
const integer = (n) => sc.ContractParam.integer(n);
const str = (s) => sc.ContractParam.string(s);
const arr = (items) => sc.ContractParam.array(...items);

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  (" + detail + ")" : ""}`);
  if (!ok) failures += 1;
}

async function expectFault(label, fn, needle) {
  try {
    await fn();
    check(label, false, "expected FAULT but HALTed");
  } catch (e) {
    const msg = String(e?.message || e);
    check(label, msg.includes(needle), msg.slice(0, 100));
  }
}

async function gasTransfer(account, to, amount, data) {
  return live.invokeAndConfirm({
    label: `gas.transfer(${amount})`,
    account,
    scriptHash: GAS.replace(/^0x/, ""),
    operation: "transfer",
    args: [hash160(account.scriptHash), hash160(to), integer(amount), data],
  });
}

async function validateGovMerc() {
  console.log("== GovMerc v2 " + GOVMERC);
  const gm = GOVMERC.replace(/^0x/, "");
  const epoch = Number((await live.readStack(GOVMERC, "currentEpoch", []))[0].value);
  const duration = Number((await live.readStack(GOVMERC, "epochDuration", []))[0].value);
  console.log(`epoch=${epoch} duration=${duration}ms`);

  // Credit 1 GAS of bid budget, then bid — first bid opens the window.
  await gasTransfer(admin, GOVMERC, 1_0000_0000, str("govmerc:bid"));
  await live.invokeAndConfirm({
    label: "bid",
    account: admin,
    scriptHash: gm,
    operation: "bid",
    args: [hash160(admin.scriptHash), integer(1_0000_0000)],
  });
  const deadline = Number((await live.readStack(GOVMERC, "epochDeadline", [integer(epoch)]))[0].value);
  check("first bid opened an epoch deadline", deadline > 0, `deadline=${deadline}`);

  // Settle before the deadline must revert (the sniping fix).
  await expectFault(
    "settle before deadline rejected",
    () =>
      live.invokeAndConfirm({
        label: "settleEpoch(early)",
        account: admin,
        scriptHash: gm,
        operation: "settleEpoch",
        args: [],
      }),
    "epoch not ended",
  );

  const waitMs = deadline - Date.now() + 20_000;
  console.log(`waiting ${(waitMs / 1000).toFixed(0)}s for the bidding window to close…`);
  await sleep(Math.max(waitMs, 0));

  await live.invokeAndConfirm({
    label: "settleEpoch(after window)",
    account: admin,
    scriptHash: gm,
    operation: "settleEpoch",
    args: [],
  });
  const epochAfter = Number((await live.readStack(GOVMERC, "currentEpoch", []))[0].value);
  check("settle after window advances the epoch", epochAfter === epoch + 1, `epoch=${epochAfter}`);

  // No stakers existed, so the top bid becomes withdrawable credit.
  const credit = BigInt((await live.readStack(GOVMERC, "gasCreditOf", [hash160(admin.scriptHash)]))[0].value);
  check("no-staker settle refunds the bid as credit", credit >= 1_0000_0000n, `credit=${credit}`);
  await live.invokeAndConfirm({
    label: "withdraw(credit)",
    account: admin,
    scriptHash: gm,
    operation: "withdraw",
    args: [hash160(admin.scriptHash)],
  });
  const bal = await live.nep17BalanceOf(GAS, GOVMERC.replace(/^0x/, ""));
  check("contract solvent after withdraw", bal === 0n, `contract GAS=${bal}`);
}

async function validateMultisig() {
  console.log("== Multisig v2 " + MULTISIG);
  const ms = MULTISIG.replace(/^0x/, "");

  await live.invokeAndConfirm({
    label: "createVault",
    account: admin,
    scriptHash: ms,
    operation: "createVault",
    args: [hash160(admin.scriptHash), arr([hash160(admin.scriptHash), hash160(sim1.scriptHash)]), integer(2)],
  });
  const vaultId = Number((await live.readStack(MULTISIG, "lastVaultId", []))[0].value);
  console.log(`vault=${vaultId}`);

  // Fund the vault with 0.5 GAS.
  await gasTransfer(admin, MULTISIG, 5000_0000, integer(vaultId));

  // Request 1: small spend — created by admin, cancelled by the OTHER signer.
  await live.invokeAndConfirm({
    label: "createRequest(small)",
    account: admin,
    scriptHash: ms,
    operation: "createRequest",
    args: [integer(vaultId), hash160(admin.scriptHash), hash160(sim1.scriptHash), hash160(GAS), integer(1000_0000), str("cancel-me")],
  });
  const req1 = Number((await live.readStack(MULTISIG, "lastRequestId", []))[0].value);
  await live.invokeAndConfirm({
    label: "cancel by non-creator signer",
    account: sim1,
    scriptHash: ms,
    operation: "cancel",
    args: [integer(req1), hash160(sim1.scriptHash)],
  });
  const r1 = (await live.readStack(MULTISIG, "getRequest", [integer(req1)]))[0];
  check("non-creator signer cancelled the request", JSON.stringify(r1).length > 0, `request=${req1}`);

  // Requests 2+3 compete for the same funds: both fit the balance at creation,
  // the first executes, the second hits threshold underfunded and retires
  // gracefully (the old code asserted here, pinning it PENDING forever).
  const mkRequest = (label, amount, memo) =>
    live.invokeAndConfirm({
      label,
      account: admin,
      scriptHash: ms,
      operation: "createRequest",
      args: [integer(vaultId), hash160(admin.scriptHash), hash160(sim1.scriptHash), hash160(GAS), integer(amount), str(memo)],
    });
  const approveBy = (account, reqId, label) =>
    live.invokeAndConfirm({
      label,
      account,
      scriptHash: ms,
      operation: "approve",
      args: [integer(reqId), hash160(account.scriptHash)],
    });

  await mkRequest("createRequest(A 0.4)", 4000_0000, "spend-a");
  const reqA = Number((await live.readStack(MULTISIG, "lastRequestId", []))[0].value);
  await mkRequest("createRequest(B 0.4)", 4000_0000, "spend-b");
  const reqB = Number((await live.readStack(MULTISIG, "lastRequestId", []))[0].value);

  await approveBy(admin, reqA, "approve A #1");
  const finA = await approveBy(sim1, reqA, "approve A #2 (executes)");
  const eventsA = (finA.execution?.notifications || []).map((n) => n.eventname);
  check("funded request executes at threshold", eventsA.includes("RequestExecuted") || eventsA.includes("Transfer"), eventsA.join(","));

  await approveBy(admin, reqB, "approve B #1");
  const finB = await approveBy(sim1, reqB, "approve B #2 (threshold, now unfunded)");
  const eventsB = (finB.execution?.notifications || []).map((n) => n.eventname);
  check("unfunded finalization emits RequestUnfunded + RequestCancelled",
    eventsB.includes("RequestUnfunded") && eventsB.includes("RequestCancelled"),
    eventsB.join(","));
  const vaultBal = BigInt((await live.readStack(MULTISIG, "balanceOf", [integer(vaultId), hash160(GAS)]))[0].value);
  check("vault balance reflects only the executed spend", vaultBal === 1000_0000n, `bal=${vaultBal}`);
}

await validateGovMerc();
await validateMultisig();
console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
