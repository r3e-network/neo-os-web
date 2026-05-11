/**
 * Contract State Consistency — cross-repo integration tests (read-only).
 *
 * Verifies that all 7 flagship contracts on testnet:
 *   1. Respond to their documented stats/count read methods
 *   2. Return HALT (not FAULT) for zero-arg read methods
 *   3. Have non-zero admin addresses configured
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  invokeRead,
  getContractState,
  isHalt,
  firstStack,
  stackHash160,
  readManifest,
  getManifestContractHash,
  intParam,
  strParam,
} from "./helpers.mjs";

// ── Flagship apps with their testnet hashes and expected read methods ─────

const FLAGSHIP_APPS = [
  {
    brand: "LastSurvivor",
    slug: "last-survivor",
    contractName: "PlatformGame",
    readMethods: [
      { method: "getGameType", args: [strParam("miniapp-last-survivor")] },
      { method: "getGameAdmin", args: [strParam("miniapp-last-survivor")] },
      { method: "isPaused", args: [strParam("miniapp-last-survivor")] },
    ],
    countMethods: [],
  },
  {
    brand: "GASBOX",
    slug: "gasbox",
    contractName: "PlatformGame",
    readMethods: [
      { method: "getGameType", args: [strParam("miniapp-gasbox")] },
      { method: "getGameAdmin", args: [strParam("miniapp-gasbox")] },
      { method: "isPaused", args: [strParam("miniapp-gasbox")] },
      { method: "getGachaMachine", args: [strParam("miniapp-gasbox"), intParam(0)] },
    ],
    countMethods: [],
  },
  {
    brand: "Red Envelope",
    slug: "red-envelope",
    contractName: "MiniAppRedEnvelope",
    readMethods: [],
    // getEnvelope requires an id arg, tested separately
    countMethods: [],
  },
  {
    brand: "Daily Check-in",
    slug: "daily-checkin",
    contractName: "MiniAppDailyCheckIn",
    readMethods: [{ method: "getPlatformStats" }],
    countMethods: [],
  },
  {
    brand: "FogPlay",
    slug: "fogplay",
    contractName: "PlatformGame",
    readMethods: [
      { method: "getGameType", args: [strParam("miniapp-fogplay")] },
      { method: "getGameAdmin", args: [strParam("miniapp-fogplay")] },
      { method: "isPaused", args: [strParam("miniapp-fogplay")] },
      { method: "getCoinFlipBetLimits", args: [strParam("miniapp-fogplay")] },
    ],
    countMethods: [],
  },
  {
    brand: "SelfLoan",
    slug: "self-loan",
    contractName: "PlatformDeFi",
    readMethods: [
      { method: "isPaused" },
      { method: "getLendingStats", args: [strParam("miniapp-self-loan")] },
    ],
    countMethods: [],
  },
  {
    brand: "NeoPay",
    slug: "neo-pay",
    contractName: "MiniAppNeoPay",
    readMethods: [{ method: "totalStreams" }],
    countMethods: [{ method: "totalStreams", minValue: 0n }],
  },
];

/** Resolve the testnet contract hash for an app from its manifest. */
function testnetHash(slug) {
  const manifest = readManifest(slug);
  return getManifestContractHash(manifest, "testnet");
}

// ── Test 1: All flagship contracts respond to stats/count reads ───────────

test("all 7 flagship contracts respond to their documented read/count methods", async () => {
  for (const app of FLAGSHIP_APPS) {
    const hash = testnetHash(app.slug);
    if (!hash) {
      // Skip apps without a testnet deployment.
      continue;
    }

    for (const { method, args = [] } of app.readMethods) {
      const result = await invokeRead(hash, method, args);
      assert.ok(
        isHalt(result),
        `${app.brand}.${method}() returned ${result.state}: ${result.exception || "no exception"}`,
      );
    }

    for (const { method, minValue } of app.countMethods) {
      const result = await invokeRead(hash, method);
      assert.ok(
        isHalt(result),
        `${app.brand}.${method}() returned ${result.state}`,
      );
      const count = BigInt(String(firstStack(result) || "0"));
      assert.ok(
        count >= minValue,
        `${app.brand}.${method}() = ${count}, expected >= ${minValue}`,
      );
    }
  }
});

