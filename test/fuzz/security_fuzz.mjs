#!/usr/bin/env node
/**
 * Security-Focused Fuzz Campaign — All 7 Flagship Contracts
 *
 * Targets:
 *   1. Boundary value inputs (0, -1, MAX_INT, empty strings, null)
 *   2. Invalid type inputs (wrong types, extra/missing params)
 *   3. Access control probes (admin-only methods from non-admin wallet)
 *   4. Overflow attempts (large integers for amounts/counts)
 *   5. Replay / re-entrance probes (rapid repeated calls)
 *
 * All calls are read-only simulations (invokeFunction) — no state changes on-chain.
 *
 * Usage:
 *   node test/fuzz/security_fuzz.mjs
 */

import { FuzzRunner } from "./lib/runner.mjs";
import {
  invokeRead,
  intParam,
  hashParam,
  strParam,
  boolParam,
  bytesParam,
  arrayParam,
  RPC_URL,
} from "./lib/neo-rpc.mjs";
import {
  randomUInt160,
  randomBigInt,
  randomInt,
  randomChoice,
  randomString,
  randomHex,
  BOUNDARY_INTS,
  BOUNDARY_STRINGS,
} from "./lib/rng.mjs";

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

const neon = await ensureNeon();
const FUZZER_HASH = (
  process.env.TEST_FUZZ_SCRIPT_HASH ||
  process.env.TEST_FUZZ_ACCOUNT_HASH ||
  "0x0000000000000000000000000000000000000000"
).trim();
const FUZZER_ADDR = process.env.TEST_FUZZ_ADDRESS || "synthetic-readonly-signer";

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  Security Fuzz Campaign — 7 Flagship Contracts (Testnet)    ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log(`  RPC:       ${RPC_URL}`);
console.log(`  Fuzzer:    ${FUZZER_ADDR}`);
console.log(`  ScriptH:   ${FUZZER_HASH}`);
console.log(`  Time:      ${new Date().toISOString()}`);
console.log("");

// ── Contract hashes (testnet) ──────────────────────────────────────────────
const C = {
  LastSurvivor: "0xd55df731978582ea81719a5d87ce49b248e91275",
  DailyCheckin: "0xaba84da240a55410d284a656fc8dae044e6ec1a5",
  GASBox:       "0x49ec8536ba331d744a16b8da2a6ed4263ef4e89c",
  FogPlay:      "0xb115dd775a7591bb0eedef6dbf50428d50e7bc07",
  RedEnvelope:  "0xfa1b7240fead2a63999c02defa3aec5eb274a919",
  SelfLoan:     "0xd097c63ea89251d23632826ebed99a7e7ce536f7",
  NeoPay:       "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** invokeFunction with signer context (needed for methods that check Transaction.Sender) */
async function invokeAsSigner(contractHash, method, args = []) {
  const rpc = new neon.rpc.RPCClient(RPC_URL);
  const signers = [{
    account: FUZZER_HASH,
    scopes: "CalledByEntry",
  }];
  return rpc.invokeFunction(contractHash, method, args, signers);
}

function isHalt(r) { return String(r?.state || "").toUpperCase() === "HALT"; }
function isFault(r) { return String(r?.state || "").toUpperCase() === "FAULT"; }

/** Delay for rate-limiting */
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Collect all findings across all campaigns
const allFindings = [];
function trackFindings(runner) {
  allFindings.push(...runner.results.findings);
}

// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 1: BOUNDARY VALUE INPUTS
// ════════════════════════════════════════════════════════════════════════════
console.log("\n━━ CAMPAIGN 1: Boundary Value Inputs ━━━━━━━━━━━━━━━━━━━━━━━━━");

const boundaryTargets = [
  // Methods that take integer IDs — test with 0, -1, MAX_INT etc.
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "getRound", mkArgs: (v) => [intParam(v)] },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "getPlayerKeys", mkArgs: (v) => [hashParam(randomUInt160()), intParam(v)] },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "calculateKeyCostFormula", mkArgs: (v) => [intParam(v), intParam(v)] },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "getRoundDetails", mkArgs: (v) => [intParam(v)] },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "calculateNextRewardDay", mkArgs: (v) => [intParam(v)] },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "getUserStreak", mkArgs: (_v) => [hashParam(randomUInt160())] },
  { contract: "GASBox",      hash: C.GASBox,       method: "getMachine", mkArgs: (v) => [intParam(v)] },
  { contract: "GASBox",      hash: C.GASBox,       method: "getMachineItem", mkArgs: (v) => [intParam(v), intParam(v)] },
  { contract: "GASBox",      hash: C.GASBox,       method: "getPlay", mkArgs: (v) => [intParam(v)] },
  { contract: "FogPlay",     hash: C.FogPlay,      method: "getBet", mkArgs: (v) => [intParam(v)] },
  { contract: "RedEnvelope",  hash: C.RedEnvelope,  method: "getEnvelope", mkArgs: (v) => [intParam(v)] },
  { contract: "RedEnvelope",  hash: C.RedEnvelope,  method: "getPacketAmount", mkArgs: (v) => [intParam(v), intParam(v)] },
  { contract: "SelfLoan",    hash: C.SelfLoan,     method: "getLoan", mkArgs: (v) => [intParam(v)] },
  { contract: "SelfLoan",    hash: C.SelfLoan,     method: "getHealthFactor", mkArgs: (v) => [intParam(v)] },
  { contract: "SelfLoan",    hash: C.SelfLoan,     method: "getLoanDetails", mkArgs: (v) => [intParam(v)] },
  { contract: "NeoPay",      hash: C.NeoPay,       method: "getStreamDetails", mkArgs: (v) => [intParam(v)] },
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

