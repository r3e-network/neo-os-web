/**
 * Live testnet validation for the Withdraw(account) credit-refund hardening,
 * exercised against the hardened MiniAppTarot.
 *
 * The contract hash resolves from apps/on-chain-tarot/neo-manifest.json — the
 * hardened MiniAppTarot deploy (override: CONTRACT_OVERRIDE /
 * CONTRACT_OVERRIDE_ON_CHAIN_TAROT). The Withdraw method is byte-identical across
 * all six hardened contracts (same PREFIX_CREDIT, same body), so proving it on
 * tarot proves the pattern.
 *
 *   1. A deposits 0.2 GAS (memo "miniapp-tarot:draw")  -> credit 0.2
 *   2. draw() consumes one 0.1 fee                      -> credit 0.1
 *   3. Withdraw(A) refunds the unused 0.1 GAS           -> credit 0, CreditWithdrawn(A, 0.1)
 *
 * Asserts on the CreditWithdrawn event (lag-free) + creditOf before/after.
 * Testnet-pinned (endpoints/magic via lib/neo_network.js env overrides +
 * failover); no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const CONTRACT = getManifestContractHash("on-chain-tarot", { network: "testnet" }); // hardened MiniAppTarot
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const A = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));

const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_withdraw" });

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const P_H = (a) => ({ type: "Hash160", value: a });

const invoke = (label, account, scriptHash, operation, args) =>
  live.invokeAndConfirm({ label, account, scriptHash, operation, args });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const decInt = (s) => BigInt(s?.[0]?.value ?? "0");
function eventState(log, name) {
  for (const n of log?.executions?.[0]?.notifications ?? []) if (n.eventname === name) return n.state?.value ?? [];
  return null;
}

async function main() {
  console.log("contract :", CONTRACT, "(hardened MiniAppTarot)\naccount  :", A.address);
  let fail = 0;
  const check = (ok, msg) => { console.log(`    ${ok ? "✓" : "✗ FAIL"} ${msg}`); if (!ok) fail++; };

  const c0 = decInt(await read("creditOf", [P_H(A.scriptHash)]));
  console.log("\n[0] starting credit =", c0.toString());

  console.log("\n[1] deposit 0.2 GAS (memo miniapp-tarot:draw)…");
  await invoke("deposit", A, GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(20000000), S("miniapp-tarot:draw")]);
  const c1 = decInt(await read("creditOf", [P_H(A.scriptHash)]));
  check(c1 === c0 + 20000000n, `credit ${c0} -> ${c1} (+0.2 GAS)`);

  console.log("\n[2] draw() consumes one 0.1 fee…");
  await invoke("draw", A, CONTRACT, "draw", [H(A.scriptHash)]);
  const c2 = decInt(await read("creditOf", [P_H(A.scriptHash)]));
  check(c2 === c1 - 10000000n, `credit ${c1} -> ${c2} (-0.1 GAS fee)`);

  console.log("\n[3] Withdraw(A) refunds the unused credit…");
  const { log } = await invoke("withdraw", A, CONTRACT, "withdraw", [H(A.scriptHash)]);
  const ev = eventState(log, "CreditWithdrawn");
  check(ev !== null, "CreditWithdrawn event emitted");
  if (ev) {
    const acct = "0x" + Buffer.from(ev[0].value, "base64").reverse().toString("hex");
    const amt = BigInt(ev[1].value);
    check(acct.toLowerCase() === ("0x" + A.scriptHash).toLowerCase(), `event account = A (${acct})`);
    check(amt === c2, `event amount ${amt} == prior credit ${c2}`);
  }
  const c3 = decInt(await read("creditOf", [P_H(A.scriptHash)]));
  check(c3 === 0n, `credit ${c2} -> ${c3} (fully refunded, 0)`);

  // withdraw with no credit must fault
  console.log("\n[4] Withdraw again (no credit) must revert…");
  let reverted = false;
  try { await invoke("withdraw-empty", A, CONTRACT, "withdraw", [H(A.scriptHash)]); }
  catch (e) { reverted = /no credit/.test(String(e)); }
  check(reverted, "second withdraw reverts with 'no credit'");

  console.log(fail === 0 ? "\n✅ WITHDRAW HARDENING VALIDATED" : `\n❌ ${fail} check(s) failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("ERROR:", String(e?.message || e).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***")); process.exit(1); });
