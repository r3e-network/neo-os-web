import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL(
    "../../../apps/aa-market-hub/src/utils/aa-market.ts",
    import.meta.url,
  ),
  "utf8",
);

test("AA Market Hub buy flow batches GAS transfer before settleListing", () => {
  const buyFlow = source.match(
    /export async function buyAddressListing[\s\S]*?export async function refundPendingAddressPurchase/,
  )?.[0];

  assert.ok(buyFlow, "buyAddressListing source should be present");
  assert.match(buyFlow, /wallet\.invokeMultiple\(/);
  assert.match(
    buyFlow,
    /operation:\s*"transfer"[\s\S]*operation:\s*"settleListing"/,
  );
  assert.match(buyFlow, /scriptHash:\s*GAS_HASH/);
  assert.match(buyFlow, /value:\s*String\(listing\.priceRaw\)/);
});

test("AA Market Hub refund passes listing id and payer Hash160", () => {
  const refundFlow = source.match(
    /export async function refundPendingAddressPurchase[\s\S]*$/,
  )?.[0];

  assert.ok(
    refundFlow,
    "refundPendingAddressPurchase source should be present",
  );
  assert.match(
    refundFlow,
    /const payerHash = normalizeHash160Input\(address, "Payer"\)/,
  );
  assert.match(refundFlow, /operation:\s*"refundPendingPayment"/);
  assert.match(refundFlow, /type:\s*"Integer", value:\s*String\(listingId\)/);
  assert.match(
    refundFlow,
    /type:\s*"Hash160", value:\s*normalizeScriptHash\(payerHash\)/,
  );
});