const runner1 = new FuzzRunner("boundary-values", {
  iterations: boundaryTargets.length * BOUNDARY_VALUES.length,
  timeoutMs: 180_000,
});

await runner1.run(async (i) => {
  const target = boundaryTargets[i % boundaryTargets.length];
  const boundary = BOUNDARY_VALUES[Math.floor(i / boundaryTargets.length) % BOUNDARY_VALUES.length];
  const args = target.mkArgs(boundary);

  const result = await invokeRead(target.hash, target.method, args);

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
  if (isHalt(result) && boundary > 2n ** 128n) {
    runner1.finding(
      `${target.contract}.${target.method}(${boundary}): HALT on extreme overflow`,
      { contract: target.contract, method: target.method, boundary: String(boundary),
        stack: JSON.stringify(result.stack?.slice(0, 2)) }
    );
  }
});
trackFindings(runner1);


// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 2: INVALID TYPE INPUTS
// ════════════════════════════════════════════════════════════════════════════
console.log("\n━━ CAMPAIGN 2: Invalid Type Inputs ━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const typeTargets = [
  // Expect Hash160 but send String
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "getCheckInStateForFrontend",
    badArgs: () => [strParam("not-a-hash")], desc: "string instead of Hash160" },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "getUserStats",
    badArgs: () => [strParam("")], desc: "empty string instead of Hash160" },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "checkIn",
    badArgs: () => [intParam(42)], desc: "int instead of Hash160" },
  // Expect Integer but send String
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "getRound",
    badArgs: () => [strParam("abc")], desc: "string instead of Integer" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "getRound",
    badArgs: () => [boolParam(true)], desc: "bool instead of Integer" },
  { contract: "SelfLoan", hash: C.SelfLoan, method: "getLoan",
    badArgs: () => [strParam("xyz")], desc: "string instead of Integer" },
  { contract: "SelfLoan", hash: C.SelfLoan, method: "getLoanDetails",
    badArgs: () => [hashParam(randomUInt160())], desc: "Hash160 instead of Integer" },
  // Extra parameters
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "currentRoundId",
    badArgs: () => [intParam(1), strParam("extra"), boolParam(false)], desc: "3 extra params on 0-param method" },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "totalUsers",
    badArgs: () => [intParam(999)], desc: "extra param on 0-param method" },
  { contract: "GASBox", hash: C.GASBox, method: "totalMachines",
    badArgs: () => [strParam("extra1"), intParam(2)], desc: "2 extra params on 0-param method" },
  { contract: "NeoPay", hash: C.NeoPay, method: "totalStreams",
    badArgs: () => [intParam(1)], desc: "extra param on 0-param method" },
  // Missing parameters (empty args on methods that require params)
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "getRound",
    badArgs: () => [], desc: "missing required Integer param" },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "checkIn",
    badArgs: () => [], desc: "missing required Hash160 param" },
  { contract: "SelfLoan", hash: C.SelfLoan, method: "createLoan",
    badArgs: () => [], desc: "missing all 3 required params" },
  { contract: "SelfLoan", hash: C.SelfLoan, method: "createLoan",
    badArgs: () => [hashParam(randomUInt160())], desc: "only 1 of 3 required params" },
  { contract: "NeoPay", hash: C.NeoPay, method: "createStream",
    badArgs: () => [], desc: "missing all 8 required params" },
  { contract: "GASBox", hash: C.GASBox, method: "createMachine",
    badArgs: () => [], desc: "missing all 6 required params" },
  { contract: "RedEnvelope", hash: C.RedEnvelope, method: "createEnvelope",
    badArgs: () => [hashParam(randomUInt160())], desc: "only 1 of 4 params" },
  // Null-like inputs
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "buyKeys",
    badArgs: () => [hashParam("0000000000000000000000000000000000000000"), intParam(0)], desc: "zero-hash player, 0 keys" },
  { contract: "FogPlay", hash: C.FogPlay, method: "placeBet",
    badArgs: () => [hashParam("0000000000000000000000000000000000000000"), intParam(0), boolParam(true)], desc: "zero-hash player, 0 amount" },
];

