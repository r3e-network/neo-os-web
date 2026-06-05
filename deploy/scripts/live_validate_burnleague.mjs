/**
 * Live testnet validation for MiniAppBurnLeague
 * (0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f).
 *
 *   1. A deposits 5 GAS burn credit, burns 2 GAS (lazily starts the season).
 *   2. A funds a fresh wallet B; B deposits 4 GAS credit, burns 3 GAS -> B is top burner.
 *   3. pool = 5 GAS, topBurner = B (3 > 2). Asserted via Burned events + reads.
 *   4. Wait out the season deadline, then settle() -> whole 5 GAS pool paid to B.
 *   5. A reclaims unused 3 GAS credit; contract left solvent; season advanced + dormant.
 *
 * Asserts on lag-free events (Burned / SeasonSettled / CreditWithdrawn). Testnet-pinned.
 */
import pkg from "@cityofzion/neon-js";
const { sc, wallet, rpc, tx, u } = pkg;

const RPC = process.env.NEO_TESTNET_RPC_URL || "https://rpc.t5.n3.nspcc.ru:20331";
const MAGIC = 894710606;
const CONTRACT = "0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f";
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const G = 100000000n; // 1 GAS in base units

const A = new wallet.Account(process.env.NEO_TESTNET_WIF);
const B = new wallet.Account();
const client = new rpc.RPCClient(RPC);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retry = async (fn) => { for (let i = 0; i < 8; i++) { try { return await fn(); } catch (e) { if (i === 7) throw e; await sleep(3000); } } };
const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const P_H = (a) => ({ type: "Hash160", value: a });

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
const addrFromState = (v) => "0x" + Buffer.from(v, "base64").reverse().toString("hex");

async function gasBal(h) {
  const r = await retry(() => client.invokeFunction(GAS, "balanceOf", [P_H(h)]));
  return BigInt(r.stack?.[0]?.value ?? "0");
}

async function main() {
  console.log("contract :", CONTRACT, "(MiniAppBurnLeague)\nA:", A.address, "\nB:", B.address);
  let fail = 0;
  const check = (ok, msg) => { console.log(`    ${ok ? "✓" : "✗ FAIL"} ${msg}`); if (!ok) fail++; };

  console.log("\n[1] A deposits 5 GAS credit, burns 2 GAS (starts season)…");
  await invoke("A deposit", A, GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(5n * G), S("miniapp-burnleague:burn")]);
  const { log: b1 } = await invoke("A burn 2", A, CONTRACT, "burn", [H(A.scriptHash), I(2n * G)]);
  const be1 = eventState(b1, "Burned");
  check(be1 !== null && BigInt(be1[3].value) === 2n * G, "A season total = 2 GAS");
  const seasonId = decInt(await read("currentSeason"));
  check(seasonId === 1n, `season = 1 (${seasonId})`);

  console.log("\n[2] A funds B (6 GAS); B deposits 4 GAS credit, burns 3 GAS…");
  await invoke("fund B", A, GAS, "transfer", [H(A.scriptHash), H(B.scriptHash), I(6n * G), S("")]);
  await invoke("B deposit", B, GAS, "transfer", [H(B.scriptHash), H(CONTRACT), I(4n * G), S("miniapp-burnleague:burn")]);
  const { log: b2 } = await invoke("B burn 3", B, CONTRACT, "burn", [H(B.scriptHash), I(3n * G)]);
  const be2 = eventState(b2, "Burned");
  check(be2 !== null && BigInt(be2[3].value) === 3n * G, "B season total = 3 GAS");

  check(decInt(await read("rewardPool")) === 5n * G, "pool = 5 GAS");
  check(decInt(await read("burnCount")) === 2n, "burnCount = 2");
  const top = await read("topBurner");
  check(addrFromState(top[0].value).toLowerCase() === ("0x" + B.scriptHash).toLowerCase(), "topBurner = B");
  check(decInt(await read("topBurned")) === 3n * G, "topBurned = 3 GAS");

  console.log("\n[3] settle() must revert before the deadline…");
  let early = false;
  try { await invoke("early settle", A, CONTRACT, "settle", []); }
  catch (e) { early = /season not ended/.test(String(e)); }
  check(early, "settle reverts 'season not ended' pre-deadline");

  console.log("\n[4] waiting out the season deadline…");
  const endMs = Number(decInt(await read("seasonEnd")));
  const waitMs = Math.max(0, endMs - Date.now()) + 24000; // + buffer for a block with time >= end
  console.log(`    season ends at ${new Date(endMs).toISOString()}; sleeping ${(waitMs / 1000).toFixed(0)}s…`);
  await sleep(waitMs);

  console.log("\n[5] settle() pays the whole pool to B (top burner)…");
  const bBefore = await gasBal(B.scriptHash);
  let slog = null;
  for (let i = 0; i < 5; i++) {
    try { ({ log: slog } = await invoke("settle", A, CONTRACT, "settle", [])); break; }
    catch (e) { if (/season not ended/.test(String(e))) { console.log("    (block time lagging, +12s)"); await sleep(12000); } else throw e; }
  }
  const sev = eventState(slog, "SeasonSettled");
  check(sev !== null, "SeasonSettled emitted");
  if (sev) {
    check(addrFromState(sev[1].value).toLowerCase() === ("0x" + B.scriptHash).toLowerCase(), "winner = B");
    check(BigInt(sev[2].value) === 5n * G, "prize = 5 GAS pool");
  }
  await sleep(6000);
  const bAfter = await gasBal(B.scriptHash);
  check(bAfter - bBefore === 5n * G, `B received 5 GAS prize (Δ ${(Number(bAfter - bBefore) / 1e8).toFixed(2)})`);
  check(decInt(await read("rewardPool")) === 0n, "pool reset to 0");
  check(decInt(await read("currentSeason")) === 2n, "season advanced to 2 (dormant)");

  console.log("\n[6] A reclaims unused 3 GAS credit…");
  const { log: cw } = await invoke("A withdraw", A, CONTRACT, "withdraw", [H(A.scriptHash)]);
  const cwev = eventState(cw, "CreditWithdrawn");
  check(cwev !== null && BigInt(cwev[1].value) === 3n * G, "A reclaimed 3 GAS unused credit");

  const cbal = await gasBal(CONTRACT);
  console.log("\n  contract GAS balance:", (Number(cbal) / 1e8).toFixed(4), "GAS (B still has 1 GAS reclaimable credit)");
  check(cbal === 1n * G, "contract holds exactly B's 1 GAS unused credit (no strand)");

  console.log(fail === 0 ? "\n✅ BURN LEAGUE VALIDATED (full season lifecycle + payout)" : `\n❌ ${fail} check(s) failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
