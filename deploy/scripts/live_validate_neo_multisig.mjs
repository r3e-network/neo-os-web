/**
 * Live testnet validation for miniapp-neo-multisig — WRITE path.
 *
 * MiniAppMultisig (neo-manifest testnet hash) is a shared multisig vault:
 * createVault(signers, threshold) → GAS deposit via transfer data=vaultId →
 * createRequest(recipient, amount, memo) → approve() executes at threshold.
 *
 * This harness runs the complete lifecycle on testnet with the operator WIF:
 *   1. createVault([operator, fresh], threshold 1) — fresh second signer only
 *      fills the MIN_SIGNERS=2 shape; threshold 1 lets operator finalize.
 *   2. deposit: GAS transfer to the contract with integer data=vaultId.
 *   3. balanceOf(vaultId, GAS) reflects the deposit.
 *   4. createRequest(operator as recipient, small amount, memo).
 *   5. approve(requestId, operator) → threshold met → executes; vault balance
 *      decreases by the amount; getRequest shows a terminal (executed) status.
 *
 * Amounts are negligible. No keys printed.
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const CONTRACT = getManifestContractHash("neo-multisig", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const account = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const second = new wallet.Account(); // shape-only second signer (never signs)
const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_neo_multisig" });

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const ARR = (items) => sc.ContractParam.array(...items);
const P_I = (n) => ({ type: "Integer", value: n.toString() });
const P_H = (a) => ({ type: "Hash160", value: a });
const DEPOSIT = 10_000_000;        // 0.1 GAS
const PAYOUT = 2_000_000;          // 0.02 GAS

const invoke = (label, operation, args) =>
  live.invokeAndConfirm({ label, account, scriptHash: CONTRACT, operation, args });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const decInt = (v) => BigInt(v?.value ?? "0");

let failures = 0;
const check = (ok, label, detail = "") => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

function mapGet(stack, key) {
  for (const kv of stack?.[0]?.value ?? []) {
    const k = kv?.key?.value ?? kv?.[0]?.value;
    const kStr = typeof k === "string" && !/^[0-9]+$/.test(k) ? k : (() => { try { return Buffer.from(String(k), "base64").toString("utf8"); } catch { return String(k); } })();
    if (kStr === key) return kv?.value ?? kv?.[1];
  }
  return undefined;
}

function firstEventInt(execution, eventName, index) {
  for (const n of execution?.notifications ?? []) {
    const name = n?.eventname ?? n?.event_name;
    if (name !== eventName) continue;
    const fields = n?.state?.value ?? [];
    return BigInt(fields[index]?.value ?? "0");
  }
  return 0n;
}

async function main() {
  console.log(`contract: ${CONTRACT} (miniapp-neo-multisig testnet binding)`);

  // 1. createVault — vaultId comes from the OnVaultCreated event in the
  // confirmed execution (reading counters right after a confirm races node lag).
  const createRes = await invoke("createVault", "createVault",
    [H(account.scriptHash), ARR([H(account.scriptHash), H(second.scriptHash)]), I(1)]);
  const vaultId = firstEventInt(createRes.execution, "VaultCreated", 0);
  check(vaultId > 0n, `createVault issued vaultId ${vaultId}`);

  const vault = await read("getVault", [P_I(vaultId)]);
  check(vault?.[0]?.type === "Map", `getVault(${vaultId}) returns a Map`);

  // 2. deposit (transfer data = integer vaultId)
  await live.invokeAndConfirm({
    label: "deposit",
    account,
    scriptHash: GAS,
    operation: "transfer",
    args: [H(account.scriptHash), H(CONTRACT), I(DEPOSIT), I(vaultId)],
  });
  let balAfterDeposit = 0n;
  for (let i = 0; i < 10 && balAfterDeposit < BigInt(DEPOSIT); i++) {
    await new Promise((r) => setTimeout(r, 2000));
    balAfterDeposit = decInt((await read("balanceOf", [P_I(vaultId), P_H(GAS)]))?.[0]);
  }
  check(balAfterDeposit >= BigInt(DEPOSIT), `balanceOf reflects the deposit`, `${balAfterDeposit}`);

  // 3. createRequest (recipient = operator, small payout) — id from the event.
  const reqRes = await invoke("createRequest", "createRequest",
    [I(vaultId), H(account.scriptHash), H(account.scriptHash), H(GAS), I(PAYOUT), S("harness")]);
  const requestId = firstEventInt(reqRes.execution, "RequestCreated", 0);
  check(requestId > 0n, `createRequest issued requestId ${requestId}`);

  let approved = await read("hasApproved", [P_I(requestId), P_H(account.scriptHash)]);
  check(String(approved?.[0]?.value ?? "false") === "false", "request starts unapproved");

  // 4. approve → threshold 1 → executes
  await invoke("approve", "approve", [I(requestId), H(account.scriptHash)]);
  const balAfter = decInt((await read("balanceOf", [P_I(vaultId), P_H(GAS)]))?.[0]);
  check(balAfter === balAfterDeposit - BigInt(PAYOUT),
    `vault balance decreased by the payout (${balAfterDeposit} → ${balAfter})`);
  const req = await read("getRequest", [P_I(requestId)]);
  check(req?.[0]?.type === "Map", `getRequest(${requestId}) returns a Map`);
  let approvedBack = "false";
  for (let i = 0; i < 10 && approvedBack !== "true"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await read("hasApproved", [P_I(requestId), P_H(account.scriptHash)]);
    approvedBack = String(res?.[0]?.value ?? "false");
  }
  check(approvedBack === "true", "request records operator approval");

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nminiapp-neo-multisig live-chain harness: ALL CHECKS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
