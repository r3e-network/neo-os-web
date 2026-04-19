#!/usr/bin/env node
/**
 * One-shot admin tx: align the mainnet Morpheus Oracle's
 * `oracleVerificationPublicKey` with the relayer key we actually hold
 * (and that Phala's TEE signs with). Without this, RNG fulfillRequest
 * txs fail with "invalid verification signature" because the on-chain
 * key was set to a key no longer in any of our local configs.
 *
 * Sender (admin): the oracle's admin address — currently equal to
 *   `oracle.updater()` => script-hash 3837f413063874e5c10cc9b19d4691ddf656066d
 *   address NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32, WIF in
 *   `${SIBLING_ORACLE}/deploy/phala/morpheus.mainnet.env`.
 *
 * Effect: changes the on-chain oracleVerificationPublicKey from
 *   03ca637032787820b38737090580c5e4013cbf34624b7d5510a36b92fb49d5b42a (orphaned)
 * to
 *   038c80a6a7fb694a78cdbf7eb91477cb0f7b6d372a5ca840b554c803fbc89c8769 (relayer/Phala-TEE)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const NEON_COMPAT_PATH = path.resolve(HERE, "../../../deploy/scripts/lib/neon-compat.mjs");
const Neon = (await import(NEON_COMPAT_PATH)).default;
const Account = Neon.wallet.Account;

const RPC = process.env.NEO_RPC_MAINNET || "https://mainnet2.neo.coz.io:443";
const NETWORK_MAGIC = 860833102;
const ORACLE_HASH = "0x017520f068fd602082fe5572596185e62a4ad991";
const NEW_VERIFY_PUBKEY = "038c80a6a7fb694a78cdbf7eb91477cb0f7b6d372a5ca840b554c803fbc89c8769";

const SIBLING_PHALA = path.resolve(process.env.HOME || "", "git/neo-morpheus-oracle/deploy/phala/morpheus.mainnet.env");

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const phala = loadEnv(SIBLING_PHALA);
const adminWif = phala.MORPHEUS_RELAYER_NEO_N3_WIF || phala.PHALA_NEO_N3_WIF;
if (!adminWif) {
  console.error("admin WIF not found in", SIBLING_PHALA);
  process.exit(1);
}
const admin = new Account(adminWif);
console.log(`[fix-verifier] admin address: ${admin.address}`);

async function main() {
  // Sanity: verify current key vs target
  const currentRes = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "invokefunction",
      params: [ORACLE_HASH, "oracleVerificationPublicKey", []],
    }),
  }).then((r) => r.json());
  const currentB64 = currentRes?.result?.stack?.[0]?.value || "";
  const currentHex = Buffer.from(currentB64, "base64").toString("hex");
  console.log(`[fix-verifier] current on-chain key: ${currentHex}`);
  console.log(`[fix-verifier] target key          : ${NEW_VERIFY_PUBKEY}`);
  if (currentHex.toLowerCase() === NEW_VERIFY_PUBKEY.toLowerCase()) {
    console.log("[fix-verifier] already aligned, no-op");
    return;
  }

  const oracle = new Neon.experimental.SmartContract(ORACLE_HASH, {
    rpcAddress: RPC,
    networkMagic: NETWORK_MAGIC,
    account: admin,
  });

  const txid = await oracle.invoke("setOracleVerificationPublicKey", [
    Neon.sc.ContractParam.publicKey(NEW_VERIFY_PUBKEY),
  ]);
  console.log(`[fix-verifier] tx submitted: ${txid}`);

  // Wait for inclusion + verify
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const verify = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "invokefunction",
        params: [ORACLE_HASH, "oracleVerificationPublicKey", []],
      }),
    }).then((r) => r.json());
    const verifyB64 = verify?.result?.stack?.[0]?.value || "";
    const verifyHex = Buffer.from(verifyB64, "base64").toString("hex");
    if (verifyHex.toLowerCase() === NEW_VERIFY_PUBKEY.toLowerCase()) {
      console.log(`[fix-verifier] confirmed on-chain after ${(i + 1) * 4}s: ${verifyHex}`);
      return;
    }
    process.stderr.write(`waiting (${(i + 1) * 4}s)…\n`);
  }
  console.error("[fix-verifier] tx didn't confirm within 120s");
  process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(2); });
