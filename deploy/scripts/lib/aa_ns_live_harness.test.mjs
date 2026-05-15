import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const LIVE_SCRIPT = path.join(ROOT, "deploy/scripts/live_validate_aa_ns_miniapps.js");
const NEO_NS_HOOK = path.join(ROOT, "apps/neo-ns/src/hooks/useNeoNS.ts");

test("AA/NeoNS live harness uses NeoNS address record type 16", () => {
  const source = fs.readFileSync(LIVE_SCRIPT, "utf8");

  assert.match(source, /NNS_RECORD_TYPE_ADDRESS\s*=\s*16/);
  assert.match(source, /ContractParam\.integer\(String\(NNS_RECORD_TYPE_ADDRESS\)\)/);
  assert.doesNotMatch(source, /ContractParam\.integer\("1"\)/);
});

test("NeoNS miniapp writes wallet targets as address records, not DNS A records", () => {
  const source = fs.readFileSync(NEO_NS_HOOK, "utf8");

  assert.match(source, /NNS_RECORD_TYPE_ADDRESS\s*=\s*16/);
  assert.match(source, /value:\s*String\(NNS_RECORD_TYPE_ADDRESS\)/);
  assert.doesNotMatch(source, /Type 1 is the "A" record \(Neo address as string\)/);
});

test("AA market live harness signs escrow flows for both market and AA core contracts", () => {
  const source = fs.readFileSync(LIVE_SCRIPT, "utf8");

  assert.match(source, /function buildMarketEscrowSigner/);
  assert.match(source, /scopes:\s*"CustomContracts"/);
  assert.match(source, /allowedcontracts:\s*\[HASHES\.aaMarket,\s*HASHES\.aaCore\]/);
  assert.match(source, /aaMarket,\s*"aa-market-hub\.createListing"[\s\S]*buildMarketEscrowSigner\(\)/);
});
