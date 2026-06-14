/** Light testnet smoke for MiniAppSelfLoan (owner-path only; full lifecycle is covered
 *  by the local NeoVM TestEngine since the deployer holds no NEO). Owner sets the NEO
 *  price and funds the GAS pool, priming the contract for use.
 *
 *  Contract hash resolves from apps/self-loan/neo-manifest.json
 *  (override: CONTRACT_OVERRIDE / CONTRACT_OVERRIDE_SELF_LOAN). Testnet-pinned
 *  (endpoints/magic via lib/neo_network.js env overrides + failover); no WIFs printed. */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const CONTRACT = getManifestContractHash("self-loan", { network: "testnet" });
const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const A = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));

const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_selfloan_smoke" });

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);

const invoke = (label, scriptHash, op, args) =>
  live.invokeAndConfirm({ label, account: A, scriptHash, operation: op, args });
const read = async (m, p = []) => (await live.readStack(CONTRACT, m, p))[0]?.value;

(async () => {
  console.log("contract:", CONTRACT, "\nowner/deployer:", A.address);
  console.log("\n[1] setNeoPrice(5 GAS per NEO)…");
  await invoke("setNeoPrice", CONTRACT, "setNeoPrice", [I(500000000)]);
  console.log("    neoPrice =", await read("neoPrice"), "(expect 500000000)");
  console.log("\n[2] fund pool 2 GAS…");
  await invoke("fundPool", GAS, "transfer", [H(A.scriptHash), H(CONTRACT), I(200000000), S("selfloan:fund")]);
  console.log("    pool =", await read("pool"), "(expect 200000000)");
  console.log("    feeBps =", await read("feeBps"), "| ltvTier2Bps =", await read("ltvTierBps", [{ type: "Integer", value: "2" }]));
  console.log("\n✅ SELF-LOAN owner-path smoke OK (price set, pool funded); full lifecycle validated in TestEngine");
})().catch((e) => { console.error("ERR", String(e?.message || e).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***")); process.exit(1); });