const runner2 = new FuzzRunner("invalid-types", {
  iterations: typeTargets.length,
  timeoutMs: 120_000,
});

await runner2.run(async (i) => {
  const target = typeTargets[i % typeTargets.length];
  const args = target.badArgs();

  const result = await invokeRead(target.hash, target.method, args);

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


// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 3: ACCESS CONTROL PROBES
// ════════════════════════════════════════════════════════════════════════════
console.log("\n━━ CAMPAIGN 3: Access Control Probes ━━━━━━━━━━━━━━━━━━━━━━━━━");

// Admin-only methods called from non-admin fuzzer account
// These should all FAULT with "not authorized" or similar
const adminMethods = [
  // -- Shared admin methods across all contracts --
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "proposeAdmin",
    args: () => [hashParam(FUZZER_HASH)], desc: "proposeAdmin" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "executeAdminChange",
    args: () => [], desc: "executeAdminChange" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "cancelAdminChange",
    args: () => [], desc: "cancelAdminChange" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "setOracle",
    args: () => [hashParam(FUZZER_HASH)], desc: "setOracle to self" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "setPauseRegistry",
    args: () => [hashParam(FUZZER_HASH)], desc: "setPauseRegistry to self" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "setAbstractAccount",
    args: () => [hashParam(FUZZER_HASH)], desc: "setAbstractAccount to self" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "setPaused",
    args: () => [boolParam(true), strParam("fuzz")], desc: "pause contract" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "setTimeLockDelay",
    args: () => [intParam(0)], desc: "set timelock to 0" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "destroy",
    args: () => [], desc: "destroy contract" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "update",
    args: () => [bytesParam(""), strParam("{}"), intParam(0)], desc: "update contract" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "startNewRound",
    args: () => [], desc: "start new round" },

  // DailyCheckin admin methods
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "proposeAdmin",
    args: () => [hashParam(FUZZER_HASH)], desc: "proposeAdmin" },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "destroy",
    args: () => [], desc: "destroy contract" },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "setPaused",
    args: () => [boolParam(true), strParam("fuzz")], desc: "pause contract" },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "update",
    args: () => [bytesParam(""), strParam("{}"), intParam(0)], desc: "update contract" },

  // GASBox admin methods
  { contract: "GASBox", hash: C.GASBox, method: "proposeAdmin",
    args: () => [hashParam(FUZZER_HASH)], desc: "proposeAdmin" },
  { contract: "GASBox", hash: C.GASBox, method: "destroy",
    args: () => [], desc: "destroy contract" },
  { contract: "GASBox", hash: C.GASBox, method: "setPaused",
    args: () => [boolParam(true), strParam("fuzz")], desc: "pause contract" },
  { contract: "GASBox", hash: C.GASBox, method: "registerScript",
    args: () => [strParam("evil"), bytesParam(randomHex(20))], desc: "register script" },
  { contract: "GASBox", hash: C.GASBox, method: "enableScript",
    args: () => [strParam("evil")], desc: "enable script" },
  { contract: "GASBox", hash: C.GASBox, method: "setMachineBanned",
    args: () => [intParam(1), boolParam(true)], desc: "ban machine (admin)" },

  // FogPlay admin methods
  { contract: "FogPlay", hash: C.FogPlay, method: "setAdmin",
    args: () => [hashParam(FUZZER_HASH)], desc: "setAdmin to self" },
  { contract: "FogPlay", hash: C.FogPlay, method: "setPaused",
    args: () => [boolParam(true)], desc: "pause contract" },
  { contract: "FogPlay", hash: C.FogPlay, method: "setBetLimits",
    args: () => [intParam(999999), intParam(999999), intParam(0), intParam(999)], desc: "set bet limits" },
  { contract: "FogPlay", hash: C.FogPlay, method: "update",
    args: () => [bytesParam(""), strParam("{}")], desc: "update contract" },

  // RedEnvelope admin methods
  { contract: "RedEnvelope", hash: C.RedEnvelope, method: "setAdmin",
    args: () => [hashParam(FUZZER_HASH)], desc: "setAdmin to self" },
  { contract: "RedEnvelope", hash: C.RedEnvelope, method: "setPaused",
    args: () => [boolParam(true)], desc: "pause contract" },
  { contract: "RedEnvelope", hash: C.RedEnvelope, method: "update",
    args: () => [bytesParam(""), strParam("{}")], desc: "update contract" },

  // SelfLoan admin methods
  { contract: "SelfLoan", hash: C.SelfLoan, method: "proposeAdmin",
    args: () => [hashParam(FUZZER_HASH)], desc: "proposeAdmin" },
  { contract: "SelfLoan", hash: C.SelfLoan, method: "destroy",
    args: () => [], desc: "destroy contract" },
  { contract: "SelfLoan", hash: C.SelfLoan, method: "setPaused",
    args: () => [boolParam(true), strParam("fuzz")], desc: "pause contract" },

  // NeoPay admin methods
  { contract: "NeoPay", hash: C.NeoPay, method: "proposeAdmin",
    args: () => [hashParam(FUZZER_HASH)], desc: "proposeAdmin" },
  { contract: "NeoPay", hash: C.NeoPay, method: "destroy",
    args: () => [], desc: "destroy contract" },
  { contract: "NeoPay", hash: C.NeoPay, method: "setPaused",
    args: () => [boolParam(true), strParam("fuzz")], desc: "pause contract" },
];

