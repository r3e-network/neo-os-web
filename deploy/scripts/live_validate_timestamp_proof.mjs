/**
 * Live testnet validation for miniapp-timestamp-proof — WRITE path.
 *
 * The app anchors SHA-256 proof digests on-chain WITHOUT a contract: a GAS
 * self-transfer whose memo is `timestamp-proof:<64hex>`. Receipts are read
 * back by decoding the confirmed transaction's script and regex-matching the
 * anchor memo (apps/timestamp-proof/src/timestamp-proof-rpc.ts ANCHOR_RE).
 *
 * This harness performs the full anchor loop on testnet:
 *   1. anchor: operator sends a 1-base-unit GAS self-transfer with memo
 *      `timestamp-proof:<digest>` (deterministic digest of a fixed payload).
 *   2. confirm: the tx reaches HALT (invokeAndConfirm polls the app log).
 *   3. receipt: getrawtransaction → script bytes decode → the exact anchor
 *      memo is present, and block time is recorded (the app's receipt shape).
 *
 * Amount is negligible (1 base unit, self-to-self). No keys are printed.
 */
import pkg from "@cityofzion/neon-js";
import { createHash } from "node:crypto";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const account = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_timestamp_proof" });

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);

let failures = 0;
const check = (ok, label, detail = "") => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

async function main() {
  const payload = `timestamp-proof-harness:${Date.now()}`;
  const digest = createHash("sha256").update(payload).digest("hex");
  const memo = `timestamp-proof:${digest}`;
  console.log(`anchor memo: ${memo}`);

  const { txid } = await live.invokeAndConfirm({
    label: "anchor",
    account,
    scriptHash: GAS,
    operation: "transfer",
    args: [H(account.scriptHash), H(account.scriptHash), I(1), S(memo)],
  });
  check(Boolean(txid), `anchor tx confirmed (${String(txid).slice(0, 16)}…)`);

  // Receipt path: fetch the raw transaction and decode its script. N3 nodes
  // return `script` as base64 (some accept/return hex) — detect and decode.
  const raw = await live.client.getRawTransaction(String(txid), 1);
  const scriptField = String(raw?.script ?? "");
  check(scriptField.length > 0, "getrawtransaction returns a non-empty script");
  const scriptBytes = /^[0-9a-fA-F]+$/.test(scriptField)
    ? Buffer.from(scriptField, "hex")
    : Buffer.from(scriptField, "base64");
  const scriptText = new TextDecoder().decode(scriptBytes);
  check(scriptText.includes(memo), "script bytes decode to the exact anchor memo",
    scriptText.includes("timestamp-proof:") ? "anchor prefix present, digest mismatch" : "anchor prefix absent");

  const blockTime = Number(raw?.blocktime ?? raw?.block_time ?? 0);
  check(blockTime > 0, `receipt block time recorded (${blockTime})`);
  const confirmations = Number(raw?.confirmations ?? 0);
  check(confirmations >= 1, `receipt has >= 1 confirmation (${confirmations})`);

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nminiapp-timestamp-proof live-chain harness: ALL CHECKS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
