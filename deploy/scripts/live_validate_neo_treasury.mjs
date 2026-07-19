/**
 * Live testnet validation for miniapp-neo-treasury — WRITE path.
 *
 * The app is a treasury disbursement tool WITHOUT its own contract: it
 * builds NEP-17 transfer intents (GAS/NEO + memo) and reconciles settlements
 * by reading the NEP-17 transfer index (apps/shared/utils/n3index.ts
 * getNep17Transfers — the same read path this harness uses).
 *
 * Loop:
 *   1. disburse: operator sends a 1-base-unit GAS self-transfer with a
 *      treasury-style memo `treasury-disburse:<digest>`.
 *   2. confirm: HALT via invokeAndConfirm.
 *   3. reconcile: poll the NEP-17 transfer index until the record appears
 *      (indexer lag tolerant), then assert asset/amount/from/to/memo all
 *      match the disbursement — the app's settlement-binding semantics.
 *
 * Amount negligible (self-to-self). No keys printed.
 */
import pkg from "@cityofzion/neon-js";
import { createHash } from "node:crypto";
import { requireCredential } from "./lib/live_credentials.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const { sc, wallet } = pkg;

const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const N3INDEX_REST = "https://api.n3index.dev/rest/v1/nep17_transfers";
const account = new wallet.Account(requireCredential("NEO_TESTNET_WIF", process.env.NEO_TESTNET_WIF));
const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_neo_treasury" });

const H = (a) => sc.ContractParam.hash160(a);
const I = (n) => sc.ContractParam.integer(n.toString());
const S = (s) => sc.ContractParam.string(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The app's read path (apps/shared/utils/n3index.ts getNep17Transfers), inlined
// to keep this harness free of the vite alias graph.
async function queryNep17ByTxid(txid) {
  const url = `${N3INDEX_REST}?network=eq.testnet&txid=eq.${encodeURIComponent(txid)}&limit=5`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`n3index ${res.status}`);
  return res.json();
}

let failures = 0;
const check = (ok, label, detail = "") => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

function fieldText(record, names) {
  for (const name of names) {
    const v = record?.[name];
    if (typeof v === "string" && v) return v;
  }
  return "";
}

async function main() {
  const digest = createHash("sha256").update(`treasury-harness:${Date.now()}`).digest("hex");
  const memo = `treasury-disburse:${digest}`;
  console.log(`disburse memo: ${memo}`);

  const { txid } = await live.invokeAndConfirm({
    label: "disburse",
    account,
    scriptHash: GAS,
    operation: "transfer",
    args: [H(account.scriptHash), H(account.scriptHash), I(1), S(memo)],
  });
  check(Boolean(txid), `disburse tx confirmed (${String(txid).slice(0, 16)}…)`);

  // Reconcile via the NEP-17 transfer index (poll for indexer lag).
  let record = null;
  for (let attempt = 0; attempt < 20 && !record; attempt++) {
    await sleep(3000);
    try {
      const rows = await queryNep17ByTxid(String(txid));
      record = (rows ?? []).find((r) => String(r?.txid ?? "").toLowerCase() === String(txid).toLowerCase()) ?? null;
    } catch (err) {
      console.log(`  indexer poll ${attempt + 1}: ${String(err?.message ?? err).slice(0, 60)}`);
    }
  }
  check(Boolean(record), "NEP-17 transfer record indexed for the disburse tx");
  if (record) {
    const asset = String(record?.contract_hash ?? "").toLowerCase();
    check(asset === GAS, `record asset is GAS`, asset);
    check(fieldText(record, ["amount_raw", "amount_text"]) === "1", `record amount is 1 base unit`,
      fieldText(record, ["amount_raw"]));
    check(String(record?.from_address ?? "") === account.address,
      `record from_address is the operator`, String(record?.from_address ?? ""));
    check(String(record?.to_address ?? "") === account.address,
      `record to_address is the operator`, String(record?.to_address ?? ""));
    console.log(`  reconciled: block ${record?.block_index}, amount_raw ${record?.amount_raw}, ${record?.from_address} → ${record?.to_address}`);
  }

  // The memo lives in the tx script (NEP-17 events carry no memo): verify it there.
  const raw = await live.client.getRawTransaction(String(txid), 1);
  const scriptField = String(raw?.script ?? "");
  const scriptBytes = /^[0-9a-fA-F]+$/.test(scriptField)
    ? Buffer.from(scriptField, "hex")
    : Buffer.from(scriptField, "base64");
  const scriptText = new TextDecoder().decode(scriptBytes);
  check(scriptText.includes(memo), "tx script carries the exact disburse memo",
    scriptText.includes("treasury-disburse:") ? "prefix present, digest mismatch" : "prefix absent");

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nminiapp-neo-treasury live-chain harness: ALL CHECKS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