const runner3 = new FuzzRunner("access-control", {
  iterations: adminMethods.length,
  timeoutMs: 180_000,
});

await runner3.run(async (i) => {
  const target = adminMethods[i % adminMethods.length];
  const args = target.args();

  // Call WITH the fuzzer as signer — this should be rejected since fuzzer is not admin
  const result = await invokeAsSigner(target.hash, target.method, args);

  if (isHalt(result)) {
    runner3.finding(
      `ACCESS CONTROL: ${target.contract}.${target.method}() HALT from non-admin (${target.desc})`,
      { contract: target.contract, method: target.method, desc: target.desc,
        severity: "HIGH", state: result.state,
        exception: result.exception || "none",
        stack: JSON.stringify(result.stack?.slice(0, 2)) }
    );
  }
  // FAULT is expected and correct
});
trackFindings(runner3);


// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 4: OVERFLOW ATTEMPTS
// ════════════════════════════════════════════════════════════════════════════
console.log("\n━━ CAMPAIGN 4: Overflow Attempts ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const OVERFLOW_VALUES = [
  2n ** 64n,
  2n ** 128n,
  2n ** 255n - 1n,
  -(2n ** 255n),
  10n ** 30n,
  999999999999999999999999999999n,
];

const overflowTargets = [
  // LastSurvivor — buyKeys with absurd count
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "buyKeys",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(v)], desc: "buyKeys(huge count)" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "buyKeysWithCost",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(v), intParam(v)], desc: "buyKeysWithCost(huge)" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "calculateKeyCostFormula",
    mkArgs: (v) => [intParam(v), intParam(v)], desc: "calculateKeyCostFormula(huge)" },

  // DailyCheckin — calculateNextRewardDay with huge streak
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "calculateNextRewardDay",
    mkArgs: (v) => [intParam(v)], desc: "calculateNextRewardDay(huge streak)" },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "checkInWithCalculation",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(v), intParam(v), boolParam(false)],
    desc: "checkInWithCalculation(huge)" },

  // GASBox — createMachine with huge price
  { contract: "GASBox", hash: C.GASBox, method: "createMachine",
    mkArgs: (v) => [hashParam(FUZZER_HASH), strParam("fuzz"), strParam("d"), strParam("c"), strParam("t"), intParam(v)],
    desc: "createMachine(huge price)" },
  { contract: "GASBox", hash: C.GASBox, method: "addMachineItem",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(1), strParam("fuzz"), intParam(v), strParam("common"),
      intParam(0), hashParam(randomUInt160()), intParam(v), strParam("")],
    desc: "addMachineItem(huge weight+amount)" },

  // FogPlay — placeBet with huge amount
  { contract: "FogPlay", hash: C.FogPlay, method: "placeBet",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(v), boolParam(true)], desc: "placeBet(huge amount)" },

  // RedEnvelope — createEnvelope with huge amount/count
  { contract: "RedEnvelope", hash: C.RedEnvelope, method: "createEnvelope",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(v), intParam(v), intParam(v)],
    desc: "createEnvelope(huge amount/count/expiry)" },

  // SelfLoan — createLoan with huge collateral
  { contract: "SelfLoan", hash: C.SelfLoan, method: "createLoan",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(v), intParam(1)], desc: "createLoan(huge collateral)" },
  { contract: "SelfLoan", hash: C.SelfLoan, method: "repayDebt",
    mkArgs: (v) => [intParam(1), hashParam(FUZZER_HASH), intParam(v)], desc: "repayDebt(huge amount)" },
  { contract: "SelfLoan", hash: C.SelfLoan, method: "addCollateral",
    mkArgs: (v) => [intParam(1), hashParam(FUZZER_HASH), intParam(v)], desc: "addCollateral(huge)" },
  { contract: "SelfLoan", hash: C.SelfLoan, method: "withdrawCollateral",
    mkArgs: (v) => [intParam(1), intParam(v)], desc: "withdrawCollateral(huge)" },

  // NeoPay — createStream with huge amounts
  { contract: "NeoPay", hash: C.NeoPay, method: "createStream",
    mkArgs: (v) => [hashParam(FUZZER_HASH), hashParam(randomUInt160()), hashParam(randomUInt160()),
      intParam(v), intParam(v), intParam(v), strParam("fuzz"), strParam("notes")],
    desc: "createStream(huge amounts)" },
  { contract: "NeoPay", hash: C.NeoPay, method: "claimStream",
    mkArgs: (v) => [hashParam(FUZZER_HASH), intParam(v)], desc: "claimStream(huge ID)" },
];

