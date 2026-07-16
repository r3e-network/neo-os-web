import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("../live_validate_redenvelope.mjs", import.meta.url),
);

test("Red Envelope live harness uses configured participants and proves conservation", () => {
  const source = readFileSync(scriptPath, "utf8");
  assert.match(source, /requireCredential\("NEO_TESTNET_WIF"/);
  assert.match(source, /requireCredential\("SIM_WIF_1"/);
  assert.match(source, /share1 \+ share2/);
  assert.match(source, /remaining === 0n/);
  assert.match(source, /bestLuck === maxShare/);
  assert.doesNotMatch(source, /new wallet\.Account\(\)/);
  assert.doesNotMatch(source, /fund-claimer/);
});
