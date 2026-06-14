/**
 * Live testnet validation for MiniAppMultisig (the neo-multisig miniapp contract).
 *
 * The contract hash resolves from apps/neo-multisig/neo-manifest.json
 * (override: CONTRACT_OVERRIDE / CONTRACT_OVERRIDE_NEO_MULTISIG).
 *
 * Exercises the full on-chain shared-vault approval lifecycle of the deployed v2
 * contract:
 *   1. createVault — a 2-of-2 vault owned by A, signers {A, B}.
 *   2. deposit 0.5 GAS into the vault (NEP-17 transfer with the vault id as data).
 *   3. createRequest (A) for a 0.1 GAS spend; cancel it from the OTHER signer (B) —
 *      any vault signer can cancel, not just the creator.
 *   4. two competing 0.4 GAS requests: the first reaches threshold and executes; the
 *      second reaches threshold now-underfunded and retires gracefully
 *      (RequestUnfunded + RequestCancelled) instead of pinning PENDING forever.
 *   5. assert the vault balance reflects only the one executed spend.
 *
 * Asserts on the tx's own notifications (lag-free). Env: NEO_TESTNET_WIF (vault
 * owner / signer A), SIM_WIF_1 (second vault signer B). Testnet-pinned
 * (endpoints/magic via lib/neo_network.js env overrides + failover); no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const CONTRACT = getManifestContractHash("neo-multisig", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const A = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const B = new wallet.Account(requireCredential("SIM_WIF_1", process.env.SIM_WIF_1));

const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_multisig" });

const ms = CONTRACT.replace(/^0x/, "");
const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const ARR = (items) => sc.ContractParam.array(...items);

const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const decInt = (s) => BigInt(s?.[0]?.value ?? "0");
const events = (res) => (res.execution?.notifications || []).map((n) => n.eventname);

let fail = 0;
const check = (ok, msg) => { console.log(`    ${ok ? "✓" : "✗ FAIL"} ${msg}`); if (!ok) fail++; };

const gasTransfer = (account, to, amount, data) =>
  live.invokeAndConfirm({
    label: `gas.transfer(${amount})`,
    account,
    scriptHash: GAS.replace(/^0x/, ""),
    operation: "transfer",
    args: [H(account.scriptHash), H(to), I(amount), data],
  });

async function main() {
  console.log("contract :", CONTRACT, "(MiniAppMultisig)\nA (owner/signer):", A.address, "\nB (signer):", B.address);

  console.log("\n[1] createVault (2-of-2, signers A+B)…");
  await live.invokeAndConfirm({
    label: "createVault",
    account: A,
    scriptHash: ms,
    operation: "createVault",
    args: [H(A.scriptHash), ARR([H(A.scriptHash), H(B.scriptHash)]), I(2)],
  });
  const vaultId = Number(decInt(await read("lastVaultId")));
  check(vaultId > 0, `vault created (id=${vaultId})`);

  console.log("\n[2] deposit 0.5 GAS into the vault…");
  await gasTransfer(A, CONTRACT, 50000000, I(vaultId));
  check(decInt(await read("balanceOf", [I(vaultId), H(GAS.replace(/^0x/, ""))])) === 50000000n, "vault balance = 0.5 GAS");

  console.log("\n[3] createRequest(A 0.1 GAS) then cancel from the OTHER signer (B)…");
  await live.invokeAndConfirm({
    label: "createRequest(cancel-me)",
    account: A,
    scriptHash: ms,
    operation: "createRequest",
    args: [I(vaultId), H(A.scriptHash), H(B.scriptHash), H(GAS.replace(/^0x/, "")), I(10000000), S("cancel-me")],
  });
  const req1 = Number(decInt(await read("lastRequestId")));
  const cancelRes = await live.invokeAndConfirm({
    label: "cancel (non-creator signer)",
    account: B,
    scriptHash: ms,
    operation: "cancel",
    args: [I(req1), H(B.scriptHash)],
  });
  check(events(cancelRes).includes("RequestCancelled"), "non-creator signer cancelled the request");

  console.log("\n[4] two competing 0.4 GAS requests: first executes, second retires unfunded…");
  const mkRequest = (label, amount, memo) =>
    live.invokeAndConfirm({
      label,
      account: A,
      scriptHash: ms,
      operation: "createRequest",
      args: [I(vaultId), H(A.scriptHash), H(B.scriptHash), H(GAS.replace(/^0x/, "")), I(amount), S(memo)],
    });
  const approveBy = (account, reqId, label) =>
    live.invokeAndConfirm({
      label,
      account,
      scriptHash: ms,
      operation: "approve",
      args: [I(reqId), H(account.scriptHash)],
    });

  await mkRequest("createRequest(A 0.4)", 40000000, "spend-a");
  const reqA = Number(decInt(await read("lastRequestId")));
  await mkRequest("createRequest(B 0.4)", 40000000, "spend-b");
  const reqB = Number(decInt(await read("lastRequestId")));

  await approveBy(A, reqA, "approve A #1");
  const finA = await approveBy(B, reqA, "approve A #2 (executes)");
  check(events(finA).includes("RequestExecuted"), "funded request executes at threshold");

  await approveBy(A, reqB, "approve B #1");
  const finB = await approveBy(B, reqB, "approve B #2 (threshold, now unfunded)");
  const evB = events(finB);
  check(evB.includes("RequestUnfunded") && evB.includes("RequestCancelled"),
    "unfunded finalization emits RequestUnfunded + RequestCancelled");

  console.log("\n[5] vault balance reflects only the one executed spend…");
  const vaultBal = decInt(await read("balanceOf", [I(vaultId), H(GAS.replace(/^0x/, ""))]));
  check(vaultBal === 10000000n, `vault balance = 0.1 GAS (one 0.4 spend executed of 0.5) (got ${vaultBal})`);

  console.log(fail === 0 ? "\n✅ MULTISIG VALIDATED (vault create/deposit/cancel/approve/execute/unfunded-retire)" : `\n❌ ${fail} check(s) failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("ERROR:", String(e?.message || e).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***")); process.exit(1); });
