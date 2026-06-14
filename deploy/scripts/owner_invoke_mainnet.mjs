/**
 * Invoke an owner-gated method on a MAINNET contract (e.g. WithdrawBankroll).
 * Dual-gated; never prints the WIF. Args are passed as a JSON array of
 * neon ContractParam descriptors, e.g.:
 *   '[{"type":"Hash160","value":"0x.."},{"type":"Integer","value":"200000000"}]'
 *
 *   MAINNET_OWNER_INVOKE_CONFIRM=YES DEPLOY_APPLY=1 NEO_TESTNET_WIF=... \
 *     node deploy/scripts/owner_invoke_mainnet.mjs <contract> <method> '<argsJson>'
 */
import pkg from "@cityofzion/neon-js";
const { sc, wallet, tx, u, rpc } = pkg;
const MAINNET_RPC = process.env.NEO_MAINNET_RPC_URL || "https://mainnet1.neo.coz.io:443";
const MAINNET_MAGIC = Number(process.env.NEO_MAINNET_MAGIC || 860833102);

const contract = (process.argv[2] || "").toLowerCase();
const method = process.argv[3];
let args = [];
try { args = JSON.parse(process.argv[4] || "[]"); } catch { console.error("bad argsJson"); process.exit(2); }
if (!contract || !method) { console.error("usage: owner_invoke_mainnet.mjs <contract> <method> '<argsJson>'"); process.exit(2); }
const wif = process.env.NEO_TESTNET_WIF || process.env.MINIAPP_DEPLOY_WIF;
if (!wif) { console.error("no deployer WIF in env"); process.exit(2); }
const mask = (s) => String(s).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***");

async function main() {
  const account = new wallet.Account(wif);
  const client = new rpc.RPCClient(MAINNET_RPC);
  console.log("network    : MAINNET (magic " + MAINNET_MAGIC + ")");
  console.log("signer     : " + account.address);
  console.log("contract   : " + contract);
  console.log("method     : " + method + "(" + JSON.stringify(args) + ")");

  const params = args.map((a) => sc.ContractParam.fromJson(a));
  const script = sc.createScript({ scriptHash: contract, operation: method, args: params });
  const signers = [tx.Signer.fromJson({ account: "0x" + account.scriptHash, scopes: "CalledByEntry" })];
  const preview = await client.invokeScript(u.HexString.fromHex(script), signers);
  if (preview.state !== "HALT") { console.error("test-invoke FAULT: " + preview.exception); process.exit(3); }
  console.log("test-invoke: HALT, stack=" + JSON.stringify(preview.stack?.map((s) => s.value)));

  const height = await client.getBlockCount();
  const txn = new tx.Transaction({ signers, validUntilBlock: height + 50, script });
  txn.systemFee = u.BigInteger.fromNumber(preview.gasconsumed);
  txn.sign(account, MAINNET_MAGIC);
  txn.networkFee = u.BigInteger.fromNumber(await client.calculateNetworkFee(txn));

  if (process.env.MAINNET_OWNER_INVOKE_CONFIRM !== "YES" || process.env.DEPLOY_APPLY !== "1") {
    console.log("DRY RUN — set MAINNET_OWNER_INVOKE_CONFIRM=YES and DEPLOY_APPLY=1 to send");
    return;
  }
  txn.sign(account, MAINNET_MAGIC);
  const txid = await client.sendRawTransaction(txn);
  console.log("txid       : " + txid);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    try {
      const log = await client.getApplicationLog(txid);
      const ex = log?.executions?.[0];
      if (!ex) continue;
      console.log("vm state   : " + ex.vmstate);
      if (ex.vmstate === "HALT") { console.log("OK ✓"); return; }
      console.error("FAULTED: " + JSON.stringify(ex.exception)); process.exit(5);
    } catch { /* not indexed yet */ }
  }
  console.log("sent but not confirmed within timeout; txid " + txid);
}
main().catch((e) => { console.error("invoke error: " + mask(e?.message || String(e))); process.exit(1); });
