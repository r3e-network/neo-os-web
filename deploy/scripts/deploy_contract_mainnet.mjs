/**
 * Single-contract MAINNET deploy via neon-js. Deliberately separate from the
 * testnet-pinned script so a mainnet deploy can never happen by accident.
 *
 * Requires BOTH gates to actually send:
 *   MAINNET_DEPLOY_CONFIRM=YES  and  DEPLOY_APPLY=1
 *
 * Usage:
 *   MAINNET_DEPLOY_CONFIRM=YES DEPLOY_APPLY=1 NEO_TESTNET_WIF=... \
 *     node deploy/scripts/deploy_contract_mainnet.mjs <nef> <manifest> [expectedHash]
 *
 * Never prints the WIF. Extracts the REAL deployed hash from the Deploy
 * notification (getContractHash is unreliable) and, if an expectedHash is
 * given, asserts the deploy landed at exactly that hash.
 */
import fs from "node:fs";
import https from "node:https";
import pkg from "@cityofzion/neon-js";
const { sc, wallet, rpc, experimental } = pkg;

const MAINNET_RPC = process.env.NEO_MAINNET_RPC_URL || "https://mainnet1.neo.coz.io:443";
const MAINNET_MAGIC = Number(process.env.NEO_MAINNET_MAGIC || 860833102);

const nefPath = process.argv[2];
const manifestPath = process.argv[3];
const expectedHash = (process.argv[4] || "").toLowerCase();
if (!nefPath || !manifestPath) {
  console.error("usage: deploy_contract_mainnet.mjs <nef> <manifest> [expectedHash]");
  process.exit(2);
}
const wif = process.env.NEO_TESTNET_WIF || process.env.MINIAPP_DEPLOY_WIF;
if (!wif) { console.error("no deployer WIF in env"); process.exit(2); }

function mask(s) { return String(s).replace(/\b[KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "***WIF***"); }

function rpcCall(method, params) {
  return new Promise((res, rej) => {
    const body = JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 });
    const u = new URL(MAINNET_RPC);
    const r = https.request({ hostname: u.hostname, port: u.port || 443, path: u.pathname || "/", method: "POST", headers: { "Content-Type": "application/json" } },
      (rs) => { let d = ""; rs.on("data", (c) => d += c); rs.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); });
    r.on("error", rej); r.write(body); r.end();
  });
}

async function realHashFromDeploy(txid) {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    try {
      const j = await rpcCall("getapplicationlog", [txid]);
      const ex = j.result?.executions?.[0];
      if (!ex) continue;
      if (ex.vmstate !== "HALT") return { fault: ex.exception };
      const dep = (ex.notifications || []).find((n) => n.eventname === "Deploy");
      if (dep) return { hash: "0x" + Buffer.from(dep.state.value[0].value, "base64").reverse().toString("hex") };
      return { halt: true };
    } catch { /* not indexed */ }
  }
  return { pending: true };
}

async function main() {
  const account = new wallet.Account(wif);
  const nef = sc.NEF.fromBuffer(fs.readFileSync(nefPath));
  const manifest = sc.ContractManifest.fromJson(JSON.parse(fs.readFileSync(manifestPath, "utf8")));

  console.log("network        : MAINNET (magic " + MAINNET_MAGIC + ")");
  console.log("rpc            : " + MAINNET_RPC);
  console.log("deployer addr  : " + account.address);
  console.log("contract       : " + manifest.name);
  if (expectedHash) console.log("expected hash  : " + expectedHash);

  // Idempotent: if the expected hash already exists on mainnet, skip.
  if (expectedHash) {
    try {
      const st = await rpcCall("getcontractstate", [expectedHash]);
      if (st.result && st.result.hash) {
        console.log("ALREADY DEPLOYED at " + expectedHash + " (id " + st.result.id + ") — skipping");
        console.log("RESULT_HASH=" + expectedHash);
        return;
      }
    } catch { /* proceed */ }
  }

  if (process.env.MAINNET_DEPLOY_CONFIRM !== "YES" || process.env.DEPLOY_APPLY !== "1") {
    console.log("DRY RUN — set MAINNET_DEPLOY_CONFIRM=YES and DEPLOY_APPLY=1 to send");
    return;
  }

  console.log("sending MAINNET deploy transaction…");
  const result = await experimental.deployContract(nef, manifest, {
    account, rpcAddress: MAINNET_RPC, networkMagic: MAINNET_MAGIC,
  });
  console.log("deploy txid    : " + result);
  const r = await realHashFromDeploy(result);
  if (r.hash) {
    console.log("vm state       : HALT");
    console.log("DEPLOYED ✓  hash=" + r.hash);
    if (expectedHash && r.hash.toLowerCase() !== expectedHash) {
      console.log("⚠️  HASH MISMATCH: expected " + expectedHash + " got " + r.hash);
      process.exit(4);
    }
    console.log("RESULT_HASH=" + r.hash);
  } else if (r.fault) {
    console.log("DEPLOY FAULTED: " + JSON.stringify(r.fault));
    process.exit(5);
  } else {
    console.log("sent but not confirmed within timeout; txid " + result);
  }
}

main().catch((e) => { console.error("deploy error: " + mask(e?.message || String(e))); process.exit(1); });
