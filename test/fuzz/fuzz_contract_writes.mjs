#!/usr/bin/env node
/**
 * Fuzz Campaign: Contract Write Methods (Testnet Only)
 *
 * Simulates contract write methods with invalid inputs to verify they
 * correctly reject bad data. All calls are read-only invokeFunction
 * SIMULATIONS — nothing is broadcast and no key is required.
 *
 * SAFETY: every target uses intentionally invalid inputs that must be
 * REJECTED by the contracts. If a simulation unexpectedly HALTs with bad
 * input, that's a finding.
 *
 * Grounding (MP-W3-06): contract hashes resolve from apps/<slug>/
 * neo-manifest.json; every method below is validated against
 * contracts/build/<C>.manifest.json before any live call ("ABI drift" fails
 * fast). FUZZ_DRY_RUN=1 / --dry-run prints the plan and exits offline.
 *
 * Usage: node test/fuzz/fuzz_contract_writes.mjs
 */
import { FuzzRunner } from "./lib/runner.mjs";
import { invokeRead, intParam, hashParam } from "./lib/neo-rpc.mjs";
import { randomUInt160, randomBigInt } from "./lib/rng.mjs";
import { resolveFuzzTargets, enforceAbiOrExit } from "./lib/abi.mjs";

const TARGETS = resolveFuzzTargets({
  redEnvelope: { appSlug: "red-envelope", contractName: "MiniAppRedEnvelope" },
  lastSurvivor: { appSlug: "last-survivor", contractName: "MiniAppLastSurvivor" },
  timeCapsule: { appSlug: "time-capsule", contractName: "MiniAppTimeCapsule" },
  tarot: { appSlug: "on-chain-tarot", contractName: "MiniAppTarot" },
  breakupPact: { appSlug: "breakup-contract", contractName: "MiniAppBreakupPact" },
  coinFlip: { appSlug: "fogplay", contractName: "MiniAppCoinFlip" },
  selfLoan: { appSlug: "self-loan", contractName: "MiniAppSelfLoan" },
  govMerc: { appSlug: "gov-merc", contractName: "MiniAppGovMerc" },
});
const hashOf = (key) => TARGETS[key].hash;

/**
 * Write-fuzz targets: simulations that SHOULD fail.
 * Each test invokes a method with invalid args and verifies the VM FAULTs.
 * If the call unexpectedly HALTs, that's a finding (the contract accepted bad input).
 */
const writeTargets = [
  // Self-loan: invalid LTV tiers must fail (valid tiers are 1..3)
  {
    name: "selfLoan.borrow(tier 0)",
    contract: "selfLoan",
    method: "borrow",
    args: () => [hashParam(randomUInt160()), intParam(0)],
    expectFault: true,
  },
  {
    name: "selfLoan.borrow(tier 99)",
    contract: "selfLoan",
    method: "borrow",
    args: () => [hashParam(randomUInt160()), intParam(99)],
    expectFault: true,
  },
  // Self-loan: repay with no loan / no repay credit must fail
  {
    name: "selfLoan.repay(no loan)",
    contract: "selfLoan",
    method: "repay",
    args: () => [hashParam(randomUInt160())],
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
  // Red envelope: create without deposited credit should fail
  {
    name: "redEnvelope.createEnvelope(no credit)",
    contract: "redEnvelope",
    method: "createEnvelope",
    args: () => [hashParam(randomUInt160()), intParam(100000000), intParam(2), intParam(3600)],
    expectFault: true,
  },
  // Red envelope: claim from a non-existent envelope should fail
  {
    name: "redEnvelope.claim(nonexistent)",
    contract: "redEnvelope",
    method: "claim",
    args: () => [intParam(randomBigInt(99999n, 999999n)), hashParam(randomUInt160())],
    expectFault: true,
  },
  // Coin flip: zero bet should fail
  {
    name: "coinFlip.flip(0 bet)",
    contract: "coinFlip",
    method: "flip",
    args: () => [hashParam(randomUInt160()), intParam(0), intParam(0)],
    expectFault: true,
  },
  // Tarot: draw without prepaid credit should fail
  {
    name: "tarot.draw(no credit)",
    contract: "tarot",
    method: "draw",
    args: () => [hashParam(randomUInt160())],
    expectFault: true,
  },
  // Time capsule: reveal a non-existent capsule should fail
  {
    name: "timeCapsule.reveal(nonexistent)",
    contract: "timeCapsule",
    method: "reveal",
    args: () => [hashParam(randomUInt160()), intParam(randomBigInt(99999n, 999999n))],
    expectFault: true,
  },
  // Breakup pact: sign a non-existent pact should fail
  {
    name: "breakupPact.signPact(nonexistent)",
    contract: "breakupPact",
    method: "signPact",
    args: () => [intParam(randomBigInt(99999n, 999999n)), hashParam(randomUInt160())],
    expectFault: true,
  },
  // Gov merc: bid below the minimum (and with no deposited credit) should fail
  {
    name: "govMerc.bid(0)",
    contract: "govMerc",
    method: "bid",
    args: () => [hashParam(randomUInt160()), intParam(0)],
    expectFault: true,
  },
];

// Fail fast on ABI drift; dry-run prints the plan and exits offline.
enforceAbiOrExit(
  "fuzz-contract-writes",
  TARGETS,
  writeTargets.map((t) => ({ contract: t.contract, method: t.method }))
);

const runner = new FuzzRunner("contract-writes-invalid", {
  iterations: writeTargets.length * 10,
});

await runner.run(async (i) => {
  const target = writeTargets[i % writeTargets.length];
  const hash = hashOf(target.contract);

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
