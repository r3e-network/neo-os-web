/**
 * In-place contract upgrade via the contract's own admin-gated
 * `update(nefFile, manifest)` method (MiniAppBase / MiniAppCompactBase).
 *
 * Usage:
 *   node deploy/scripts/update_miniapp_contract.mjs \
 *     --hash 0x<deployed contract hash> \
 *     --nef contracts/build/<Name>.nef \
 *     --manifest contracts/build/<Name>.manifest.json \
 *     [--network testnet|mainnet]
 *
 * DRY RUN by default: previews the update invocation (state + gas) without
 * broadcasting. Set UPDATE_APPLY=1 to send. Mainnet additionally requires
 * MAINNET_UPDATE_CONFIRM=YES so a stray env cannot touch mainnet.
 *
 * Signer: NEO_TESTNET_WIF / MINIAPP_UPDATE_WIF / MINIAPP_DEPLOY_WIF — must be
 * the contract admin (the original deploy-tx sender). Never prints the WIF.
 */
import fs from "node:fs";
import pkg from "@cityofzion/neon-js";
import { createLiveRpc } from "./lib/live_rpc.mjs";
const { sc, wallet, rpc, u } = pkg;

const NETWORKS = {
  testnet: {
    rpc: process.env.NEO_TESTNET_RPC_URL || "https://testnet1.neo.coz.io:443",
    magic: Number(process.env.NEO_TESTNET_MAGIC || 894710606),
  },
  mainnet: {
    rpc: process.env.NEO_MAINNET_RPC_URL || "https://mainnet1.neo.coz.io:443",
    magic: Number(process.env.NEO_MAINNET_MAGIC || 860833102),
  },
};

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function mask(s) {
  return String(s).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***");
}

const network = arg("network", "testnet");
const contractHash = arg("hash");
const nefPath = arg("nef");
const manifestPath = arg("manifest");
if (!NETWORKS[network] || !contractHash || !nefPath || !manifestPath) {
  console.error(
    "usage: update_miniapp_contract.mjs --hash 0x.. --nef <path> --manifest <path> [--network testnet|mainnet]",
  );
  process.exit(2);
}

const wif =
  process.env.NEO_TESTNET_WIF ||
  process.env.MINIAPP_UPDATE_WIF ||
  process.env.MINIAPP_DEPLOY_WIF;
if (!wif) {
  console.error("no admin WIF in env (NEO_TESTNET_WIF / MINIAPP_UPDATE_WIF / MINIAPP_DEPLOY_WIF)");
  process.exit(2);
}

async function main() {
  const net = NETWORKS[network];
  const account = new wallet.Account(wif);
  const client = new rpc.RPCClient(net.rpc);

  const nefBytes = fs.readFileSync(nefPath);
  const manifestJson = JSON.stringify(JSON.parse(fs.readFileSync(manifestPath, "utf8")));

  const before = await client.getContractState(contractHash);
  console.log("network        : " + network.toUpperCase() + " (magic " + net.magic + ")");
  console.log("contract       : " + before.manifest.name + " " + contractHash);
  console.log("updatecounter  : " + before.updatecounter);
  console.log("admin signer   : " + account.address);

  const params = [
    sc.ContractParam.byteArray(u.hex2base64(nefBytes.toString("hex"))),
    sc.ContractParam.string(manifestJson),
  ];
  const signers = [
    { account: "0x" + account.scriptHash, scopes: "CalledByEntry" },
  ];

  const preview = await client.invokeFunction(contractHash, "update", params, signers);
  console.log("preview state  : " + preview.state + " (gas " + (Number(preview.gasconsumed) / 1e8).toFixed(4) + ")");
  if (preview.state !== "HALT") {
    console.error("update preview FAULT: " + mask(preview.exception || "unknown"));
    process.exit(3);
  }

  if (process.env.UPDATE_APPLY !== "1") {
    console.log("DRY RUN (set UPDATE_APPLY=1 to broadcast)");
    return;
  }
  if (network === "mainnet" && process.env.MAINNET_UPDATE_CONFIRM !== "YES") {
    console.error("mainnet update requires MAINNET_UPDATE_CONFIRM=YES");
    process.exit(2);
  }

  const live = createLiveRpc({ network, rpcUrls: [net.rpc], networkMagic: net.magic, label: "update" });
  const { txid } = await live.invokeAndConfirm({
    label: "update:" + before.manifest.name,
    account,
    scriptHash: contractHash.replace(/^0x/, ""),
    operation: "update",
    args: params,
  });
  console.log("update txid    : " + txid);
  const after = await client.getContractState(contractHash);
  console.log(
    "UPDATED ✓  updatecounter " + before.updatecounter + " -> " + after.updatecounter +
    "  standards=" + JSON.stringify(after.manifest.supportedstandards ?? []),
  );
}

main().catch((e) => {
  console.error("update error: " + mask(e?.message || String(e)));
  process.exit(1);
});
