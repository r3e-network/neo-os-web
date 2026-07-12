/**
 * Live testnet validation for MiniAppRedEnvelope.
 *
 * The contract hash resolves from apps/red-envelope/neo-manifest.json
 * (override: CONTRACT_OVERRIDE / CONTRACT_OVERRIDE_RED_ENVELOPE), so the
 * harness always targets the deployment the app actually uses.
 *
 * Full flow against the real deployed contract:
 *   1. deposit GAS (NEP-17 transfer to contract, memo "miniapp-redenvelope:create")
 *   2. createEnvelope (consume credit -> a 2-packet envelope)
 *   3. claim from creator           (random packet, atomic payout)
 *   4. claim from the configured 2nd account (final packet = exact remainder)
 *   5. assert share1 + share2 == total, opened == packetCount, active == false
 *
 * Uses two configured funded testnet accounts so validation never strands GAS
 * in an ephemeral wallet. Never prints WIFs. Testnet-pinned
 * (RPC endpoint/magic via lib/neo_network.js — NEO_RPC_TESTNET / NEO_RPC_URL /
 * NEO_RPC_ENDPOINTS env overrides apply).
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const CONTRACT = getManifestContractHash("red-envelope", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const creator = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const claimer = new wallet.Account(requireCredential("SIM_WIF_1", process.env.SIM_WIF_1));

const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_redenvelope" });

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);

const invoke = (label, account, scriptHash, operation, args) =>
  live.invokeAndConfirm({ label, account, scriptHash, operation, args });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);

const P_H = (a) => ({ type: "Hash160", value: a });
const P_I = (n) => ({ type: "Integer", value: n.toString() });
function decInt(stack) { return BigInt(stack?.[0]?.value ?? "0"); }
const gasBalance = (accountHash) => live.nep17BalanceOf(GAS, accountHash);
function mapField(stack, key) {
  for (const kv of stack?.[0]?.value ?? []) {
    const raw = kv.key?.value;
    const decoded = (typeof raw === "string") ? Buffer.from(raw, "base64").toString() : raw;
    if (decoded === key) return kv.value;
  }
  return null;
}

async function main() {
  console.log("contract :", CONTRACT);
  console.log("creator  :", creator.address);
  console.log("claimer  :", claimer.address);

  const TOTAL = 100000000n; // 1 GAS
  const PACKETS = 2;

  // 1. deposit
  console.log("\n[1] deposit 1 GAS to contract (memo create)…");
  await invoke("deposit", creator, GAS, "transfer", [
    H(creator.scriptHash), H(CONTRACT), I(TOTAL), S("miniapp-redenvelope:create"),
  ]);
  const credit = decInt(await read("creditOf", [P_H(creator.scriptHash)]));
  console.log("    creditOf(creator) =", credit.toString(), credit === TOTAL ? "✓" : "✗");

  // 2. create
  console.log("\n[2] createEnvelope(total=1 GAS, packets=2, 3600s)…");
  await invoke("create", creator, CONTRACT, "createEnvelope", [
    H(creator.scriptHash), I(TOTAL), I(PACKETS), I(3600),
  ]);
  const envId = decInt(await read("lastEnvelopeId"));
  console.log("    envId =", envId.toString());

  // 3. claim #1 (creator)
  console.log("\n[3] claim #1 by creator…");
  await invoke("claim1", creator, CONTRACT, "claim", [I(envId), H(creator.scriptHash)]);
  const share1 = decInt(await read("claimedAmount", [P_I(envId), P_H(creator.scriptHash)]));
  console.log("    share1 =", share1.toString(), `(${(Number(share1) / 1e8).toFixed(8)} GAS)`);

  // 4. claim #2 (configured second participant) — final packet = remainder
  console.log("\n[4] claim #2 by second account (final packet)…");
  const clBefore = await gasBalance(claimer.scriptHash);
  await invoke("claim2", claimer, CONTRACT, "claim", [I(envId), H(claimer.scriptHash)]);
  const clAfter = await gasBalance(claimer.scriptHash);
  const share2 = decInt(await read("claimedAmount", [P_I(envId), P_H(claimer.scriptHash)]));
  console.log("    share2 =", share2.toString(), `(${(Number(share2) / 1e8).toFixed(8)} GAS)`);
  console.log("    claimer GAS delta (incl. -fee +share) =", (Number(clAfter - clBefore) / 1e8).toFixed(8));

  // 5. invariants
  console.log("\n[5] invariants:");
  const env = await read("getEnvelope", [P_I(envId)]);
  const remaining = BigInt(mapField(env, "remainingAmount")?.value);
  const opened = BigInt(mapField(env, "openedCount")?.value);
  const active = mapField(env, "active")?.value;
  const bestLuck = BigInt(mapField(env, "bestLuckAmount")?.value);
  const sum = share1 + share2;
  const maxShare = share1 > share2 ? share1 : share2;
  const okSum = sum === TOTAL, okRem = remaining === 0n, okOpened = opened === BigInt(PACKETS);
  const okActive = active === false || active === 0 || active === "0";
  const okBest = bestLuck === maxShare;
  console.log("    share1 + share2 =", sum.toString(), "vs total", TOTAL.toString(), okSum ? "✓" : "✗");
  console.log("    remaining       =", remaining.toString(), okRem ? "✓" : "✗");
  console.log("    opened          =", opened.toString(), okOpened ? "✓" : "✗");
  console.log("    active          =", active, okActive ? "✓" : "✗");
  console.log("    bestLuck        =", bestLuck.toString(), okBest ? "✓" : "✗");

  const pass = okSum && okRem && okOpened && okActive && okBest;
  console.log("\n" + (pass
    ? "RESULT: PASS ✓ — deposit→create→2 random claims paid atomically; shares sum to total; no GAS stranded; no oracle."
    : "RESULT: FAIL ✗"));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error("validation error:", String(e?.message || e).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***"));
  process.exit(1);
});
