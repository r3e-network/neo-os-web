import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("../live_validate_lastsurvivor.mjs", import.meta.url),
);

test("Last Survivor live harness verifies pull-payment settlement", () => {
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /SIM_WIF_1/);
  assert.match(source, /"buyKeys"/);
  assert.match(source, /event\(settleLog,\s*"RoundSettled"\)/);
  assert.match(source, /settle pushed GAS instead of crediting the winner/);
  assert.match(source, /hasGasTransferTo\(settleLog, accountB\.scriptHash\)/);
  assert.doesNotMatch(source, /bWalletAfter === bWalletBefore/);
  assert.match(source, /waitForRound/);
  assert.match(source, /fresh round .* did not become readable/);
  assert.match(source, /"withdraw"/);
  assert.doesNotMatch(source, /new wallet\.Account\(\)/);
  assert.doesNotMatch(source, /winnerDelta === pot/);
});
