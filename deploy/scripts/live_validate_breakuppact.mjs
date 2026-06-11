/**
 * Live testnet validation for MiniAppBreakupPact.
 *
 * The contract hash resolves from apps/breakup-contract/neo-manifest.json
 * (override: CONTRACT_OVERRIDE / CONTRACT_OVERRIDE_BREAKUP_CONTRACT).
 *
 *   1. A deposits 1 GAS stake, creates a pact (A vs fresh B) -> pending
 *   2. fresh B deposits 1 GAS, signs -> active (both staked; contract holds 2 GAS)
 *   3. A breaks -> B (the non-breaker) receives BOTH stakes (2 GAS); contract -> 0
 *
 * Asserts the breaker-forfeits mechanic via the PactBroken event (lag-free) + B's
 * balance delta + contract solvency. Testnet-pinned (endpoints/magic via
 * lib/neo_network.js env overrides); no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const CONTRACT = getManifestContractHash("breakup-contract", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const STAKE_MEMO = "miniapp-breakup:stake";

const A = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const B = new wallet.Account();

const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_breakuppact" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const P_H = (a) => ({ type: "Hash160", value: a });
const P_I = (n) => ({ type: "Integer", value: n.toString() });

const invoke = (label, account, scriptHash, op, args) =>
  live.invokeAndConfirm({ label, account, scriptHash, operation: op, args });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const decInt = (s) => BigInt(s?.[0]?.value ?? "0");
const gasBal = (h) => live.nep17BalanceOf(GAS, h);
function ev(log, name) { for (const n of log?.executions?.[0]?.notifications ?? []) if (n.eventname === name) return n.state?.value ?? []; return null; }
function mapField(stack, key) { for (const kv of stack?.[0]?.value ?? []) { const raw = kv.key?.value; const d = typeof raw === "string" ? Buffer.from(raw, "base64").toString() : raw; if (d === key) return kv.value; } return null; }

async function main() {
  console.log("contract:", CONTRACT, "\nA:", A.address, "\nB:", B.address, "(fresh)");
  const STAKE = 100000000n; // 1 GAS

  console.log("\n[0] fund fresh B with 3 GAS…");
  await invoke("fund-B", A, GAS, "transfer", [H(A.scriptHash), H(B.scriptHash), I(300000000), sc.ContractParam.any(null)]);

  console.log("\n[1] A deposits 1 GAS stake, creates pact (A vs B, 3600s)…");
  await invoke("A-deposit", A, GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(STAKE), S(STAKE_MEMO)]);
  const { log: createLog } = await invoke("create", A, CONTRACT, "createPact", [H(A.scriptHash), H(B.scriptHash), I(STAKE), I(3600)]);
  const pactId = BigInt(ev(createLog, "PactCreated")[0].value);
  let pact = await read("getPact", [P_I(pactId)]);
  console.log("    pactId =", pactId.toString(), "status =", BigInt(mapField(pact, "status")?.value).toString(), "(0=pending) party1Staked =", mapField(pact, "party1Staked")?.value);

  console.log("\n[2] B deposits 1 GAS stake, signs…");
  await invoke("B-deposit", B, GAS, "transfer", [H(B.scriptHash), H(CONTRACT), I(STAKE), S(STAKE_MEMO)]);
  await invoke("B-sign", B, CONTRACT, "signPact", [I(pactId), H(B.scriptHash)]);
  pact = await read("getPact", [P_I(pactId)]);
  const held1 = await gasBal("0x" + CONTRACT.slice(2));
  console.log("    status =", BigInt(mapField(pact, "status")?.value).toString(), "(1=active) | contract holds", (Number(held1) / 1e8).toFixed(2), "GAS (expect 2.00)");

  console.log("\n[3] A breaks the pact → B (non-breaker) gets both stakes…");
  const bBefore = await gasBal(B.scriptHash);
  const { log: breakLog } = await invoke("break", A, CONTRACT, "breakPact", [I(pactId), H(A.scriptHash)]);
  const bk = ev(breakLog, "PactBroken"); // (id, breaker, paidTo, amount)
  const paidAmount = BigInt(bk[3].value);
  const paidToB64 = bk[2].value;
  const bB64 = Buffer.from(B.scriptHash, "hex").reverse().toString("base64");
  const bAfter = await gasBal(B.scriptHash);

  console.log("\n[4] invariants:");
  await sleep(6000);
  pact = await read("getPact", [P_I(pactId)]);
  const status = BigInt(mapField(pact, "status")?.value);
  const held2 = await gasBal("0x" + CONTRACT.slice(2));
  const okPaid = paidAmount === STAKE * 2n;
  const okPaidTo = paidToB64 === bB64;
  const okBdelta = (bAfter - bBefore) === STAKE * 2n;
  const okBroken = status === 2n;
  const okSolvent = held2 === 0n;
  console.log("    PactBroken.amount  =", paidAmount.toString(), "== 2x stake", okPaid ? "✓" : "✗");
  console.log("    paidTo == B        =", okPaidTo ? "✓" : "(hash differs)");
  console.log("    B GAS delta        =", (bAfter - bBefore).toString(), "== 2 GAS", okBdelta ? "✓" : "✗");
  console.log("    pact status        =", status.toString(), okBroken ? "✓ (2=broken)" : "✗");
  console.log("    contract held GAS  =", held2.toString(), okSolvent ? "✓ (0, no strand)" : "✗");

  const pass = okPaid && okBdelta && okBroken && okSolvent;
  console.log("\n" + (pass
    ? "RESULT: PASS ✓ — matched stakes locked; breaker forfeited; partner won both stakes atomically; contract solvent; no oracle."
    : "RESULT: FAIL ✗"));
  if (!pass) process.exit(1);
}
main().catch((e) => { console.error("error:", String(e?.message || e).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***")); process.exit(1); });
