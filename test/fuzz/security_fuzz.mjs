#!/usr/bin/env node
/**
 * Security-Focused Fuzz Campaign — current self-contained miniapp contracts
 *
 * Targets:
 *   1. Boundary value inputs (0, -1, MAX_INT, empty strings, null)
 *   2. Invalid type inputs (wrong types, extra/missing params)
 *   3. Access control probes (owner-only methods from a non-owner wallet)
 *   4. Overflow attempts (large integers for amounts/counts)
 *   5. Replay / re-entrance probes (rapid repeated calls)
 *   6. String boundary inputs
 *   7. Direct onNEP17Payment handler probes
 *
 * Grounding (MP-W3-06):
 *   - Contract hashes resolve from apps/<slug>/neo-manifest.json.
 *   - Every fuzzed method is validated against contracts/build/<C>.manifest.json
 *     BEFORE any live call — a stale list fails fast with "ABI drift".
 *   - FUZZ_DRY_RUN=1 / --dry-run prints the plan and performs zero invocations.
 *
 * All calls are read-only simulations (invokeFunction) — no state changes on-chain.
 *
 * Usage:
 *   node test/fuzz/security_fuzz.mjs            # live read-only fuzz (testnet)
 *   FUZZ_DRY_RUN=1 node test/fuzz/security_fuzz.mjs   # offline ABI/plan check
 */

import { FuzzRunner } from "./lib/runner.mjs";
import {
  invokeRead,
  intParam,
  hashParam,
  strParam,
  boolParam,
  bytesParam,
  RPC_URL,
} from "./lib/neo-rpc.mjs";
import {
  randomUInt160,
  randomHex,
  BOUNDARY_STRINGS,
} from "./lib/rng.mjs";
import { resolveFuzzTargets, enforceAbiOrExit } from "./lib/abi.mjs";

// ── Configuration ──────────────────────────────────────────────────────────
// This campaign uses read-only invocations. For access-control probes we only
// need a signer script hash; never embed or require a private WIF for this file.
let Neon;
async function ensureNeon() {
  if (!Neon) {
    Neon = await import("@cityofzion/neon-js");
    if (Neon.default) Neon = Neon.default;
  }
  return Neon;
}

const FUZZER_HASH = (
  process.env.TEST_FUZZ_SCRIPT_HASH ||
  process.env.TEST_FUZZ_ACCOUNT_HASH ||
  "0x0000000000000000000000000000000000000000"
).trim();
const FUZZER_ADDR = process.env.TEST_FUZZ_ADDRESS || "synthetic-readonly-signer";

// ── Contract targets (hash ⇐ app manifest, ABI ⇐ contracts/build) ──────────
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

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  Security Fuzz Campaign — MiniApp Contracts (Testnet)        ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log(`  RPC:       ${RPC_URL}`);
console.log(`  Fuzzer:    ${FUZZER_ADDR}`);
console.log(`  ScriptH:   ${FUZZER_HASH}`);
console.log(`  Time:      ${new Date().toISOString()}`);
console.log("");

// ── Helpers ────────────────────────────────────────────────────────────────

/** invokeFunction with signer context (needed for methods that check witnesses) */
async function invokeAsSigner(contractHash, method, args = []) {
  const neon = await ensureNeon();
  const rpc = new neon.rpc.RPCClient(RPC_URL);
  const signers = [{
    account: FUZZER_HASH,
    scopes: "CalledByEntry",
  }];
  return rpc.invokeFunction(contractHash, method, args, signers);
}

function isHalt(r) { return String(r?.state || "").toUpperCase() === "HALT"; }
function isFault(r) { return String(r?.state || "").toUpperCase() === "FAULT"; }

// Collect all findings across all campaigns
const allFindings = [];
function trackFindings(runner) {
  allFindings.push(...runner.results.findings);
}

// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 1: BOUNDARY VALUE INPUTS — integer-id reads
// ════════════════════════════════════════════════════════════════════════════
const boundaryTargets = [
  { contract: "redEnvelope", method: "getEnvelope", mkArgs: (v) => [intParam(v)] },
  { contract: "redEnvelope", method: "claimedAmount", mkArgs: (v) => [intParam(v), hashParam(randomUInt160())] },
  { contract: "redEnvelope", method: "hasClaimed", mkArgs: (v) => [intParam(v), hashParam(randomUInt160())] },
  { contract: "redEnvelope", method: "getCreatorEnvelopes", mkArgs: (v) => [hashParam(randomUInt160()), intParam(v), intParam(v)] },
  { contract: "lastSurvivor", method: "getRound", mkArgs: (v) => [intParam(v)] },
  { contract: "lastSurvivor", method: "playerKeys", mkArgs: (v) => [intParam(v), hashParam(randomUInt160())] },
  { contract: "lastSurvivor", method: "keyCost", mkArgs: (v) => [intParam(v), intParam(v)] },
  { contract: "lastSurvivor", method: "currentKeyCost", mkArgs: (v) => [intParam(v)] },
  { contract: "timeCapsule", method: "getCapsule", mkArgs: (v) => [intParam(v)] },
  { contract: "timeCapsule", method: "getOwnerCapsules", mkArgs: (v) => [hashParam(randomUInt160()), intParam(v), intParam(v)] },
  { contract: "tarot", method: "getReading", mkArgs: (v) => [intParam(v)] },
  { contract: "tarot", method: "getPlayerReadings", mkArgs: (v) => [hashParam(randomUInt160()), intParam(v), intParam(v)] },
  { contract: "breakupPact", method: "getPact", mkArgs: (v) => [intParam(v)] },
  { contract: "breakupPact", method: "getPartyPacts", mkArgs: (v) => [hashParam(randomUInt160()), intParam(v), intParam(v)] },
  { contract: "coinFlip", method: "getGame", mkArgs: (v) => [intParam(v)] },
  { contract: "coinFlip", method: "getPlayerGames", mkArgs: (v) => [hashParam(randomUInt160()), intParam(v), intParam(v)] },
  { contract: "selfLoan", method: "ltvTierBps", mkArgs: (v) => [intParam(v)] },
  { contract: "gasBox", method: "getMachine", mkArgs: (v) => [intParam(v)] },
  { contract: "gasBox", method: "getItem", mkArgs: (v) => [intParam(v), intParam(v)] },
  { contract: "govMerc", method: "bidOf", mkArgs: (v) => [intParam(v), hashParam(randomUInt160())] },
  { contract: "govMerc", method: "highestBid", mkArgs: (v) => [intParam(v)] },
  { contract: "govMerc", method: "settlementWinner", mkArgs: (v) => [intParam(v)] },
];

// Extended boundary set including negative, MAX_INT, and edge values
const BOUNDARY_VALUES = [
  0n, -1n, 1n, -2n,
  255n, 256n, -256n,
  2n ** 16n - 1n, 2n ** 16n,
  2n ** 32n - 1n, 2n ** 32n,
  2n ** 64n - 1n, 2n ** 64n,
  2n ** 128n - 1n, 2n ** 128n,
  2n ** 255n - 1n,            // MAX signed 256-bit
  -(2n ** 255n),              // MIN signed 256-bit
  10n ** 8n,                  // 1 GAS
  10n ** 18n,                 // huge GAS
  999999999999999999999999n,  // absurd
];

// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 2: INVALID TYPE INPUTS
// ════════════════════════════════════════════════════════════════════════════
const typeTargets = [
  // Expect Hash160 but send something else
  { contract: "redEnvelope", method: "creditOf",
    badArgs: () => [strParam("not-a-hash")], desc: "string instead of Hash160" },
  { contract: "coinFlip", method: "getStats",
    badArgs: () => [strParam("")], desc: "empty string instead of Hash160" },
  { contract: "selfLoan", method: "getLoan",
    badArgs: () => [intParam(42)], desc: "int instead of Hash160" },
  { contract: "tarot", method: "draw",
    badArgs: () => [intParam(7)], desc: "int instead of Hash160" },
  // Expect Integer but send something else
  { contract: "lastSurvivor", method: "getRound",
    badArgs: () => [strParam("abc")], desc: "string instead of Integer" },
  { contract: "lastSurvivor", method: "getRound",
    badArgs: () => [boolParam(true)], desc: "bool instead of Integer" },
  { contract: "breakupPact", method: "getPact",
    badArgs: () => [strParam("xyz")], desc: "string instead of Integer" },
  { contract: "timeCapsule", method: "getCapsule",
    badArgs: () => [hashParam(randomUInt160())], desc: "Hash160 instead of Integer" },
  // Extra parameters on 0-param methods
  { contract: "lastSurvivor", method: "currentRoundId",
    badArgs: () => [intParam(1), strParam("extra"), boolParam(false)], desc: "3 extra params on 0-param method" },
  { contract: "redEnvelope", method: "lastEnvelopeId",
    badArgs: () => [intParam(999)], desc: "extra param on 0-param method" },
  { contract: "tarot", method: "readingsCount",
    badArgs: () => [strParam("extra1"), intParam(2)], desc: "2 extra params on 0-param method" },
  { contract: "coinFlip", method: "bankroll",
    badArgs: () => [intParam(1)], desc: "extra param on 0-param method" },
  // Missing parameters (empty args on methods that require params)
  { contract: "lastSurvivor", method: "getRound",
    badArgs: () => [], desc: "missing required Integer param" },
  { contract: "redEnvelope", method: "claim",
    badArgs: () => [], desc: "missing both required params" },
  { contract: "lastSurvivor", method: "buyKeys",
    badArgs: () => [], desc: "missing both required params" },
  { contract: "coinFlip", method: "flip",
    badArgs: () => [], desc: "missing all 3 required params" },
  { contract: "breakupPact", method: "createPact",
    badArgs: () => [hashParam(randomUInt160())], desc: "only 1 of 4 required params" },
  { contract: "redEnvelope", method: "createEnvelope",
    badArgs: () => [hashParam(randomUInt160())], desc: "only 1 of 4 params" },
  // Null-like inputs
  { contract: "lastSurvivor", method: "buyKeys",
    badArgs: () => [hashParam("0000000000000000000000000000000000000000"), intParam(0)], desc: "zero-hash player, 0 keys" },
  { contract: "coinFlip", method: "flip",
    badArgs: () => [hashParam("0000000000000000000000000000000000000000"), intParam(0), intParam(0)], desc: "zero-hash player, 0 amount" },
];

// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 3: ACCESS CONTROL PROBES
// ════════════════════════════════════════════════════════════════════════════
// Privileged / witness-gated methods called from the non-owner fuzzer account.
// These should all FAULT with "unauthorized"/witness errors.
const adminMethods = [
  { contract: "selfLoan", method: "setNeoPrice",
    args: () => [intParam(1)], desc: "set NEO price (owner-only)" },
  { contract: "selfLoan", method: "withdrawPool",
    args: () => [hashParam(FUZZER_HASH), intParam(100000000)], desc: "drain lending pool (owner-only)" },
  { contract: "tarot", method: "withdrawRevenue",
    args: () => [hashParam(FUZZER_HASH)], desc: "withdraw draw revenue (owner-only)" },
  { contract: "coinFlip", method: "withdrawBankroll",
    args: () => [hashParam(FUZZER_HASH), intParam(100000000)], desc: "drain bankroll (house-only)" },
  { contract: "gasBox", method: "withdrawRevenue",
    args: () => [hashParam(FUZZER_HASH), intParam(1), hashParam(randomUInt160())], desc: "withdraw machine revenue (creator-only)" },
  { contract: "gasBox", method: "setActive",
    args: () => [hashParam(FUZZER_HASH), intParam(1), boolParam(false)], desc: "deactivate a machine (creator-only)" },
  { contract: "gasBox", method: "createMachine",
    args: () => [hashParam(randomUInt160()), strParam("evil"), hashParam(randomUInt160()), intParam(1)], desc: "create machine for another account (witness-gated)" },
  // withdraw(account) refunds credit — must require the ACCOUNT's witness,
  // not the fuzzer's, when called for someone else's credit.
  { contract: "redEnvelope", method: "withdraw",
    args: () => [hashParam(randomUInt160())], desc: "withdraw another account's credit" },
  { contract: "lastSurvivor", method: "withdraw",
    args: () => [hashParam(randomUInt160())], desc: "withdraw another account's credit" },
  { contract: "timeCapsule", method: "withdraw",
    args: () => [hashParam(randomUInt160())], desc: "withdraw another account's credit" },
  { contract: "govMerc", method: "withdraw",
    args: () => [hashParam(randomUInt160())], desc: "withdraw another account's credit" },
  { contract: "breakupPact", method: "withdraw",
    args: () => [hashParam(randomUInt160())], desc: "withdraw another account's credit" },
  { contract: "govMerc", method: "withdrawStake",
    args: () => [hashParam(randomUInt160()), intParam(1)], desc: "withdraw another account's NEO stake" },
  { contract: "govMerc", method: "claimRewards",
    args: () => [hashParam(randomUInt160())], desc: "claim another account's rewards" },
];

// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 4: OVERFLOW ATTEMPTS
// ════════════════════════════════════════════════════════════════════════════
const OVERFLOW_VALUES = [
  2n ** 64n,
  2n ** 128n,
  2n ** 255n - 1n,
  -(2n ** 255n),
  10n ** 30n,
  999999999999999999999999999999n,
];

const overflowTargets = [
  { contract: "lastSurvivor", method: "buyKeys",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(v)], desc: "buyKeys(huge count)" },
  { contract: "lastSurvivor", method: "keyCost",
    mkArgs: (v) => [intParam(v), intParam(v)], desc: "keyCost(huge)" },
  { contract: "redEnvelope", method: "createEnvelope",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(v), intParam(v), intParam(v)],
    desc: "createEnvelope(huge amount/count/expiry)" },
  { contract: "timeCapsule", method: "bury",
    mkArgs: (v) => [hashParam(FUZZER_HASH), bytesParam(randomHex(32)), intParam(v), boolParam(false), intParam(v), intParam(v)],
    desc: "bury(huge lock/fee/deposit)" },
  { contract: "coinFlip", method: "flip",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(1), intParam(v)], desc: "flip(huge bet)" },
  { contract: "selfLoan", method: "borrow",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(v)], desc: "borrow(huge tier)" },
  { contract: "breakupPact", method: "createPact",
    mkArgs: (v) => [hashParam(FUZZER_HASH), hashParam(randomUInt160()), intParam(v), intParam(v)],
    desc: "createPact(huge stake/duration)" },
  { contract: "govMerc", method: "bid",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(v)], desc: "bid(huge amount)" },
  { contract: "gasBox", method: "pull",
    mkArgs: (v) => [intParam(v), hashParam(FUZZER_HASH)], desc: "pull(huge machine id)" },
  { contract: "gasBox", method: "addItem",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(1), strParam("fuzz"), intParam(v), intParam(v)],
    desc: "addItem(huge weight/amount)" },
];

// Pure computations may legitimately HALT on large inputs.
const PURE_COMPUTATIONS = new Set(["keyCost", "currentKeyCost", "ltvTierBps"]);

// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 5: REPLAY / RE-ENTRANCE PROBES
// ════════════════════════════════════════════════════════════════════════════
const replayTargets = [
  { contract: "redEnvelope", method: "lastEnvelopeId", args: [], desc: "lastEnvelopeId" },
  { contract: "lastSurvivor", method: "currentRoundId", args: [], desc: "currentRoundId" },
  { contract: "timeCapsule", method: "lastCapsuleId", args: [], desc: "lastCapsuleId" },
  { contract: "tarot", method: "readingsCount", args: [], desc: "readingsCount" },
  { contract: "breakupPact", method: "lastPactId", args: [], desc: "lastPactId" },
  { contract: "coinFlip", method: "bankroll", args: [], desc: "bankroll" },
  { contract: "selfLoan", method: "totalLoans", args: [], desc: "totalLoans" },
  { contract: "gasBox", method: "lastMachineId", args: [], desc: "lastMachineId" },
  { contract: "govMerc", method: "currentEpoch", args: [], desc: "currentEpoch" },
];

// Rapid-fire write simulations (should be idempotent or consistently reject)
const replayWriteTargets = [
  { contract: "redEnvelope", method: "claim",
    args: () => [intParam(1), hashParam(FUZZER_HASH)], desc: "rapid claim" },
  { contract: "lastSurvivor", method: "buyKeys",
    args: () => [hashParam(FUZZER_HASH), intParam(1)], desc: "rapid buyKeys" },
  { contract: "tarot", method: "draw",
    args: () => [hashParam(FUZZER_HASH)], desc: "rapid draw" },
  { contract: "coinFlip", method: "flip",
    args: () => [hashParam(FUZZER_HASH), intParam(0), intParam(100000)], desc: "rapid flip" },
  { contract: "breakupPact", method: "signPact",
    args: () => [intParam(1), hashParam(FUZZER_HASH)], desc: "rapid signPact" },
  { contract: "selfLoan", method: "borrow",
    args: () => [hashParam(FUZZER_HASH), intParam(1)], desc: "rapid borrow" },
];

const RAPID_COUNT = 5; // calls per target

// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 6: STRING BOUNDARY INPUTS
// ════════════════════════════════════════════════════════════════════════════
const stringTargets = [
  { contract: "gasBox", method: "createMachine",
    mkArgs: (s) => [hashParam(FUZZER_HASH), strParam(s), hashParam(randomUInt160()), intParam(100)],
    desc: "createMachine with boundary name strings" },
  { contract: "gasBox", method: "addItem",
    mkArgs: (s) => [hashParam(FUZZER_HASH), intParam(1), strParam(s), intParam(1), intParam(1)],
    desc: "addItem with boundary label strings" },
];

// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 7: onNEP17Payment handler fuzzing
// ════════════════════════════════════════════════════════════════════════════
const nep17Targets = [];
for (const key of Object.keys(TARGETS)) {
  nep17Targets.push(
    { contract: key, args: () => [hashParam(FUZZER_HASH), intParam(0), intParam(0)], desc: "0 amount" },
    { contract: key, args: () => [hashParam(FUZZER_HASH), intParam(-1), intParam(0)], desc: "negative amount" },
    { contract: key, args: () => [hashParam(FUZZER_HASH), intParam(2n ** 128n), intParam(0)], desc: "overflow amount" },
  );
}

// ── Fail fast on ABI drift; dry-run exits here with the plan ────────────────
const plannedCalls = [
  ...boundaryTargets,
  ...typeTargets,
  ...adminMethods,
  ...overflowTargets,
  ...replayTargets,
  ...replayWriteTargets,
  ...stringTargets,
  ...nep17Targets.map((t) => ({ contract: t.contract, method: "onNEP17Payment" })),
].map((t) => ({ contract: t.contract, method: t.method }));
enforceAbiOrExit("security-fuzz", TARGETS, plannedCalls);

// ════════════════════════════════════════════════════════════════════════════
// LIVE CAMPAIGNS (read-only simulations)
// ════════════════════════════════════════════════════════════════════════════
console.log("\n━━ CAMPAIGN 1: Boundary Value Inputs ━━━━━━━━━━━━━━━━━━━━━━━━━");

