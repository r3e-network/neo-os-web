/**
 * Single-contract deploy via neon-js (fallback when the Go deploy tooling /
 * `go` runtime is unavailable). TESTNET-PINNED by default.
 *
 * Usage:
 *   NEO_TESTNET_WIF=... node deploy/scripts/deploy_contract_neonjs.mjs \
 *     contracts/build/MiniAppMultisig.nef contracts/build/MiniAppMultisig.manifest.json
 *
 * Never prints the WIF. Pins testnet RPC + magic so a mainnet NEO_RPC_URL in
 * .env cannot cause an accidental mainnet deploy.
 */
import fs from "node:fs";
import pkg from "@cityofzion/neon-js";
const { sc, wallet, rpc, experimental } = pkg;

const TESTNET_RPC = process.env.NEO_TESTNET_RPC_URL || "https://testnet1.neo.coz.io:443";
const TESTNET_MAGIC = Number(process.env.NEO_TESTNET_MAGIC || 894710606);

const nefPath = process.argv[2];
const manifestPath = process.argv[3];
if (!nefPath || !manifestPath) {
  console.error("usage: deploy_contract_neonjs.mjs <nef> <manifest>");
  process.exit(2);
}

const wif = process.env.NEO_TESTNET_WIF || process.env.MINIAPP_TESTNET_DEPLOY_WIF || process.env.MINIAPP_DEPLOY_WIF;
if (!wif) {
  console.error("no testnet deployer WIF in env (NEO_TESTNET_WIF / MINIAPP_DEPLOY_WIF)");
  process.exit(2);
}

function mask(s) {
  return String(s).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***");
}

async function main() {
  const account = new wallet.Account(wif);
  const nef = sc.NEF.fromBuffer(fs.readFileSync(nefPath));
  const manifest = sc.ContractManifest.fromJson(JSON.parse(fs.readFileSync(manifestPath, "utf8")));

  const expectedHash = experimental.getContractHash(
    account.scriptHash,
    nef.checksum,
    manifest.name,
  );

  console.log("network        : TESTNET (magic " + TESTNET_MAGIC + ")");
  console.log("rpc            : " + TESTNET_RPC);
  console.log("deployer addr  : " + account.address);
  console.log("contract       : " + manifest.name);
  console.log("expected hash  : 0x" + expectedHash);

  const client = new rpc.RPCClient(TESTNET_RPC);

  // Pre-flight: confirm GAS balance can cover the deploy (~10 GAS).
  const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
  try {
    const res = await client.invokeFunction(GAS, "balanceOf", [
      { type: "Hash160", value: account.scriptHash },
    ]);
    const bal = BigInt(res.stack?.[0]?.value ?? "0");
    const gas = Number(bal) / 1e8;
    console.log("deployer GAS   : " + gas.toFixed(4));
    if (gas < 10.5) {
      console.error("INSUFFICIENT GAS: deploy needs ~10 GAS; have " + gas.toFixed(4));
      process.exit(3);
    }
  } catch (e) {
    console.error("balance check failed: " + mask(e.message || e));
  }

  // Is it already deployed at the expected hash? (idempotent re-run)
  try {
    const state = await client.getContractState("0x" + expectedHash);
    if (state && state.hash) {
      console.log("ALREADY DEPLOYED at 0x" + expectedHash + " (id " + state.id + ") — skipping");
      console.log("RESULT_HASH=0x" + expectedHash);
      return;
    }
  } catch {
    /* not deployed yet — proceed */
  }

  if (process.env.DEPLOY_APPLY !== "1") {
    console.log("DRY RUN (set DEPLOY_APPLY=1 to send the deploy transaction)");
    return;
  }

  console.log("sending deploy transaction…");
  const config = {
    account,
    rpcAddress: TESTNET_RPC,
    networkMagic: TESTNET_MAGIC,
    networkFeeOverride: undefined,
  };
  const result = await experimental.deployContract(nef, manifest, config);
  console.log("deploy txid    : " + result);

  // Poll for confirmation. The authoritative contract hash comes from the
  // ContractManagement Deploy notification (the local prediction has been
  // observed to disagree with the node's computation).
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    try {
      const log = await client.getApplicationLog(result);
      const execution = log.executions?.[0];
      const vmstate = execution?.vmstate;
      console.log("vm state       : " + vmstate);
      if (vmstate === "HALT") {
        const deployNote = (execution.notifications || []).find((n) => n.eventname === "Deploy");
        const raw = deployNote?.state?.value?.[0]?.value;
        const actualHash = raw
          ? "0x" + Buffer.from(raw, "base64").toString("hex").match(/../g).reverse().join("")
          : "0x" + expectedHash;
        if (actualHash !== "0x" + expectedHash) {
          console.log("note: actual hash differs from the local prediction (0x" + expectedHash + ")");
        }
        console.log("DEPLOYED ✓  hash=" + actualHash);
        console.log("RESULT_HASH=" + actualHash);
      } else {
        console.log("DEPLOY FAULTED: " + JSON.stringify(execution?.exception));
      }
      return;
    } catch {
      /* not yet indexed */
    }
  }
  console.log("deploy sent but not confirmed within timeout; check txid " + result);
}

main().catch((e) => {
  console.error("deploy error: " + mask(e?.message || String(e)));
  process.exit(1);
});