const runner4 = new FuzzRunner("overflow-attempts", {
  iterations: overflowTargets.length * OVERFLOW_VALUES.length,
  timeoutMs: 180_000,
});

await runner4.run(async (i) => {
  const target = overflowTargets[i % overflowTargets.length];
  const overflow = OVERFLOW_VALUES[Math.floor(i / overflowTargets.length) % OVERFLOW_VALUES.length];
  const args = target.mkArgs(overflow);

  const result = await invokeAsSigner(target.hash, target.method, args);

  // A HALT on overflow values for write operations is suspicious
  if (isHalt(result)) {
    // Check if the method is a pure computation (safe) vs. a state-changing write
    const isComputation = target.method === "calculateKeyCostFormula" || target.method === "calculateNextRewardDay";
    if (!isComputation) {
      runner4.finding(
        `OVERFLOW: ${target.contract}.${target.method}() HALT on overflow (${target.desc})`,
        { contract: target.contract, method: target.method, desc: target.desc,
          overflow: String(overflow), severity: "MEDIUM",
          stack: JSON.stringify(result.stack?.slice(0, 2)) }
      );
    }
  }
});
trackFindings(runner4);


// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 5: REPLAY / RE-ENTRANCE PROBES
// ════════════════════════════════════════════════════════════════════════════
console.log("\n━━ CAMPAIGN 5: Replay / Re-entrance Probes ━━━━━━━━━━━━━━━━━━━");