const runner1 = new FuzzRunner("boundary-values", {
  iterations: boundaryTargets.length * BOUNDARY_VALUES.length,
  timeoutMs: 180_000,
});

await runner1.run(async (i) => {
  const target = boundaryTargets[i % boundaryTargets.length];
  const boundary = BOUNDARY_VALUES[Math.floor(i / boundaryTargets.length) % BOUNDARY_VALUES.length];
  const args = target.mkArgs(boundary);

  const result = await invokeRead(hashOf(target.contract), target.method, args);

  // Finding: HALT with a non-empty return on negative IDs (should not return real data)
  if (isHalt(result) && boundary < 0n) {
    const hasRealData = result.stack && result.stack.length > 0 &&
      result.stack[0]?.value !== null && result.stack[0]?.value !== "" &&
      result.stack[0]?.value !== "0" && result.stack[0]?.value !== false;
    if (hasRealData) {
      runner1.finding(
        `${target.contract}.${target.method}(${boundary}): HALT with data on negative ID`,
        { contract: target.contract, method: target.method, boundary: String(boundary),
          stack: JSON.stringify(result.stack?.slice(0, 2)) }
      );
    }
  }

  // Finding: HALT on extreme overflow values (should FAULT or return empty)
  if (isHalt(result) && boundary > 2n ** 128n && !PURE_COMPUTATIONS.has(target.method)) {
    runner1.finding(
      `${target.contract}.${target.method}(${boundary}): HALT on extreme overflow`,
      { contract: target.contract, method: target.method, boundary: String(boundary),
        stack: JSON.stringify(result.stack?.slice(0, 2)) }
    );
  }
});
trackFindings(runner1);

console.log("\n━━ CAMPAIGN 2: Invalid Type Inputs ━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const runner2 = new FuzzRunner("invalid-types", {
  iterations: typeTargets.length,
  timeoutMs: 120_000,
});

await runner2.run(async (i) => {
  const target = typeTargets[i % typeTargets.length];
  const args = target.badArgs();

  const result = await invokeRead(hashOf(target.contract), target.method, args);

  if (isHalt(result)) {
    // A HALT on invalid type/missing params is suspicious — contract should validate
    runner2.finding(
      `${target.contract}.${target.method}(): HALT on invalid input (${target.desc})`,
      { contract: target.contract, method: target.method, desc: target.desc,
        state: result.state, stack: JSON.stringify(result.stack?.slice(0, 3)) }
    );
  }
  // FAULT is expected and correct — contract properly rejected bad input
});
trackFindings(runner2);

console.log("\n━━ CAMPAIGN 3: Access Control Probes ━━━━━━━━━━━━━━━━━━━━━━━━━");

const runner3 = new FuzzRunner("access-control", {
  iterations: adminMethods.length,
  timeoutMs: 180_000,
});

await runner3.run(async (i) => {
  const target = adminMethods[i % adminMethods.length];
  const args = target.args();

  // Call WITH the fuzzer as signer — must be rejected (fuzzer lacks the witness)
  const result = await invokeAsSigner(hashOf(target.contract), target.method, args);

  if (isHalt(result)) {
    runner3.finding(
      `ACCESS CONTROL: ${target.contract}.${target.method}() HALT from non-owner (${target.desc})`,
      { contract: target.contract, method: target.method, desc: target.desc,
        severity: "HIGH", state: result.state,
        exception: result.exception || "none",
        stack: JSON.stringify(result.stack?.slice(0, 2)) }
    );
  }
  // FAULT is expected and correct
});
trackFindings(runner3);

console.log("\n━━ CAMPAIGN 4: Overflow Attempts ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const runner4 = new FuzzRunner("overflow-attempts", {
  iterations: overflowTargets.length * OVERFLOW_VALUES.length,
  timeoutMs: 180_000,
});

