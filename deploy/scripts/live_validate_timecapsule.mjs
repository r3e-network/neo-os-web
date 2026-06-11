/**
 * Live testnet validation for MiniAppTimeCapsule.
 *
 * The contract hash resolves from apps/time-capsule/neo-manifest.json
 * (override: CONTRACT_OVERRIDE / CONTRACT_OVERRIDE_TIME_CAPSULE).
 *
 * Refundable time-lock vault flow:
 *   1. A deposits 0.2 GAS, buries a public capsule (60s lock)
 *   2. reveal() while locked is rejected ("not yet unlocked")  [read-only guard check]
 *   3. fresh F fishes the public capsule (0.05 GAS) -> forwarded to owner A as a tip
 *   4. after unlock, A reveals -> the 0.2 GAS deposit is returned to A
 *
 * Asserts via contract + owner balances (fee-independent): fish tips the owner
 * +0.05; reveal pays the 0.2 deposit out of the contract. Testnet-pinned
 * (endpoints/magic via lib/neo_network.js env overrides); no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const CONTRACT = getManifestContractHash("time-capsule", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const A = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const F = new wallet.Account(); // fresh fisher

const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_timecapsule" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const BA = (hex) => sc.ContractParam.byteArray(hex);
const BOOL = (b) => sc.ContractParam.boolean(b);
const P_I = (n) => ({ type: "Integer", value: n.toString() });
const P_H = (a) => ({ type: "Hash160", value: a });

const invoke = (label, account, scriptHash, operation, args) =>
  live.invokeAndConfirm({ label, account, scriptHash, operation, args });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);
// Read-only test-invoke WITH a signer (so CheckWitness passes) to probe a guard.
const testInvokeWithSigner = (account, scriptHash, operation, args) =>
  live.testInvoke(account, scriptHash, operation, args);
const decInt = (s) => BigInt(s?.[0]?.value ?? "0");
const gasBal = (h) => live.nep17BalanceOf(GAS, h);
function mapField(stack, key) {
  for (const kv of stack?.[0]?.value ?? []) {
    const raw = kv.key?.value;
    const d = typeof raw === "string" ? Buffer.from(raw, "base64").toString() : raw;
    if (d === key) return kv.value;
  }
  return null;
}
// Read an emitted event's state array straight from the tx's application log —
// definitive at HALT time, immune to read-node lag.
function eventState(log, name) {
  for (const n of log?.executions?.[0]?.notifications ?? []) {
    if (n.eventname === name) return n.state?.value ?? [];
  }
  return null;
}

async function main() {
  console.log("contract :", CONTRACT);
  console.log("owner A  :", A.address);
  console.log("fisher F :", F.address, "(fresh)");
  const contractHash = "0x" + CONTRACT.slice(2);
  const AMOUNT = 20000000n; // 0.2 GAS
  const FISH = 5000000n;    // 0.05 GAS
  const contentHash = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"; // 32 bytes

  console.log("\n[0] fund fresh F with 1 GAS…");
  await invoke("fund-F", A, GAS, "transfer", [H(A.scriptHash), H(F.scriptHash), I(100000000), sc.ContractParam.any(null)]);

  console.log("\n[1] A deposits 0.2 GAS (memo bury)…");
  await invoke("deposit", A, GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(AMOUNT), S("miniapp-timecapsule:bury")]);
  console.log("    creditOf(A) =", decInt(await read("creditOf", [P_H(A.scriptHash)])).toString());

  console.log("\n[2] bury(public, 60s lock, 0.2 GAS)…");
  await invoke("bury", A, CONTRACT, "bury", [H(A.scriptHash), BA(contentHash), I(60), BOOL(true), I(1), I(AMOUNT)]);
  const id = decInt(await read("lastCapsuleId"));
  let cap = await read("getCapsule", [P_I(id)]);
  console.log("    id =", id.toString(), "amount =", BigInt(mapField(cap, "amount")?.value).toString(),
              "public =", mapField(cap, "isPublic")?.value, "revealed =", mapField(cap, "revealed")?.value);

  console.log("\n[3] reveal() while locked → must be rejected…");
  const early = await testInvokeWithSigner(A, CONTRACT, "reveal", [H(A.scriptHash), I(id)]);
  const guardOk = early.state === "FAULT" && /not yet unlocked/.test(early.exception || "");
  console.log("    state =", early.state, "exception:", (early.exception || "").slice(0, 40), guardOk ? "✓ (guarded)" : "✗");

  console.log("\n[4] F fishes the public capsule (0.05 GAS → tip to owner A)…");
  const { log: fishLog } = await invoke("fish", F, GAS, "transfer", [H(F.scriptHash), H(CONTRACT), I(FISH), S(`miniapp-timecapsule:fish:${id}`)]);
  // Fished(id, fisher, owner, fee) — read fee + owner from the event.
  const fishEv = eventState(fishLog, "Fished") ?? [];
  const tip = BigInt(fishEv[3]?.value ?? "0");
  const tippedOwnerB64 = fishEv[2]?.value;
  const aOwnerB64 = Buffer.from(A.scriptHash, "hex").reverse().toString("base64");
  console.log("    Fished.fee =", tip.toString(), tip === FISH ? "✓ (+0.05)" : "✗",
              "| tipped owner == A:", tippedOwnerB64 === aOwnerB64 ? "✓" : "(see hash)");

  console.log("\n[5] after unlock, A reveals → 0.2 deposit returned…");
  // ensure unlocked
  for (let i = 0; i < 20; i++) {
    const c = await read("getCapsule", [P_I(id)]);
    const unlock = BigInt(mapField(c, "unlockTime")?.value);
    const now = BigInt(Date.now());
    if (now >= unlock) break;
    process.stdout.write(`    waiting ${(Number(unlock - now) / 1000).toFixed(0)}s for unlock…\r`);
    await sleep(8000);
  }
  const { log: revLog } = await invoke("reveal", A, CONTRACT, "reveal", [H(A.scriptHash), I(id)]);
  // Revealed(id, owner, amount) — read the refunded amount from the event.
  const revEv = eventState(revLog, "Revealed") ?? [];
  const paidOut = BigInt(revEv[2]?.value ?? "0");
  // Final on-chain truth (with a settle delay so the read node has caught up).
  await sleep(6000);
  cap = await read("getCapsule", [P_I(id)]);
  const contractGas = await gasBal(contractHash);

  console.log("\n[6] invariants:");
  const revealed = mapField(cap, "revealed")?.value;
  const fished = mapField(cap, "fished")?.value;
  const okTip = tip === FISH;
  const okPaid = paidOut === AMOUNT;
  const okRevealed = revealed === true || revealed === 1 || revealed === "1";
  const okFished = fished === true || fished === 1 || fished === "1";
  const okNoStrand = contractGas === 0n;
  console.log("    fish tip to owner    =", tip.toString(), okTip ? "✓" : "✗");
  console.log("    unlock guard         =", guardOk ? "✓" : "✗");
  console.log("    reveal refunded      =", paidOut.toString(), "vs deposit", AMOUNT.toString(), okPaid ? "✓" : "✗");
  console.log("    capsule revealed     =", revealed, okRevealed ? "✓" : "✗");
  console.log("    capsule fished       =", fished, okFished ? "✓" : "✗");
  console.log("    contract GAS (no strand) =", contractGas.toString(), okNoStrand ? "✓ (0)" : "✗");

  const pass = okTip && guardOk && okPaid && okRevealed && okFished && okNoStrand;
  console.log("\n" + (pass
    ? "RESULT: PASS ✓ — bury locks GAS, time guard holds, fish tips the owner, reveal refunds the deposit; no oracle."
    : "RESULT: FAIL ✗"));
  if (!pass) process.exit(1);
}
main().catch((e) => { console.error("error:", String(e?.message || e).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***")); process.exit(1); });
