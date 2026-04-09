#!/usr/bin/env node
/**
 * Fuzz Campaign: Contract Write Methods (Testnet Only)
 *
 * Fuzzes contract write methods with invalid inputs to verify they correctly
 * reject bad data. Uses a funded testnet WIF.
 *
 * SAFETY: Only runs on testnet. All calls use intentionally invalid inputs
 * that should be REJECTED by the contracts. If a call unexpectedly succeeds
 * with bad input, that's a finding.
 *
 * Usage: TEST_FUZZ_WIF=<testnet-wif> node test/fuzz/fuzz_contract_writes.mjs
 */
import { FuzzRunner } from "./lib/runner.mjs";
import { invokeRead, intParam, hashParam, strParam, boolParam } from "./lib/neo-rpc.mjs";
import { randomUInt160, randomBigInt, randomInt, BOUNDARY_INTS } from "./lib/rng.mjs";

import fs from "node:fs";
import path from "node:path";

const { getManifestContractHash } = await import("../../deploy/scripts/lib/neo_network.js");
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../..");

function appHash(manifestRel) {
  const fullPath = path.join(ROOT, manifestRel);
  if (!fs.existsSync(fullPath)) return "";
  const manifest = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  return getManifestContractHash(manifest, "testnet");
}

const WIF = process.env.TEST_FUZZ_WIF || process.env.TEST_SMOKE_ADMIN_WIF;
if (!WIF) {
  console.log("[fuzz] TEST_FUZZ_WIF not set. Skipping write fuzz.");
  process.exit(0);
}

const CONTRACTS = {
  dailyCheckin: appHash("apps/daily-checkin/neo-manifest.json"),
  lastSurvivor: appHash("apps/last-survivor/neo-manifest.json"),
  selfLoan: appHash("apps/self-loan/neo-manifest.json"),
  flashloan: appHash("apps/flashloan/neo-manifest.json"),
};

/**
 * Write-fuzz targets: calls that SHOULD fail.
 * Each test invokes a method with invalid args and verifies the VM FAULTs.
 * If the call unexpectedly HALTs, that's a finding (the contract accepted bad input).
 */
const writeTargets = [
  // Self-loan: zero collateral should fail
  {
    name: "selfLoan.createLoan(0 collateral)",
    contract: "selfLoan",
    method: "createLoan",
    args: () => [hashParam(randomUInt160()), intParam(0), intParam(1)],
    expectFault: true,
  },
  // Self-loan: invalid LTV tier should fail
  {
    name: "selfLoan.createLoan(invalid LTV tier)",
    contract: "selfLoan",
    method: "createLoan",
    args: () => [hashParam(randomUInt160()), intParam(1), intParam(99)],
    expectFault: true,
  },
  // Self-loan: repay non-existent loan
  {
    name: "selfLoan.repayDebt(nonexistent loan)",
    contract: "selfLoan",
    method: "repayDebt",
    args: () => [intParam(randomBigInt(99999n, 999999n)), hashParam(randomUInt160()), intParam(100)],
    expectFault: true,
  },
  // Flash loan: zero amount should fail
  {
    name: "flashloan.requestLoan(0 amount)",
    contract: "flashloan",
    method: "requestLoan",
    args: () => [hashParam(randomUInt160()), intParam(0), hashParam(randomUInt160()), strParam("callback")],
    expectFault: true,
  },
  // Last survivor: buy 0 keys should fail
  {
    name: "lastSurvivor.buyKeys(0)",
    contract: "lastSurvivor",
    method: "buyKeys",
    args: () => [hashParam(randomUInt160()), intParam(0)],
    expectFault: true,
  },
  // Daily checkin: checkin for random address (unauthorized)
  {
    name: "dailyCheckin.checkIn(unauthorized)",
    contract: "dailyCheckin",
    method: "checkIn",
    args: () => [hashParam(randomUInt160())],
    expectFault: true,
  },
];

const runner = new FuzzRunner("contract-writes-invalid", {
  iterations: writeTargets.length * 10,
});

await runner.run(async (i) => {
  const target = writeTargets[i % writeTargets.length];
  const hash = CONTRACTS[target.contract];
  if (!hash) return "skip";

  const args = target.args();

  // Use invokeRead (simulation) instead of actual broadcast — safer for fuzzing
  const result = await invokeRead(hash, target.method, args);

  if (target.expectFault && result.state !== "FAULT") {
    runner.finding(`${target.name}: expected FAULT but got ${result.state}`, {
      contract: target.contract,
      method: target.method,
      args: JSON.stringify(args),
      state: result.state,
      stack: JSON.stringify(result.stack?.slice(0, 2)),
    });
  }
});

if (runner.results.findings.length > 0) {
  console.log(`\n[fuzz] FINDINGS: ${runner.results.findings.length} — contracts accepted invalid input!`);
  process.exit(1);
} else {
  console.log(`\n[fuzz] All invalid inputs correctly rejected.`);
}