await runner4.run(async (i) => {
  const target = overflowTargets[i % overflowTargets.length];
  const overflow = OVERFLOW_VALUES[Math.floor(i / overflowTargets.length) % OVERFLOW_VALUES.length];
  const args = target.mkArgs(overflow);

  const result = await invokeAsSigner(hashOf(target.contract), target.method, args);

  // A HALT on overflow values for write operations is suspicious
  if (isHalt(result) && !PURE_COMPUTATIONS.has(target.method)) {
    runner4.finding(
      `OVERFLOW: ${target.contract}.${target.method}() HALT on overflow (${target.desc})`,
      { contract: target.contract, method: target.method, desc: target.desc,
        overflow: String(overflow), severity: "MEDIUM",
        stack: JSON.stringify(result.stack?.slice(0, 2)) }
    );
  }
});
trackFindings(runner4);

console.log("\n━━ CAMPAIGN 5: Replay / Re-entrance Probes ━━━━━━━━━━━━━━━━━━━");

const runner5 = new FuzzRunner("replay-reentrance", {
  iterations: (replayTargets.length + replayWriteTargets.length) * RAPID_COUNT,
  timeoutMs: 180_000,
});

await runner5.run(async (i) => {
  const totalReadSlots = replayTargets.length * RAPID_COUNT;

  if (i < totalReadSlots) {
    // Read consistency checks — fire the same method rapidly and compare values
    const targetIdx = Math.floor(i / RAPID_COUNT) % replayTargets.length;
    const target = replayTargets[targetIdx];
    const callIdx = i % RAPID_COUNT;

    const result = await invokeRead(hashOf(target.contract), target.method, target.args);

    if (isFault(result)) {
      runner5.finding(
        `REPLAY-READ: ${target.contract}.${target.method}() FAULTed on rapid call ${callIdx + 1}/${RAPID_COUNT}`,
        { contract: target.contract, method: target.method,
          exception: result.exception || "none" }
      );
    }
  } else {
    // Write replay — rapid-fire write simulations
    const adjustedI = i - totalReadSlots;
    const targetIdx = Math.floor(adjustedI / RAPID_COUNT) % replayWriteTargets.length;
    const target = replayWriteTargets[targetIdx];
    const callIdx = adjustedI % RAPID_COUNT;
    const args = target.args();

    const result = await invokeAsSigner(hashOf(target.contract), target.method, args);

    // For write methods: the fuzzer has no credit/witness, so every call should
    // FAULT consistently. A HALT on a repeat call could indicate missing replay
    // protection.
    if (isHalt(result) && callIdx > 0) {
      runner5.finding(
        `REPLAY-WRITE: ${target.contract}.${target.method}() HALT on rapid call ${callIdx + 1}/${RAPID_COUNT} (${target.desc})`,
        { contract: target.contract, method: target.method, desc: target.desc,
          callIndex: callIdx, severity: "LOW",
          note: "Successive HALTs may indicate missing replay protection (simulated only, no state changed)" }
      );
    }
  }
});
trackFindings(runner5);

console.log("\n━━ CAMPAIGN 6: String/Bytes Boundary Inputs ━━━━━━━━━━━━━━━━━━");

const runner6 = new FuzzRunner("string-boundary", {
  iterations: stringTargets.length * BOUNDARY_STRINGS.length,
  timeoutMs: 120_000,
});

await runner6.run(async (i) => {
  const target = stringTargets[i % stringTargets.length];
  const str = BOUNDARY_STRINGS[Math.floor(i / stringTargets.length) % BOUNDARY_STRINGS.length];
  const args = target.mkArgs(str);

  const result = await invokeAsSigner(hashOf(target.contract), target.method, args);

  // HALT with very large strings is suspicious (no length validation)
  if (isHalt(result) && str.length > 1000) {
    runner6.finding(
      `STRING-OVERFLOW: ${target.contract}.${target.method}() HALT with ${str.length}-char string (${target.desc})`,
      { contract: target.contract, method: target.method, desc: target.desc,
        inputLength: str.length, severity: "LOW" }
    );
  }
});
trackFindings(runner6);

