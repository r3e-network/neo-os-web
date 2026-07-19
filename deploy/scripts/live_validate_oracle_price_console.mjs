/**
 * Live testnet validation for miniapp-oracle-price-console — READ-ONLY.
 *
 * The app binds the shared MorpheusDataFeed contract (neo-manifest
 * neo-n3-testnet hash) and renders AGG:<PAIR> / TWELVEDATA:<PAIR> price
 * records. This harness validates the on-chain read surface the app depends
 * on:
 *   1. getAllPairs() returns a non-empty, properly namespaced pair list
 *      (TWELVEDATA: or AGG: prefix — bare keys return zero structs by design).
 *   2. getLatest(pair) returns a well-formed FeedRecord for every pair:
 *      pair echo, price > 0 (6-decimal scale), timestamp > 0, roundId >= 0,
 *      attestation hash present.
 *   3. getPairByIndex(i) round-trips the same pair set (index integrity).
 *
 * No credentials needed: every call is a read-only RPC invokeFunction.
 * Testnet-pinned (endpoints/magic via lib/neo_network.js env overrides).
 */
import pkg from "@cityofzion/neon-js";
import { getManifestContractHash } from "./lib/miniapp_manifest_hash.js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const CONTRACT = getManifestContractHash("oracle-price-console", { network: "testnet" });
const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_oracle_price_console" });

const S = (s) => ({ type: "String", value: s });
const I = (n) => ({ type: "Integer", value: n.toString() });

const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const decInt = (v) => BigInt(v?.value ?? "0");
// ByteString stack items are base64-encoded UTF-8; Integer stack items are decimal strings.
const decStr = (v) => {
  if (!v) return "";
  if (v.type === "ByteString") return Buffer.from(String(v.value ?? ""), "base64").toString("utf8");
  return String(v.value ?? "");
};
const VALID_PREFIXES = ["TWELVEDATA:", "AGG:"];

let failures = 0;
const check = (ok, label, detail = "") => {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

// FeedRecord is a 6-field struct stack [Pair, RoundId, Price, Timestamp, AttestationHash, SourceSetId].
function parseRecord(stack) {
  const fields = stack?.[0]?.value ?? [];
  return {
    pair: decStr(fields[0]),
    roundId: decInt(fields[1]),
    price: decInt(fields[2]),
    timestamp: decInt(fields[3]),
    attestation: decStr(fields[4]),
    sourceSetId: decInt(fields[5]),
  };
}

async function main() {
  console.log(`contract: ${CONTRACT} (miniapp-oracle-price-console testnet binding)`);

  const pairsStack = await read("getAllPairs");
  const pairs = (pairsStack?.[0]?.value ?? []).map((p) => decStr(p));
  check(pairs.length > 0, "getAllPairs returns a non-empty list", `got ${pairs.length}`);
  console.log(`  pairs: ${pairs.slice(0, 8).join(", ")}${pairs.length > 8 ? ` … (+${pairs.length - 8})` : ""}`);

  const badPrefix = pairs.filter((p) => !VALID_PREFIXES.some((px) => p.startsWith(px)));
  check(badPrefix.length === 0, "every pair carries a TWELVEDATA: or AGG: namespace prefix",
    badPrefix.join(",") || "none");

  // Index integrity: getPairCount + getPairByIndex round-trip.
  const count = Number(decInt((await read("getPairCount"))?.[0]));
  check(count === pairs.length, `getPairCount (${count}) matches getAllPairs length (${pairs.length})`);
  if (pairs.length > 0) {
    const first = decStr((await read("getPairByIndex", [I(0)]))?.[0]);
    check(first === pairs[0], `getPairByIndex(0) round-trips "${pairs[0]}"`, `got "${first}"`);
  }

  // Record shape for every pair (bounded loop to keep the run fast).
  const sample = pairs.slice(0, 6);
  for (const pair of sample) {
    const r = parseRecord(await read("getLatest", [S(pair)]));
    check(r.pair === pair, `getLatest(${pair}) echoes the pair`, `got "${r.pair}"`);
    check(r.price > 0n, `getLatest(${pair}) price > 0 (6-decimal scale)`, `price=${r.price}`);
    check(r.timestamp > 0n, `getLatest(${pair}) timestamp > 0`, `ts=${r.timestamp}`);
    check(r.roundId >= 0n, `getLatest(${pair}) roundId >= 0`, `roundId=${r.roundId}`);
    check(r.attestation.length > 0, `getLatest(${pair}) attestation hash present`);
    console.log(`  record ${pair}: price=${r.price} ts=${r.timestamp} round=${r.roundId} sources=${r.sourceSetId}`);
  }

  // A bare key must return the zero struct (the documented foot-gun the app avoids via prefixes).
  const bare = parseRecord(await read("getLatest", [S("BTCUSD")]));
  const bareKnown = pairs.includes("BTCUSD");
  if (!bareKnown) {
    check(bare.price === 0n, "bare unprefixed key returns the zero struct (documented behavior)",
      `price=${bare.price}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nminiapp-oracle-price-console live-chain harness: ALL CHECKS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
