#!/usr/bin/env node
/**
 * Fuzz Campaign: Cross-Repo Integration Points
 *
 * Tests the boundaries between neo-miniapps-platform, neo-morpheus-oracle,
 * and neo-abstract-account on testnet.
 *
 * Targets:
 * 1. Oracle kernel request/callback lifecycle
 * 2. AA core account registration and verification
 * 3. Price feed reads with random symbols
 * 4. Oracle service availability
 *
 * Usage: TEST_FUZZ_WIF=<testnet-wif> node test/fuzz/fuzz_cross_repo.mjs
 */
import { FuzzRunner } from "./lib/runner.mjs";
import { invokeRead, intParam, hashParam, strParam, bytesParam } from "./lib/neo-rpc.mjs";
import { randomUInt160, randomBigInt, randomString, randomChoice, BOUNDARY_STRINGS } from "./lib/rng.mjs";

const { getNetworkConfig } = await import("../../deploy/scripts/lib/neo_network.js");
const NETWORK = getNetworkConfig("testnet");

const ORACLE_HASH = NETWORK.oracleHash;
const AA_CORE_HASH = process.env.AA_CORE_HASH_TESTNET || "0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38";
const DATAFEED_HASH = process.env.DATAFEED_HASH_TESTNET || "";

// --- Campaign 1: Oracle kernel reads ---
if (ORACLE_HASH) {
  const runner = new FuzzRunner("oracle-kernel-reads", { iterations: 50 });
  await runner.run(async (i) => {
    const methods = ["admin", "updater", "getTotalRequests", "getTotalFulfilled", "requestFee", "accruedRequestFees"];
    const method = randomChoice(methods);
    const result = await invokeRead(ORACLE_HASH, method, []);

    if (result.state === "FAULT") {
      runner.finding(`Oracle.${method}() FAULT`, { exception: result.exception });
    }
  });
} else {
  console.log("[fuzz] Skipping oracle kernel — ORACLE_HASH not available");
}

// --- Campaign 2: Oracle with random request IDs ---
if (ORACLE_HASH) {
  const runner = new FuzzRunner("oracle-request-reads", { iterations: 100 });
  await runner.run(async (i) => {
    const requestId = randomBigInt(0n, 99999n);
    const result = await invokeRead(ORACLE_HASH, "getRequest", [intParam(requestId)]);
    // Should HALT with empty/default data, not FAULT
    if (result.state === "FAULT" && !result.exception?.includes("not found")) {
      runner.finding(`Oracle.getRequest(${requestId}) unexpected FAULT`, {
        exception: result.exception,
      });
    }
  });
}

// --- Campaign 3: AA core reads ---
if (AA_CORE_HASH) {
  const runner = new FuzzRunner("aa-core-reads", { iterations: 100 });
  await runner.run(async (i) => {
    // Fuzz getVerifier/getHook/getBackupOwner with random account IDs
    const accountId = randomUInt160();
    const methods = ["getVerifier", "getHook", "getBackupOwner", "getEscapeTimelock"];
    const method = randomChoice(methods);
    const result = await invokeRead(AA_CORE_HASH, method, [hashParam(accountId)]);

    if (result.state === "FAULT" && !result.exception?.includes("not found") && !result.exception?.includes("not registered")) {
      runner.finding(`AA.${method}(${accountId}) unexpected FAULT`, {
        exception: result.exception,
      });
    }
  });
} else {
  console.log("[fuzz] Skipping AA core — AA_CORE_HASH not available");
}

// --- Campaign 4: AA with boundary inputs ---
if (AA_CORE_HASH) {
  const runner = new FuzzRunner("aa-boundary-inputs", { iterations: 50 });
  await runner.run(async (i) => {
    const methods = [
      { method: "getVerifier", args: [hashParam("0x" + "00".repeat(20))] },
      { method: "getVerifier", args: [hashParam("0x" + "ff".repeat(20))] },
      { method: "getBackupOwner", args: [hashParam(randomUInt160())] },
      { method: "getEscapeTimelock", args: [hashParam(randomUInt160())] },
    ];
    const target = methods[i % methods.length];
    const result = await invokeRead(AA_CORE_HASH, target.method, target.args);

    if (result.state === "FAULT" && result.exception?.includes("overflow")) {
      runner.finding(`AA.${target.method}() overflow`, {
        args: JSON.stringify(target.args), exception: result.exception,
      });
    }
  });
}

// --- Campaign 5: Data feed reads with random symbols ---
if (DATAFEED_HASH) {
  const runner = new FuzzRunner("datafeed-random-symbols", { iterations: 100 });
  await runner.run(async (i) => {
    const symbols = [
      "NEO-USD", "GAS-USD", "BTC-USD", "ETH-USD",
      randomString(8) + "-USD",
      "",
      "a".repeat(256),
      "'; DROP TABLE feeds; --",
    ];
    const symbol = symbols[i % symbols.length];
    const result = await invokeRead(DATAFEED_HASH, "getPrice", [strParam(symbol)]);

    // Should HALT (returns 0 for unknown symbols), not FAULT
    if (result.state === "FAULT") {
      runner.finding(`DataFeed.getPrice("${symbol.slice(0, 50)}") FAULT`, {
        exception: result.exception,
      });
    }
  });
} else {
  console.log("[fuzz] Skipping data feed — DATAFEED_HASH not available");
}

// --- Campaign 6: Oracle with injection attempts ---
if (ORACLE_HASH) {
  const runner = new FuzzRunner("oracle-injection", { iterations: BOUNDARY_STRINGS.length });
  await runner.run(async (i) => {
    const payload = BOUNDARY_STRINGS[i];
    // Try to read an app config with a malicious key
    const result = await invokeRead(ORACLE_HASH, "getAppConfig", [
      strParam(payload),
      strParam(payload),
    ]);

    if (result.state !== "FAULT" && result.state !== "HALT") {
      runner.finding(`Oracle.getAppConfig with injection input: unexpected state ${result.state}`, {
        input: payload.slice(0, 50),
      });
    }
  });
}

console.log("\n[fuzz] Cross-repo fuzzing complete.");
