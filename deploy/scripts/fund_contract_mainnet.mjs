/**
 * Fund a miniapp contract on MAINNET with a memo'd GAS transfer (e.g. seed a
 * house bankroll or a reward pool). Dual-gated; never prints the WIF.
 *
 *   MAINNET_FUND_CONFIRM=YES DEPLOY_APPLY=1 NEO_TESTNET_WIF=... \
 *     node deploy/scripts/fund_contract_mainnet.mjs <contractHash> <amountGAS> <memo>
 *
 * Without the gates it is a DRY RUN (prints the planned transfer + fees only).
 */
import pkg from "@cityofzion/neon-js";

const { sc, wallet, tx, u, rpc } = pkg;
const MAINNET_RPC = process.env.NEO_MAINNET_RPC_URL || "https://mainnet1.neo.coz.io:443";
const MAINNET_MAGIC = Number(process.env.NEO_MAINNET_MAGIC || 860833102);
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const contract = (process.argv[2] || "").toLowerCase();
const amountGas = Number(process.argv[3]);
const memo = process.argv[4];
if (!contract || !Number.isFinite(amountGas) || amountGas <= 0 || !memo) {
  console.error("usage: fund_contract_mainnet.mjs <contractHash> <amountGAS> <memo>");
  process.exit(2);
}
const wif = process.env.NEO_TESTNET_WIF || process.env.MINIAPP_DEPLOY_WIF;
if (!wif) { console.error("no deployer WIF in env"); process.exit(2); }
const mask = (s) => String(s).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***");

async function main() {
  const account = new wallet.Account(wif);
  const client = new rpc.RPCClient(MAINNET_RPC);
  const amount = BigInt(Math.round(amountGas * 1e8));

  console.log("network        : MAINNET (magic " + MAINNET_MAGIC + ")");
  console.log("deployer addr  : " + account.address);
  console.log("contract       : " + contract);
  console.log("amount         : " + amountGas + " GAS (memo " + memo + ")");

  const script = sc.createScript({
    scriptHash: GAS,
    operation: "transfer",
    args: [
      sc.ContractParam.hash160(account.address),
      sc.ContractParam.hash160(contract),
      sc.ContractParam.integer(amount.toString()),
      sc.ContractParam.string(memo),
    ],
  });
  const signers = [tx.Signer.fromJson({ account: "0x" + account.scriptHash, scopes: "CalledByEntry" })];
  const preview = await client.invokeScript(u.HexString.fromHex(script), signers);
  if (preview.state !== "HALT") { console.error("test-invoke FAULT: " + preview.exception); process.exit(3); }

  const height = await client.getBlockCount();
  const txn = new tx.Transaction({ signers, validUntilBlock: height + 50, script });
  txn.systemFee = u.BigInteger.fromNumber(preview.gasconsumed);
  txn.sign(account, MAINNET_MAGIC);
  txn.networkFee = u.BigInteger.fromNumber(await client.calculateNetworkFee(txn));
  console.log("system fee     : " + txn.systemFee.toDecimal(8));
  console.log("network fee    : " + txn.networkFee.toDecimal(8));

  if (process.env.MAINNET_FUND_CONFIRM !== "YES" || process.env.DEPLOY_APPLY !== "1") {
    console.log("DRY RUN — set MAINNET_FUND_CONFIRM=YES and DEPLOY_APPLY=1 to send");
    return;
  }
  txn.sign(account, MAINNET_MAGIC);
  const txid = await client.sendRawTransaction(txn);
  console.log("fund txid      : " + txid);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    try {
      const log = await client.getApplicationLog(txid);
      const ex = log?.executions?.[0];
      if (!ex) continue;
      console.log("vm state       : " + ex.vmstate);
      if (ex.vmstate === "HALT") { console.log("FUNDED ✓"); return; }
      console.error("FUND FAULTED: " + JSON.stringify(ex.exception)); process.exit(5);
    } catch { /* not indexed yet */ }
  }
  console.log("sent but not confirmed within timeout; txid " + txid);
}

main().catch((e) => { console.error("fund error: " + mask(e?.message || String(e))); process.exit(1); });
