/**
 * Live testnet validation for MiniAppRedEnvelope (0x68ef0ead...).
 *
 * Full flow against the real deployed contract:
 *   1. deposit GAS (NEP-17 transfer to contract, memo "miniapp-redenvelope:create")
 *   2. createEnvelope (consume credit -> a 2-packet envelope)
 *   3. claim from creator           (random packet, atomic payout)
 *   4. claim from a fresh 2nd account (final packet = exact remainder)
 *   5. assert share1 + share2 == total, opened == packetCount, active == false
 *
 * Uses only one funded testnet account (the deployer); the second claimer is a
 * fresh ephemeral account funded at runtime. Never prints WIFs. Testnet-pinned.
 */
import pkg from "@cityofzion/neon-js";
const { sc, wallet, rpc, tx, u } = pkg;

const RPC = "https://testnet1.neo.coz.io:443";
const MAGIC = 894710606;
const CONTRACT = "0x68ef0ead081d2263acc51ce82f5c70c46440cca4";
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const creator = new wallet.Account(process.env.NEO_TESTNET_WIF);
const claimer = new wallet.Account(); // fresh ephemeral 2nd participant

const client = new rpc.RPCClient(RPC);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);

async function invoke(label, account, scriptHash, operation, args) {
  const script = sc.createScript({ scriptHash, operation, args });
  const count = await client.getBlockCount();
  const signers = [tx.Signer.fromJson({ account: "0x" + account.scriptHash, scopes: "CalledByEntry" })];
  const txn = new tx.Transaction({ signers, validUntilBlock: count + 50, script });

  const inv = await client.invokeScript(u.HexString.fromHex(script), signers);
  if (inv.state !== "HALT") throw new Error(`${label} test-invoke FAULT: ${inv.exception}`);
  txn.systemFee = u.BigInteger.fromNumber(inv.gasconsumed);
  txn.sign(account, MAGIC); // provisional witness so the size is right for fee calc
  const nf = await client.calculateNetworkFee(txn);
  txn.networkFee = u.BigInteger.fromNumber(nf);
  txn.sign(account, MAGIC); // final signature over the real fees

  const txid = await client.sendRawTransaction(txn);
  for (let i = 0; i < 45; i++) {
    await sleep(4000);
    let log;
    try { log = await client.getApplicationLog(txid); } catch { continue; }
    const ex = log.executions?.[0];
    if (ex?.vmstate === "HALT") { console.log(`  ${label} ✓ (${txid.slice(0, 12)}…)`); return { txid, log }; }
    throw new Error(`${label} FAULT: ${JSON.stringify(ex?.exception)}`);
  }
  throw new Error(`${label} not confirmed`);
}

async function read(method, params = []) {
  const res = await client.invokeFunction(CONTRACT, method, params);
  if (res.state !== "HALT") throw new Error(`${method} FAULT: ${res.exception}`);
  return res.stack;
}
const P_H = (a) => ({ type: "Hash160", value: a });
const P_I = (n) => ({ type: "Integer", value: n.toString() });
function decInt(stack) { return BigInt(stack?.[0]?.value ?? "0"); }
async function gasBalance(addr) {
  const r = await client.invokeFunction(GAS, "balanceOf", [P_H(addr)]);
  return BigInt(r.stack?.[0]?.value ?? "0");
}
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
  console.log("claimer  :", claimer.address, "(fresh)");

  // Fund the fresh claimer with 1 GAS so it can pay its own claim tx fee.
  console.log("\n[0] fund fresh claimer with 1 GAS…");
  await invoke("fund-claimer", creator, GAS, "transfer", [
    H(creator.scriptHash), H(claimer.scriptHash), I(100000000), sc.ContractParam.any(null),
  ]);

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

  // 4. claim #2 (fresh claimer) — final packet = remainder
  console.log("\n[4] claim #2 by fresh account (final packet)…");
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
