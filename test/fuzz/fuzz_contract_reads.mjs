#!/usr/bin/env node
/**
 * Fuzz Campaign: Contract Read Methods
 *
 * Fuzzes all flagship contract read methods with random inputs.
 * Read-only calls cannot change state, so this is safe to run continuously.
 * Checks: no VM FAULTs on valid-shaped inputs, graceful handling of invalid inputs.
 */
import { FuzzRunner } from "./lib/runner.mjs";
import { invokeRead, intParam, hashParam, strParam } from "./lib/neo-rpc.mjs";
import { randomUInt160, randomBigInt, randomChoice, randomString, BOUNDARY_INTS } from "./lib/rng.mjs";

import fs from "node:fs";
import path from "node:path";

const { getManifestContractHash, getNetworkConfig } = await import("../../deploy/scripts/lib/neo_network.js");
const NETWORK = getNetworkConfig("testnet");
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../..");

function appHash(manifestRel) {
  const fullPath = path.join(ROOT, manifestRel);
  if (!fs.existsSync(fullPath)) return "";
  const manifest = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  return getManifestContractHash(manifest, "testnet");
}

const CONTRACTS = {
  dailyCheckin: appHash("apps/daily-checkin/neo-manifest.json"),
  lastSurvivor: appHash("apps/last-survivor/neo-manifest.json"),
  gasBox: appHash("apps/gasbox/neo-manifest.json"),
  selfLoan: appHash("apps/self-loan/neo-manifest.json"),
  flashloan: appHash("apps/flashloan/neo-manifest.json"),
  redEnvelope: appHash("apps/red-envelope/neo-manifest.json"),
  neoPay: appHash("apps/neo-pay/neo-manifest.json"),
};

// Filter out contracts that aren't deployed
const deployed = Object.entries(CONTRACTS).filter(([, hash]) => hash);
if (deployed.length === 0) {
  console.log("[fuzz] No testnet contracts found in manifest. Exiting.");
  process.exit(0);
}

console.log(`[fuzz] Found ${deployed.length} deployed contracts`);

/** Fuzz target: read methods with random IDs */
const readMethods = [
  { contract: "dailyCheckin", methods: ["totalCheckins", "totalUsers", "totalRewarded"] },
  { contract: "lastSurvivor", methods: ["currentRoundId", "totalKeysSold", "totalPotDistributed", "totalPlayers"] },
  { contract: "gasBox", methods: ["totalMachines"] },
  { contract: "selfLoan", methods: ["totalLoans", "totalCollateral", "totalDebt", "totalBorrowers"] },
  { contract: "flashloan", methods: ["getLoanCount", "getTotalBorrowed", "getTotalFees"] },
  { contract: "neoPay", methods: ["totalStreams"] },
];

/** Fuzz target: parameterized read methods */
const paramReadMethods = [
  { contract: "dailyCheckin", method: "getCheckInStateForFrontend", argGen: () => [hashParam(randomUInt160())] },
  { contract: "lastSurvivor", method: "getRound", argGen: () => [intParam(randomBigInt(0n, 1000n))] },
  { contract: "lastSurvivor", method: "getPlayerStats", argGen: () => [hashParam(randomUInt160())] },
  { contract: "selfLoan", method: "getLoanDetails", argGen: () => [intParam(randomBigInt(0n, 100n))] },
  { contract: "selfLoan", method: "getHealthFactor", argGen: () => [intParam(randomBigInt(0n, 100n))] },
  { contract: "flashloan", method: "getLoan", argGen: () => [intParam(randomBigInt(0n, 100n))] },
  { contract: "neoPay", method: "getStreamDetails", argGen: () => [intParam(randomBigInt(0n, 100n))] },
];

// --- Campaign 1: Zero-arg read methods should never FAULT ---
const runner1 = new FuzzRunner("contract-reads-noarg", { iterations: deployed.length * 3 });
await runner1.run(async (i) => {
  const target = readMethods[i % readMethods.length];
  const hash = CONTRACTS[target.contract];
  if (!hash) return "skip";

  const method = randomChoice(target.methods);
  const result = await invokeRead(hash, method, []);

  if (result.state === "FAULT") {
    runner1.finding(`${target.contract}.${method}() FAULTed with no args`, {
      contract: target.contract, method, exception: result.exception,
    });
  }
});

// --- Campaign 2: Parameterized reads with random inputs ---
const runner2 = new FuzzRunner("contract-reads-param", { iterations: 200 });
await runner2.run(async (i) => {
  const target = randomChoice(paramReadMethods);
  const hash = CONTRACTS[target.contract];
  if (!hash) return "skip";

  const args = target.argGen();
  const result = await invokeRead(hash, target.method, args);

  // HALT is expected (returns empty/default for non-existent IDs)
  // FAULT is acceptable for truly invalid inputs but worth logging
  if (result.state === "FAULT" && result.exception && !result.exception.includes("not found")) {
    runner2.finding(`${target.contract}.${target.method}() unexpected FAULT`, {
      contract: target.contract, method: target.method,
      args: JSON.stringify(args), exception: result.exception,
    });
  }
});

// --- Campaign 3: Boundary value reads ---
const runner3 = new FuzzRunner("contract-reads-boundary", { iterations: BOUNDARY_INTS.length * paramReadMethods.length });
await runner3.run(async (i) => {
  const boundaryVal = BOUNDARY_INTS[i % BOUNDARY_INTS.length];
  const target = paramReadMethods[Math.floor(i / BOUNDARY_INTS.length) % paramReadMethods.length];
  const hash = CONTRACTS[target.contract];
  if (!hash) return "skip";

  // Override the first arg with boundary value
  const args = [intParam(boundaryVal)];
  const result = await invokeRead(hash, target.method, args);

  if (result.state === "FAULT" && result.exception?.includes("overflow")) {
    runner3.finding(`${target.contract}.${target.method}() overflow with ${boundaryVal}`, {
      contract: target.contract, method: target.method, boundaryVal: String(boundaryVal),
    });
  }
});

// --- Summary ---
const allFindings = [
  ...runner1.results.findings,
  ...runner2.results.findings,
  ...runner3.results.findings,
];

if (allFindings.length > 0) {
  console.log(`\n[fuzz] TOTAL FINDINGS: ${allFindings.length}`);
  process.exit(1);
} else {
  console.log(`\n[fuzz] All campaigns clean.`);
}