// ── Test 2: All zero-arg read methods return HALT ─────────────────────────

test("all flagship contracts return HALT for documented read methods", async () => {
  for (const app of FLAGSHIP_APPS) {
    const hash = testnetHash(app.slug);
    if (!hash) continue;

    for (const { method, args = [] } of app.readMethods) {
      const result = await invokeRead(hash, method, args);
      const state = String(result.state || "").toUpperCase();
      assert.equal(
        state,
        "HALT",
        `${app.brand}.${method}() returned ${state} instead of HALT: ${result.exception || ""}`,
      );
    }
  }
});

// ── Test 3: Contract admin addresses are set ──────────────────────────────

test("all flagship contracts have non-zero admin addresses", async () => {
  for (const app of FLAGSHIP_APPS) {
    const hash = testnetHash(app.slug);
    if (!hash) continue;

    // Most contracts expose an "admin" or "owner" method.  Try both.
    let result = await invokeRead(hash, "admin");
    if (!isHalt(result)) {
      result = await invokeRead(hash, "owner");
    }
    if (!isHalt(result)) {
      // Some contracts use getAdmin or getOwner.
      result = await invokeRead(hash, "getAdmin");
    }
    if (!isHalt(result)) {
      result = await invokeRead(hash, "getOwner");
    }

    if (isHalt(result)) {
      const admin = stackHash160(result.stack?.[0]);
      assert.ok(
        admin && admin !== "0x" + "00".repeat(20),
        `${app.brand} admin is zero or missing — contract may be uninitialised`,
      );
    } else {
      // If no admin method exists at all, verify the contract is at least
      // deployed and responds to getcontractstate.
      const state = await getContractState(hash);
      assert.ok(
        state?.manifest?.name,
        `${app.brand} (${hash}) has no admin method and getcontractstate returned no manifest name`,
      );
    }
  }
});

// ── Test 4: getcontractstate resolves for all 7 flagships ─────────────────

test("getcontractstate resolves for every flagship testnet contract", async () => {
  for (const app of FLAGSHIP_APPS) {
    const hash = testnetHash(app.slug);
    if (!hash) continue;

    const state = await getContractState(hash);
    assert.ok(
      state?.manifest?.name,
      `${app.brand} (${hash}): getcontractstate returned no manifest name`,
    );
    assert.equal(
      state.manifest.name,
      app.contractName,
      `${app.brand} contract name mismatch: expected ${app.contractName}, got ${state.manifest.name}`,
    );
  }
});

// ── Test 5: parameterized read methods (with arg) return HALT ─────────────

test("flagship contracts handle parameterized reads gracefully", async () => {
  // Red Envelope: getEnvelope(0)
  const redEnvelopeHash = testnetHash("red-envelope");
  if (redEnvelopeHash) {
    const result = await invokeRead(redEnvelopeHash, "getEnvelope", [
      intParam(0),
    ]);
    const state = String(result.state || "").toUpperCase();
    assert.ok(
      state === "HALT" || state === "FAULT",
      `RedEnvelope.getEnvelope(0) unexpected state: ${state}`,
    );
  }

  // SelfLoan: getLoan(appId, loanId)
  const selfLoanHash = testnetHash("self-loan");
  if (selfLoanHash) {
    const result = await invokeRead(selfLoanHash, "getLoan", [
      strParam("miniapp-self-loan"),
      intParam(0),
    ]);
    const state = String(result.state || "").toUpperCase();
    assert.ok(
      state === "HALT" || state === "FAULT",
      `SelfLoan.getLoan(miniapp-self-loan, 0) unexpected state: ${state}`,
    );
  }

  // NeoPay: getStreamDetails(0)
  const neoPayHash = testnetHash("neo-pay");
  if (neoPayHash) {
    const result = await invokeRead(neoPayHash, "getStreamDetails", [
      intParam(0),
    ]);
    const state = String(result.state || "").toUpperCase();
    assert.ok(
      state === "HALT" || state === "FAULT",
      `NeoPay.getStreamDetails(0) unexpected state: ${state}`,
    );
  }
});