const replayTargets = [
  // Rapid-fire the same read method to check consistency
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "currentRoundId", args: [], desc: "currentRoundId" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "totalKeysSold", args: [], desc: "totalKeysSold" },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "totalCheckins", args: [], desc: "totalCheckins" },
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "totalUsers", args: [], desc: "totalUsers" },
  { contract: "GASBox", hash: C.GASBox, method: "totalMachines", args: [], desc: "totalMachines" },
  { contract: "SelfLoan", hash: C.SelfLoan, method: "totalLoans", args: [], desc: "totalLoans" },
  { contract: "NeoPay", hash: C.NeoPay, method: "totalStreams", args: [], desc: "totalStreams" },
];

// Rapid-fire write simulations (should be idempotent or consistently reject)
const replayWriteTargets = [
  { contract: "DailyCheckin", hash: C.DailyCheckin, method: "checkIn",
    args: () => [hashParam(FUZZER_HASH)], desc: "rapid checkIn" },
  { contract: "LastSurvivor", hash: C.LastSurvivor, method: "buyKeys",
    args: () => [hashParam(FUZZER_HASH), intParam(1)], desc: "rapid buyKeys" },
  { contract: "SelfLoan", hash: C.SelfLoan, method: "createLoan",
    args: () => [hashParam(FUZZER_HASH), intParam(1), intParam(1)], desc: "rapid createLoan" },
  { contract: "RedEnvelope", hash: C.RedEnvelope, method: "claim",
    args: () => [intParam(1), hashParam(FUZZER_HASH)], desc: "rapid claim" },
  { contract: "NeoPay", hash: C.NeoPay, method: "claimStream",
    args: () => [hashParam(FUZZER_HASH), intParam(1)], desc: "rapid claimStream" },
  { contract: "FogPlay", hash: C.FogPlay, method: "placeBet",
    args: () => [hashParam(FUZZER_HASH), intParam(100000), boolParam(true)], desc: "rapid placeBet" },
];

