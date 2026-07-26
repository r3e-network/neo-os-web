import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("../live_validate_gasbox.mjs", import.meta.url),
);

test("GasBox live harness follows the standalone contract lifecycle", () => {
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /getManifestContractHash\("gasbox"/);
  for (const operation of [
    "createMachine",
    "addItem",
    "setActive",
    "pull",
    "withdrawRevenue",
  ]) {
    assert.match(source, new RegExp(`"${operation}"`));
  }
  for (const eventName of [
    "MachineCreated",
    "PrizePoolFunded",
    "PlayCredited",
    "Pulled",
    "RevenueWithdrawn",
  ]) {
    assert.match(source, new RegExp(`"${eventName}"`));
  }
  assert.match(source, /miniapp-gasbox-pool:/);
  assert.match(source, /miniapp-gasbox:play/);
  assert.doesNotMatch(source, /createGachaMachine|pullGacha|resolveGachaPull/);
  assert.doesNotMatch(source, /new wallet\.Account\(\)/);
});
