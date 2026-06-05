/**
 * Live testnet validation for MiniAppBreakupPact (0xe298ae87a7e31f25ad0fce23e83f0e93c02e2850).
 *
 *   1. A deposits 1 GAS stake, creates a pact (A vs fresh B) -> pending
 *   2. fresh B deposits 1 GAS, signs -> active (both staked; contract holds 2 GAS)
 *   3. A breaks -> B (the non-breaker) receives BOTH stakes (2 GAS); contract -> 0
 *
 * Asserts the breaker-forfeits mechanic via the PactBroken event (lag-free) + B's
 * balance delta + contract solvency. Testnet-pinned; no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
const { sc, wallet, rpc, tx, u } = pkg;

const RPC = "https://testnet1.neo.coz.io:443";
const MAGIC = 894710606;
const CONTRACT = "0xe298ae87a7e31f25ad0fce23e83f0e93c02e2850";
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const STAKE_MEMO = "miniapp-breakup:stake";
const A = new wallet.Account(process.env.NEO_TESTNET_WIF);
const B = new wallet.Account();
const client = new rpc.RPCClient(RPC);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retry = async (fn) => { for (let i = 0; i < 6; i++) { try { return await fn(); } catch (e) { if (i === 5) throw e; await sleep(3000); } } };
const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const P_H = (a) => ({ type: "Hash160", value: a });
const P_I = (n) => ({ type: "Integer", value: n.toString() });

async function invoke(label, account, scriptHash, op, args) {
  const script = sc.createScript({ scriptHash, operation: op, args });
  const count = await retry(() => client.getBlockCount());
  const signers = [tx.Signer.fromJson({ account: "0x" + account.scriptHash, scopes: "CalledByEntry" })];
  const txn = new tx.Transaction({ signers, validUntilBlock: count + 50, script });
  const inv = await retry(() => client.invokeScript(u.HexString.fromHex(script), signers));
  if (inv.state !== "HALT") throw new Error(`${label} test FAULT: ${inv.exception}`);
  txn.systemFee = u.BigInteger.fromNumber(inv.gasconsumed);
  txn.sign(account, MAGIC);
  txn.networkFee = u.BigInteger.fromNumber(await retry(() => client.calculateNetworkFee(txn)));
  txn.sign(account, MAGIC);
  const txid = await retry(() => client.sendRawTransaction(txn));
  for (let i = 0; i < 45; i++) {
    await sleep(4000);
    let log; try { log = await client.getApplicationLog(txid); } catch { continue; }
    const ex = log.executions?.[0];
    if (ex?.vmstate === "HALT") { console.log(`  ${label} ✓`); return { txid, log }; }
    throw new Error(`${label} FAULT: ${JSON.stringify(ex?.exception)}`);
  }
  throw new Error(`${label} not confirmed`);
}
async function read(method, params = []) { const r = await retry(() => client.invokeFunction(CONTRACT, method, params)); if (r.state !== "HALT") throw new Error(`${method} FAULT`); return r.stack; }
const decInt = (s) => BigInt(s?.[0]?.value ?? "0");
async function gasBal(h) { const r = await retry(() => client.invokeFunction(GAS, "balanceOf", [P_H(h)])); return BigInt(r.stack?.[0]?.value ?? "0"); }
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