const RAPID_COUNT = 5; // calls per target

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

    const result = await invokeRead(target.hash, target.method, target.args);

    if (isFault(result)) {
      runner5.finding(
        `REPLAY-READ: ${target.contract}.${target.method}() FAULTed on rapid call ${callIdx + 1}/${RAPID_COUNT}`,
        { contract: target.contract, method: target.method,
          exception: result.exception || "none" }
      );
    }
    // Store value for consistency check (runner logs it internally)
  } else {
    // Write replay — rapid-fire write simulations
    const adjustedI = i - totalReadSlots;
    const targetIdx = Math.floor(adjustedI / RAPID_COUNT) % replayWriteTargets.length;
    const target = replayWriteTargets[targetIdx];
    const callIdx = adjustedI % RAPID_COUNT;
    const args = target.args();

    const result = await invokeAsSigner(target.hash, target.method, args);

    // For write methods: first call might HALT (valid action) or FAULT (no funds/prereqs).
    // Subsequent rapid calls should behave consistently — if first FAULTed, all should.
    // A HALT on a double-claim or double-checkIn could indicate missing replay protection.
    if (isHalt(result) && callIdx > 0) {
      // Record for manual review — might indicate missing replay guard
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


// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 6: CROSS-CONTRACT BOUNDARY (bonus — string/bytes edge cases)
// ════════════════════════════════════════════════════════════════════════════
console.log("\n━━ CAMPAIGN 6: String/Bytes Boundary Inputs ━━━━━━━━━━━━━━━━━━");

const stringTargets = [
  { contract: "GASBox", hash: C.GASBox, method: "createMachine",
    mkArgs: (s) => [hashParam(FUZZER_HASH), strParam(s), strParam(s), strParam(s), strParam(s), intParam(100)],
    desc: "createMachine with boundary strings" },
  { contract: "GASBox", hash: C.GASBox, method: "getScriptInfo",
    mkArgs: (s) => [strParam(s)], desc: "getScriptInfo with boundary strings" },
  { contract: "NeoPay", hash: C.NeoPay, method: "createStream",
    mkArgs: (s) => [hashParam(FUZZER_HASH), hashParam(randomUInt160()), hashParam(randomUInt160()),
      intParam(100), intParam(10), intParam(60), strParam(s), strParam(s)],
    desc: "createStream with boundary title/notes" },
];

const runner6 = new FuzzRunner("string-boundary", {
  iterations: stringTargets.length * BOUNDARY_STRINGS.length,
  timeoutMs: 120_000,
});

await runner6.run(async (i) => {
  const target = stringTargets[i % stringTargets.length];
  const str = BOUNDARY_STRINGS[Math.floor(i / stringTargets.length) % BOUNDARY_STRINGS.length];
  const args = target.mkArgs(str);

  const result = await invokeAsSigner(target.hash, target.method, args);

  // HALT with 64KB strings is suspicious (no length validation)
  if (isHalt(result) && str.length > 1000) {
    runner6.finding(
      `STRING-OVERFLOW: ${target.contract}.${target.method}() HALT with ${str.length}-char string (${target.desc})`,
      { contract: target.contract, method: target.method, desc: target.desc,
        inputLength: str.length, severity: "LOW" }
    );
  }
});
trackFindings(runner6);


// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGN 7: onNEP17Payment handler fuzzing
// ════════════════════════════════════════════════════════════════════════════
console.log("\n━━ CAMPAIGN 7: onNEP17Payment Handler Probes ━━━━━━━━━━━━━━━━━");

const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

const nep17Targets = [
  // Call onNEP17Payment directly (should require it to be called by a token contract)
  { contract: "LastSurvivor", hash: C.LastSurvivor,
    args: () => [hashParam(FUZZER_HASH), intParam(0), intParam(0)], desc: "0 amount" },
  { contract: "LastSurvivor", hash: C.LastSurvivor,
    args: () => [hashParam(FUZZER_HASH), intParam(-1), intParam(0)], desc: "negative amount" },
  { contract: "LastSurvivor", hash: C.LastSurvivor,
    args: () => [hashParam(FUZZER_HASH), intParam(2n ** 128n), intParam(0)], desc: "overflow amount" },
  { contract: "DailyCheckin", hash: C.DailyCheckin,
    args: () => [hashParam(FUZZER_HASH), intParam(0), intParam(0)], desc: "0 amount" },
  { contract: "DailyCheckin", hash: C.DailyCheckin,
    args: () => [hashParam(FUZZER_HASH), intParam(-1), intParam(0)], desc: "negative amount" },
  { contract: "GASBox", hash: C.GASBox,
    args: () => [hashParam(FUZZER_HASH), intParam(0), intParam(0)], desc: "0 amount" },
  { contract: "SelfLoan", hash: C.SelfLoan,
    args: () => [hashParam(FUZZER_HASH), intParam(0), intParam(0)], desc: "0 amount" },
  { contract: "NeoPay", hash: C.NeoPay,
    args: () => [hashParam(FUZZER_HASH), intParam(0), intParam(0)], desc: "0 amount" },
  { contract: "FogPlay", hash: C.FogPlay,
    args: () => [hashParam(FUZZER_HASH), intParam(0), intParam(0)], desc: "0 amount" },
  { contract: "RedEnvelope", hash: C.RedEnvelope,
    args: () => [hashParam(FUZZER_HASH), intParam(0), intParam(0)], desc: "0 amount" },
];

const runner7 = new FuzzRunner("nep17-payment-handler", {
  iterations: nep17Targets.length,
  timeoutMs: 120_000,
});

await runner7.run(async (i) => {
  const target = nep17Targets[i % nep17Targets.length];
  const args = target.args();

  // Direct call to onNEP17Payment from a non-token contract should FAULT
  const result = await invokeAsSigner(target.hash, "onNEP17Payment", args);

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
  { name: "Boundary Values",   runner: runner1 },
  { name: "Invalid Types",     runner: runner2 },
  { name: "Access Control",    runner: runner3 },
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