console.log("\n━━ CAMPAIGN 7: onNEP17Payment Handler Probes ━━━━━━━━━━━━━━━━━");

const runner7 = new FuzzRunner("nep17-payment-handler", {
  iterations: nep17Targets.length,
  timeoutMs: 120_000,
});

await runner7.run(async (i) => {
  const target = nep17Targets[i % nep17Targets.length];
  const args = target.args();

  // Direct call to onNEP17Payment from a non-token contract should FAULT
  const result = await invokeAsSigner(hashOf(target.contract), "onNEP17Payment", args);

  if (isHalt(result)) {
    runner7.finding(
      `NEP17-HANDLER: ${target.contract}.onNEP17Payment() HALT on direct call (${target.desc})`,
      { contract: target.contract, desc: target.desc, severity: "HIGH",
        note: "Direct call to onNEP17Payment should be rejected (caller is not a token contract)",
        stack: JSON.stringify(result.stack?.slice(0, 2)) }
    );
  }
});
trackFindings(runner7);

// ════════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ════════════════════════════════════════════════════════════════════════════
console.log("\n══════════════════════════════════════════════════════════════");
console.log("  SECURITY FUZZ REPORT");
console.log("══════════════════════════════════════════════════════════════");

const campaignSummaries = [
  { name: "Boundary Values",    runner: runner1 },
  { name: "Invalid Types",      runner: runner2 },
  { name: "Access Control",     runner: runner3 },
  { name: "Overflow Attempts",  runner: runner4 },
  { name: "Replay/Re-entrance", runner: runner5 },
  { name: "String Boundaries",  runner: runner6 },
  { name: "NEP17 Handler",      runner: runner7 },
];

let totalIterations = 0;
let totalFindings = 0;
for (const c of campaignSummaries) {
  const r = c.runner.results;
  const iters = r.pass + r.fail + r.error + r.skip;
  totalIterations += iters;
  totalFindings += r.findings.length;
  const status = r.findings.length > 0 ? "FINDINGS" : "CLEAN";
  console.log(`  [${status.padEnd(8)}] ${c.name.padEnd(22)} ${iters} iterations, ${r.findings.length} findings`);
}

console.log(`\n  Total iterations: ${totalIterations}`);
console.log(`  Total findings:   ${totalFindings}`);

if (allFindings.length > 0) {
  // Categorize by severity
  const high = allFindings.filter(f => f.severity === "HIGH");
  const medium = allFindings.filter(f => f.severity === "MEDIUM");
  const low = allFindings.filter(f => f.severity === "LOW");
  const unrated = allFindings.filter(f => !f.severity);

  if (high.length > 0) {
    console.log(`\n  *** HIGH SEVERITY (${high.length}) ***`);
    for (const f of high) {
      console.log(`    [${f.contract}] ${f.description}`);
      if (f.note) console.log(`      Note: ${f.note}`);
    }
  }
  if (medium.length > 0) {
    console.log(`\n  ** MEDIUM SEVERITY (${medium.length}) **`);
    for (const f of medium) {
      console.log(`    [${f.contract}] ${f.description}`);
    }
  }
  if (low.length > 0) {
    console.log(`\n  * LOW SEVERITY (${low.length}) *`);
    for (const f of low) {
      console.log(`    [${f.contract}] ${f.description}`);
    }
  }
  if (unrated.length > 0) {
    console.log(`\n  UNRATED (${unrated.length}):`);
    for (const f of unrated) {
      console.log(`    [${f.contract || "?"}] ${f.description}`);
    }
  }
}

console.log("\n══════════════════════════════════════════════════════════════\n");

process.exit(allFindings.length > 0 ? 1 : 0);
