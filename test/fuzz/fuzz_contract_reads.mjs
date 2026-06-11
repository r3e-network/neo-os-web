#!/usr/bin/env node
/**
 * Fuzz Campaign: Contract Read Methods
 *
 * Fuzzes the self-contained miniapp contracts' read methods with random
 * inputs. Read-only calls cannot change state, so this is safe to run
 * continuously. Checks: no VM FAULTs on valid-shaped inputs, graceful
 * handling of invalid inputs.
 *
 * Grounding (MP-W3-06): contract hashes resolve from apps/<slug>/
 * neo-manifest.json; every method below is validated against
 * contracts/build/<C>.manifest.json before any live call ("ABI drift" fails
 * fast). FUZZ_DRY_RUN=1 / --dry-run prints the plan and exits offline.
 *
 * NOTE: daily-checkin, flashloan and neo-pay have no committed compiled ABI
 * under contracts/build/, so they cannot be ABI-gated here; their behavior is
 * covered by the live validator harnesses instead.
 */
import { FuzzRunner } from "./lib/runner.mjs";
import { invokeRead, intParam, hashParam } from "./lib/neo-rpc.mjs";
import { randomUInt160, randomBigInt, randomChoice, BOUNDARY_INTS } from "./lib/rng.mjs";
import { resolveFuzzTargets, enforceAbiOrExit } from "./lib/abi.mjs";

const TARGETS = resolveFuzzTargets({
  redEnvelope: { appSlug: "red-envelope", contractName: "MiniAppRedEnvelope" },
  lastSurvivor: { appSlug: "last-survivor", contractName: "MiniAppLastSurvivor" },
  timeCapsule: { appSlug: "time-capsule", contractName: "MiniAppTimeCapsule" },
  tarot: { appSlug: "on-chain-tarot", contractName: "MiniAppTarot" },
  breakupPact: { appSlug: "breakup-contract", contractName: "MiniAppBreakupPact" },
  coinFlip: { appSlug: "fogplay", contractName: "MiniAppCoinFlip" },
  selfLoan: { appSlug: "self-loan", contractName: "MiniAppSelfLoan" },
  gasBox: { appSlug: "gasbox", contractName: "MiniAppGasBox" },
  govMerc: { appSlug: "gov-merc", contractName: "MiniAppGovMerc" },
});
const hashOf = (key) => TARGETS[key].hash;

/** Fuzz target: zero-arg read methods (must never FAULT) */
const readMethods = [
  { contract: "redEnvelope", methods: ["lastEnvelopeId"] },
  { contract: "lastSurvivor", methods: ["currentRoundId", "getCurrentRound"] },
  { contract: "timeCapsule", methods: ["lastCapsuleId"] },
  { contract: "tarot", methods: ["readingsCount", "drawFee", "revenue"] },
  { contract: "breakupPact", methods: ["lastPactId"] },
  { contract: "coinFlip", methods: ["bankroll", "lastGameId"] },
  { contract: "selfLoan", methods: ["neoPrice", "pool", "totalLoans", "feeBps", "getOwner"] },
  { contract: "gasBox", methods: ["lastMachineId"] },
  { contract: "govMerc", methods: ["totalStaked", "currentEpoch", "minBid", "minStake"] },
];

/** Fuzz target: parameterized read methods */
const paramReadMethods = [
  { contract: "redEnvelope", method: "getEnvelope", argGen: (v = randomBigInt(0n, 100n)) => [intParam(v)] },
  { contract: "redEnvelope", method: "creditOf", argGen: () => [hashParam(randomUInt160())] },
  { contract: "lastSurvivor", method: "getRound", argGen: (v = randomBigInt(0n, 100n)) => [intParam(v)] },
  { contract: "lastSurvivor", method: "playerKeys", argGen: (v = randomBigInt(0n, 100n)) => [intParam(v), hashParam(randomUInt160())] },
  { contract: "timeCapsule", method: "getCapsule", argGen: (v = randomBigInt(0n, 100n)) => [intParam(v)] },
  { contract: "tarot", method: "getReading", argGen: (v = randomBigInt(0n, 100n)) => [intParam(v)] },
  { contract: "breakupPact", method: "getPact", argGen: (v = randomBigInt(0n, 100n)) => [intParam(v)] },
  { contract: "coinFlip", method: "getGame", argGen: (v = randomBigInt(0n, 100n)) => [intParam(v)] },
  { contract: "coinFlip", method: "getStats", argGen: () => [hashParam(randomUInt160())] },
  { contract: "selfLoan", method: "getLoan", argGen: () => [hashParam(randomUInt160())] },
  { contract: "selfLoan", method: "ltvTierBps", argGen: (v = randomBigInt(0n, 10n)) => [intParam(v)] },
  { contract: "gasBox", method: "getMachine", argGen: (v = randomBigInt(0n, 100n)) => [intParam(v)] },
  { contract: "gasBox", method: "getItem", argGen: (v = randomBigInt(0n, 100n)) => [intParam(v), intParam(v)] },
  { contract: "govMerc", method: "bidOf", argGen: (v = randomBigInt(0n, 100n)) => [intParam(v), hashParam(randomUInt160())] },
];

// Fail fast on ABI drift; dry-run prints the plan and exits offline.
const plannedCalls = [
  ...readMethods.flatMap((t) => t.methods.map((method) => ({ contract: t.contract, method }))),
  ...paramReadMethods.map((t) => ({ contract: t.contract, method: t.method })),
];
enforceAbiOrExit("fuzz-contract-reads", TARGETS, plannedCalls);

console.log(`[fuzz] targeting ${Object.keys(TARGETS).length} manifest-resolved contracts`);

// --- Campaign 1: Zero-arg read methods should never FAULT ---
const runner1 = new FuzzRunner("contract-reads-noarg", { iterations: readMethods.length * 3 });
await runner1.run(async (i) => {
  const target = readMethods[i % readMethods.length];
  const hash = hashOf(target.contract);

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
  const hash = hashOf(target.contract);

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
  const hash = hashOf(target.contract);

  const args = target.argGen(boundaryVal);
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
