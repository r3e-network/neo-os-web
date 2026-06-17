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
import path from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "@cityofzion/neon-js";
import { writebackDeployedHash } from "./lib/manifest_hash_writeback.mjs";
import {
  buildMiniAppContractRegistry,
  renderGeneratedTs,
  generatedTargetPath,
} from "../../scripts/generate-miniapp-contract-registry.mjs";
const { sc, wallet, rpc, experimental } = pkg;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** --app <id|slug> flags (repeatable) plus MINIAPP_DEPLOY_APP_IDS (comma/space). */
function explicitDeployTargets() {
  const targets = [];
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === "--app" && process.argv[i + 1]) targets.push(process.argv[i + 1]);
  }
  for (const value of String(process.env.MINIAPP_DEPLOY_APP_IDS || "").split(/[\s,]+/)) {
    if (value.trim()) targets.push(value.trim());
  }
  return targets;
}

/**
 * Write the deployed hash into the owning app manifest(s) and re-run the registry
 * generator so the committed registry never drifts from a fresh deploy. Idempotent:
 * re-deploying the same hash is a no-op write. Guarded by the caller behind the
 * apply/confirm gates. Set MINIAPP_DEPLOY_SKIP_WRITEBACK=1 to skip.
 */
function syncManifestsAndRegistry(hash) {
  if (process.env.MINIAPP_DEPLOY_SKIP_WRITEBACK === "1") {
    console.log("writeback skipped (MINIAPP_DEPLOY_SKIP_WRITEBACK=1)");
    return;
  }
  let report;
  try {
    report = writebackDeployedHash({
      repoRoot: REPO_ROOT,
      network: "mainnet",
      hash,
      explicitTargets: explicitDeployTargets(),
    });
  } catch (error) {
    console.log("writeback ERROR: " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 6;
    return;
  }

  if (report.targets === 0) {
    console.log(
      "writeback: no app manifest references " + hash +
      " — pass --app <id|slug> (or MINIAPP_DEPLOY_APP_IDS) for a new contract",
    );
    return;
  }
  if (report.written.length === 0) {
    console.log("writeback: manifests already at " + hash + " (no change)");
  } else {
    for (const entry of report.written) {
      console.log("writeback: updated " + entry.slug + " -> " + entry.changes.join(", "));
    }
  }
  regenerateRegistry();
}

function regenerateRegistry() {
  try {
    const registry = buildMiniAppContractRegistry({ repoRoot: REPO_ROOT });
    const targetPath = generatedTargetPath(REPO_ROOT);
    fs.writeFileSync(targetPath, renderGeneratedTs(registry), "utf8");
    const counts = "mainnet=" + Object.keys(registry.mainnet).length + ", testnet=" + Object.keys(registry.testnet).length;
    console.log("registry: regenerated " + path.relative(REPO_ROOT, targetPath) + " (" + counts + ")");
  } catch (error) {
    console.log("registry generator FAILED: " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 7;
  }
}

const MAINNET_RPC = process.env.NEO_MAINNET_RPC_URL || "https://mainnet1.neo.coz.io:443";
const MAINNET_MAGIC = Number(process.env.NEO_MAINNET_MAGIC || 860833102);

// Positional args, skipping `--app <value>` flag pairs so writeback targeting
// can be passed alongside <nef> <manifest> [expectedHash] in any order.
const positionals = [];
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i] === "--app") { i += 1; continue; }
  positionals.push(process.argv[i]);
}
const nefPath = positionals[0];
const manifestPath = positionals[1];
const expectedHash = (positionals[2] || "").toLowerCase();
if (!nefPath || !manifestPath) {
  console.error("usage: deploy_contract_mainnet.mjs <nef> <manifest> [expectedHash] [--app <id|slug>]");
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
        syncManifestsAndRegistry(expectedHash);
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
    syncManifestsAndRegistry(r.hash);
  } else if (r.fault) {
    console.log("DEPLOY FAULTED: " + JSON.stringify(r.fault));
    process.exit(5);
  } else {
    console.log("sent but not confirmed within timeout; txid " + result);
  }
}

main().catch((e) => { console.error("deploy error: " + mask(e?.message || String(e))); process.exit(1); });
