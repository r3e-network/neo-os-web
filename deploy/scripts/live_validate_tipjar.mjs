/**
 * Live testnet validation + seed for MiniAppTipJar
 * (0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec).
 *
 *   1. A (deployer) self-registers as developer #1 (persistent seed).
 *   2. A funds a fresh wallet B; B self-registers as developer #2.
 *   3. A deposits 0.5 GAS tip credit (memo "miniapp-devtipping:tip").
 *   4. A tips developer #2 0.3 GAS -> dev2 balance/totalReceived/tipCount accrue,
 *      A credit drops to 0.2 (cross-actor tip).
 *   5. B (dev #2) withdrawTips -> 0.3 GAS paid to B, dev2 balance back to 0.
 *   6. A reclaims the unused 0.2 credit via Withdraw.
 *
 * Asserts on lag-free events (Tipped / TipsWithdrawn / CreditWithdrawn) plus
 * settled getDeveloper/creditOf reads. Testnet-pinned; no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
const { sc, wallet, rpc, tx, u } = pkg;

const RPC = process.env.NEO_TESTNET_RPC_URL || "https://rpc.t5.n3.nspcc.ru:20331";
const MAGIC = 894710606;
const CONTRACT = "0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec";
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const A = new wallet.Account(process.env.NEO_TESTNET_WIF);
const B = new wallet.Account(); // fresh dev #2
const client = new rpc.RPCClient(RPC);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retry = async (fn) => { for (let i = 0; i < 8; i++) { try { return await fn(); } catch (e) { if (i === 7) throw e; await sleep(3000); } } };
const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const Bool = (b) => sc.ContractParam.boolean(b);
const P_H = (a) => ({ type: "Hash160", value: a });
const P_I = (n) => ({ type: "Integer", value: n.toString() });

async function invoke(label, account, scriptHash, operation, args) {
  const script = sc.createScript({ scriptHash, operation, args });
  const count = await retry(() => client.getBlockCount());
  const signers = [tx.Signer.fromJson({ account: "0x" + account.scriptHash, scopes: "CalledByEntry" })];
  const txn = new tx.Transaction({ signers, validUntilBlock: count + 50, script });
  const inv = await retry(() => client.invokeScript(u.HexString.fromHex(script), signers));
  if (inv.state !== "HALT") throw new Error(`${label} test-invoke FAULT: ${inv.exception}`);
  txn.systemFee = u.BigInteger.fromNumber(inv.gasconsumed);
  txn.sign(account, MAGIC);
  txn.networkFee = u.BigInteger.fromNumber(await retry(() => client.calculateNetworkFee(txn)));
  txn.sign(account, MAGIC);
  const txid = await retry(() => client.sendRawTransaction(txn));
  for (let i = 0; i < 45; i++) {
    await sleep(4000);
    let log; try { log = await client.getApplicationLog(txid); } catch { continue; }
    const ex = log.executions?.[0];
    if (ex?.vmstate === "HALT") { console.log(`  ${label} ✓ (${txid.slice(0, 12)}…)`); return { txid, log }; }
    throw new Error(`${label} FAULT: ${JSON.stringify(ex?.exception)}`);
  }
  throw new Error(`${label} not confirmed`);
}
async function read(method, params = []) {
  const res = await retry(() => client.invokeFunction(CONTRACT, method, params));
  if (res.state !== "HALT") throw new Error(`${method} FAULT: ${res.exception}`);
  return res.stack;
}
const decInt = (s) => BigInt(s?.[0]?.value ?? "0");
function eventState(log, name) {
  for (const n of log?.executions?.[0]?.notifications ?? []) if (n.eventname === name) return n.state?.value ?? [];
  return null;
}
function devField(stack, key) {
  for (const kv of stack[0].value) {
    const k = Buffer.from(kv.key.value, "base64").toString();
    if (k === key) return kv.value;
  }
  return null;
}

async function main() {
  console.log("contract :", CONTRACT, "(MiniAppTipJar)\nA (deployer/dev1/tipper):", A.address, "\nB (fresh dev2):", B.address);
  let fail = 0;
  const check = (ok, msg) => { console.log(`    ${ok ? "✓" : "✗ FAIL"} ${msg}`); if (!ok) fail++; };

  console.log("\n[1] A self-registers as developer #1 (seed)…");
  const { log: r1 } = await invoke("registerA", A, CONTRACT, "registerDeveloper",
    [H(A.scriptHash), S("R3E Core"), S("Platform Maintainer")]);
  const reg1 = eventState(r1, "DeveloperRegistered");
  check(reg1 !== null && BigInt(reg1[0].value) === 1n, "DeveloperRegistered devId=1");

  console.log("\n[2] A funds B (1.5 GAS) then B self-registers as developer #2…");
  await invoke("fundB", A, GAS, "transfer", [H(A.scriptHash), H(B.scriptHash), I(150000000), S("")]);
  const { log: r2 } = await invoke("registerB", B, CONTRACT, "registerDeveloper",
    [H(B.scriptHash), S("Demo Contributor"), S("Community")]);
  const reg2 = eventState(r2, "DeveloperRegistered");
  check(reg2 !== null && BigInt(reg2[0].value) === 2n, "DeveloperRegistered devId=2");
  check(decInt(await read("totalDevelopers")) === 2n, "totalDevelopers = 2");

  console.log("\n[3] A deposits 0.5 GAS tip credit…");
  await invoke("deposit", A, GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(50000000), S("miniapp-devtipping:tip")]);
  check(decInt(await read("creditOf", [P_H(A.scriptHash)])) >= 50000000n, "A credit >= 0.5 GAS (post-deposit, settled)");

  console.log("\n[4] A tips developer #2 with 0.3 GAS…");
  const { log: tlog } = await invoke("tip", A, CONTRACT, "tip", [H(A.scriptHash), I(2), I(30000000), Bool(false)]);
  const tev = eventState(tlog, "Tipped");
  check(tev !== null, "Tipped event emitted");
  if (tev) {
    check(BigInt(tev[1].value) === 2n, `Tipped.devId = 2 (${tev[1].value})`);
    check(BigInt(tev[3].value) === 30000000n, `Tipped.amount = 0.3 GAS (${tev[3].value})`);
  }
  const dev2 = await read("getDeveloper", [P_I(2)]);
  check(BigInt(devField(dev2, "balance").value) === 30000000n, "dev2.balance = 0.3 GAS");
  check(BigInt(devField(dev2, "totalReceived").value) === 30000000n, "dev2.totalReceived = 0.3 GAS");
  check(BigInt(devField(dev2, "tipCount").value) === 1n, "dev2.tipCount = 1");
  check(decInt(await read("totalDonated")) === 30000000n, "totalDonated = 0.3 GAS");

  console.log("\n[5] B (dev #2) withdraws accrued tips…");
  const { log: wlog } = await invoke("withdrawTips", B, CONTRACT, "withdrawTips", [I(2)]);
  const wev = eventState(wlog, "TipsWithdrawn");
  check(wev !== null && BigInt(wev[2].value) === 30000000n, "TipsWithdrawn 0.3 GAS to B");
  const dev2b = await read("getDeveloper", [P_I(2)]);
  check(BigInt(devField(dev2b, "balance").value) === 0n, "dev2.balance reset to 0");

  console.log("\n[6] A reclaims unused 0.2 GAS credit…");
  const { log: cwlog } = await invoke("withdrawCredit", A, CONTRACT, "withdraw", [H(A.scriptHash)]);
  const cwev = eventState(cwlog, "CreditWithdrawn");
  check(cwev !== null && BigInt(cwev[1].value) === 20000000n, "CreditWithdrawn 0.2 GAS to A");
  check(decInt(await read("creditOf", [P_H(A.scriptHash)])) === 0n, "A credit reset to 0 (settled)");

  // solvency: contract should hold no leftover GAS from this flow
  const bal = await retry(() => client.invokeFunction(GAS, "balanceOf", [P_H(CONTRACT)]));
  console.log("\n  contract GAS balance:", (Number(bal.stack[0].value) / 1e8).toFixed(4), "GAS (expect ~0 from this flow)");

  console.log(fail === 0 ? "\n✅ TIPJAR VALIDATED (2 developers seeded)" : `\n❌ ${fail} check(s) failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
