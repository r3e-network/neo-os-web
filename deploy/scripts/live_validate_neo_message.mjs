#!/usr/bin/env node
/**
 * Live validation for miniapp-neo-message (Neo X mainnet + Morpheus oracle).
 *
 * Default (no key): read-only smoke that proves the deployed system works —
 *   1. the oracle edge serves the X25519 public key, and
 *   2. the MiniAppMessageEVM contract is reachable and a previously time-locked
 *      message has been revealed on-chain (plaintext posted by the relayer).
 *
 * Full e2e (set NEO_MESSAGE_VALIDATE_KEY to a funded Neo X private key): send a
 * time-locked message to self, requestReveal after the unlock, and confirm the
 * relayer decrypts + posts the plaintext on-chain; plus a recipient-only send
 * decrypted back through the recipient-gated oracle lane.
 *
 * Run: node deploy/scripts/live_validate_neo_message.mjs
 */

import { ethers } from "ethers";

const RPC = process.env.NEOX_RPC || "https://mainnet-1.rpc.banelabs.org";
const CHAIN_ID = Number(process.env.NEOX_CHAIN_ID || 47763);
const MESSAGE = process.env.NEO_MESSAGE_CONTRACT || "0xd1906192c2308ae416aCDa96238cA846EBB83f15";
const EDGE = process.env.ORACLE_EDGE_BASE || "https://oracle.meshmini.app/mainnet";

const ABI = [
  "function sendMessage(address recipient, bytes envelope, uint64 unlockTime) returns (uint256)",
  "function requestReveal(uint256 id) returns (uint256)",
  "function getMessage(uint256 id) view returns (tuple(address sender,address recipient,bytes envelope,uint64 unlockTime,uint64 sentAt,bool revealed,string plaintext))",
  "event MessageSent(uint256 indexed id, address indexed sender, address indexed recipient, uint64 unlockTime, bool timeLocked)",
];

const subtle = globalThis.crypto.subtle;
const b64 = (b) => Buffer.from(b).toString("base64");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seal(pubB64, text) {
  const rp = new Uint8Array(Buffer.from(pubB64, "base64"));
  const rk = await subtle.importKey("raw", rp, { name: "X25519" }, false, []);
  const eph = await subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
  const epk = new Uint8Array(await subtle.exportKey("raw", eph.publicKey));
  const sh = new Uint8Array(await subtle.deriveBits({ name: "X25519", public: rk }, eph.privateKey, 256));
  const km = await subtle.importKey("raw", sh, "HKDF", false, ["deriveKey"]);
  const info = new Uint8Array([...Buffer.from("morpheus-confidential-payload-v2"), ...epk, ...rp]);
  const aes = await subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: rp, info },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const e = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(text)));
  return Buffer.from(
    JSON.stringify({
      v: 2,
      alg: "X25519-HKDF-SHA256-AES-256-GCM",
      epk: b64(epk),
      iv: b64(iv),
      ct: b64(e.slice(0, e.length - 16)),
      tag: b64(e.slice(e.length - 16)),
    }),
  ).toString("base64");
}

const revealStatement = (chainId, contract, id, issued) =>
  [
    "Morpheus Neo Message",
    "Recipient reveal request",
    `chain: ${chainId}`,
    `contract: ${contract.toLowerCase()}`,
    `message: ${id}`,
    `issued: ${issued}`,
  ].join("\n");

async function getOraclePublicKey() {
  const res = await fetch(`${EDGE}/oracle/public-key`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`oracle public-key ${res.status}`);
  const body = await res.json();
  if (!body.public_key) throw new Error("no public_key");
  return body.public_key;
}

async function readOnlySmoke(provider) {
  const c = new ethers.Contract(MESSAGE, ABI, provider);
  const pk = await getOraclePublicKey();
  console.log("[ok] oracle public key:", pk.slice(0, 16) + "…");

  // Message #4 was the validation time-locked message; the relayer revealed it.
  const m = await c.getMessage(4);
  if (!m.revealed || !m.plaintext) {
    throw new Error("expected message #4 to be revealed on-chain with plaintext");
  }
  console.log("[ok] time-locked message #4 revealed on-chain:", JSON.stringify(m.plaintext).slice(0, 60));
  console.log("[PASS] read-only smoke (oracle + contract reachable, prior reveal confirmed)");
}

async function fullE2E(provider, key) {
  const wallet = new ethers.Wallet(key, provider);
  const c = new ethers.Contract(MESSAGE, ABI, wallet);
  const pk = await getOraclePublicKey();

  // ── time-locked ──────────────────────────────────────────────────────────
  const chainNow = (await provider.getBlock("latest")).timestamp;
  const secret = `live-validate timelock @ ${new Date().toISOString()}`;
  const envelope = ethers.toUtf8Bytes(await seal(pk, secret));
  const unlock = chainNow + 30;
  let r = await (await c.sendMessage(ethers.ZeroAddress, envelope, unlock)).wait();
  let id;
  for (const lg of r.logs) {
    try {
      const e = c.interface.parseLog(lg);
      if (e?.name === "MessageSent") id = e.args.id;
    } catch {}
  }
  console.log(`[..] time-locked msg ${id} sent; waiting for chain clock past unlock`);
  for (let i = 0; i < 30; i += 1) {
    if ((await provider.getBlock("latest")).timestamp >= unlock + 6) break;
    await sleep(4000);
  }
  await (await c.requestReveal(id)).wait();
  let revealed = false;
  for (let i = 0; i < 36; i += 1) {
    await sleep(5000);
    const m = await c.getMessage(id);
    if (m.revealed) {
      if (m.plaintext !== secret) throw new Error("revealed plaintext mismatch");
      revealed = true;
      break;
    }
  }
  if (!revealed) throw new Error("time-locked reveal did not complete in time");
  console.log("[ok] time-locked reveal posted matching plaintext on-chain");

  // ── recipient-only ─────────────────────────────────────────────────────────
  const rSecret = `live-validate recipient-only @ ${new Date().toISOString()}`;
  const rEnvelope = ethers.toUtf8Bytes(await seal(pk, rSecret));
  r = await (await c.sendMessage(wallet.address, rEnvelope, 0)).wait();
  let rid;
  for (const lg of r.logs) {
    try {
      const e = c.interface.parseLog(lg);
      if (e?.name === "MessageSent") rid = e.args.id;
    } catch {}
  }
  const issued = Math.floor(Date.now() / 1000);
  const signature = await wallet.signMessage(revealStatement(CHAIN_ID, MESSAGE, rid.toString(), issued));
  const res = await fetch(`${EDGE}/oracle/message-reveal`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ chain: "neox", messageId: rid.toString(), signature, issuedAt: issued }),
  });
  const body = await res.json();
  if (!res.ok || body.plaintext !== rSecret) {
    throw new Error(`recipient reveal failed: ${res.status} ${JSON.stringify(body).slice(0, 120)}`);
  }
  console.log("[ok] recipient-only reveal returned exact plaintext (off-chain)");
  console.log("[PASS] full Neo Message e2e (time-locked + recipient-only)");
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
  const key = process.env.NEO_MESSAGE_VALIDATE_KEY;
  if (key) {
    await fullE2E(provider, key);
  } else {
    await readOnlySmoke(provider);
    console.log("(set NEO_MESSAGE_VALIDATE_KEY=<funded neox key> to run the full send+reveal e2e)");
  }
}

main().catch((e) => {
  console.error("[FAIL]", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
