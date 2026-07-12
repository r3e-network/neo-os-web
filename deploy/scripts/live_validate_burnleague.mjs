/**
 * Live testnet validation for MiniAppBurnLeague.
 *
 * The contract hash resolves from apps/burn-league/neo-manifest.json
 * (override: CONTRACT_OVERRIDE / CONTRACT_OVERRIDE_BURN_LEAGUE).
 *
 *   1. A deposits 5 GAS burn credit, burns 2 GAS (lazily starts the season).
 *   2. A funds a fresh wallet B; B deposits 4 GAS credit, burns 3 GAS -> B is top burner.
 *   3. pool = 5 GAS, topBurner = B (3 > 2). Asserted via Burned events + reads.
 *   4. Wait out the deadline, then settle() -> 5 GAS pool credited to B; B withdraws
 *      its full 6 GAS claimable balance (5 prize + 1 unused deposit).
 *   5. A reclaims unused 3 GAS credit; contract reaches zero; season advances + dormant.
 *
 * Asserts on lag-free events (Burned / SeasonSettled / CreditWithdrawn). Testnet-pinned
 * (endpoints/magic via lib/neo_network.js env overrides + failover); no WIFs printed.
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const CONTRACT = getManifestContractHash("burn-league", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const G = 100000000n; // 1 GAS in base units

const A = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const B = new wallet.Account();

const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_burnleague" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const addrFromState = (v) => "0x" + Buffer.from(v, "base64").reverse().toString("hex");
const gasBal = (h) => live.nep17BalanceOf(GAS, h);

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

  console.log("\n[5] settle() credits the whole pool to B (top burner)…");
  const bBefore = await gasBal(B.scriptHash);
  check(decInt(await read("creditOf", [P_H(B.scriptHash)])) === 1n * G, "B starts with 1 GAS unused credit");
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
  check(decInt(await read("creditOf", [P_H(B.scriptHash)])) === 6n * G, "B claimable credit = 6 GAS (5 prize + 1 unused)");
  check(decInt(await read("rewardPool")) === 0n, "pool reset to 0");
  check(decInt(await read("currentSeason")) === 2n, "season advanced to 2 (dormant)");

  console.log("\n[6] B withdraws prize + unused credit; A reclaims its unused credit…");
  const { log: bw } = await invoke("B withdraw", B, CONTRACT, "withdraw", [H(B.scriptHash)]);
  const bwev = eventState(bw, "CreditWithdrawn");
  check(bwev !== null && BigInt(bwev[1].value) === 6n * G, "B withdrew full 6 GAS claimable credit");
  check(decInt(await read("creditOf", [P_H(B.scriptHash)])) === 0n, "B claimable credit cleared");
  await sleep(6000);
  const bAfter = await gasBal(B.scriptHash);
  console.log(`    B wallet delta after withdrawal: ${(Number(bAfter - bBefore) / 1e8).toFixed(4)} GAS (net of B's tx fee)`);

  const { log: cw } = await invoke("A withdraw", A, CONTRACT, "withdraw", [H(A.scriptHash)]);
  const cwev = eventState(cw, "CreditWithdrawn");
  check(cwev !== null && BigInt(cwev[1].value) === 3n * G, "A reclaimed 3 GAS unused credit");

  const cbal = await gasBal(CONTRACT);
  console.log("\n  contract GAS balance:", (Number(cbal) / 1e8).toFixed(4), "GAS");
  check(cbal === 0n, "contract is empty after every claimable credit is withdrawn");

  console.log(fail === 0 ? "\n✅ BURN LEAGUE VALIDATED (full season lifecycle + payout)" : `\n❌ ${fail} check(s) failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("ERROR:", String(e?.message || e).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***")); process.exit(1); });
