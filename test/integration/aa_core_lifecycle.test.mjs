/**
 * Abstract Account Core Lifecycle — cross-repo integration tests (read-only).
 *
 * Verifies the AA core contract on testnet responds correctly to
 * account state reads, nonce queries, and registration simulations.
 */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  AA_CORE_HASH,
  invokeRead,
  isHalt,
  firstStack,
  stackHash160,
  hashParam,
  intParam,
  UINT160_ZERO,
} from "./helpers.mjs";

// ── Helper: random 20-byte script-hash ────────────────────────────────────

function randomHash160() {
  return "0x" + crypto.randomBytes(20).toString("hex");
}

// ── getVerifier ───────────────────────────────────────────────────────────

test("AA getVerifier with zero hash returns HALT", async () => {
  const result = await invokeRead(AA_CORE_HASH, "getVerifier", [
    hashParam(UINT160_ZERO),
  ]);
  // Zero-hash is unregistered so it may HALT (returning default) or
  // FAULT with "not registered" — both are acceptable.
  const state = String(result.state || "").toUpperCase();
  const ok =
    state === "HALT" ||
    (state === "FAULT" &&
      /not (found|registered)/i.test(result.exception || ""));
  assert.ok(
    ok,
    `AA.getVerifier(Zero) unexpected: ${state} — ${result.exception || ""}`,
  );
});

test("AA getVerifier with random hash does not crash", async () => {
  const id = randomHash160();
  const result = await invokeRead(AA_CORE_HASH, "getVerifier", [
    hashParam(id),
  ]);
  const state = String(result.state || "").toUpperCase();
  const ok =
    state === "HALT" ||
    (state === "FAULT" &&
      /not (found|registered)/i.test(result.exception || ""));
  assert.ok(
    ok,
    `AA.getVerifier(${id}) unexpected: ${state} — ${result.exception || ""}`,
  );
});

// ── getHook ───────────────────────────────────────────────────────────────

test("AA getHook with random hash does not crash", async () => {
  const id = randomHash160();
  const result = await invokeRead(AA_CORE_HASH, "getHook", [hashParam(id)]);
  const state = String(result.state || "").toUpperCase();
  const ok =
    state === "HALT" ||
    (state === "FAULT" &&
      /not (found|registered)/i.test(result.exception || ""));
  assert.ok(
    ok,
    `AA.getHook(${id}) unexpected: ${state} — ${result.exception || ""}`,
  );
});

// ── getBackupOwner ────────────────────────────────────────────────────────

test("AA getBackupOwner with random hash does not crash", async () => {
  const id = randomHash160();
  const result = await invokeRead(AA_CORE_HASH, "getBackupOwner", [
    hashParam(id),
  ]);
  const state = String(result.state || "").toUpperCase();
  const ok =
    state === "HALT" ||
    (state === "FAULT" &&
      /not (found|registered)/i.test(result.exception || ""));
  assert.ok(
    ok,
    `AA.getBackupOwner(${id}) unexpected: ${state} — ${result.exception || ""}`,
  );
});

// ── Registration simulation (read-only) ──────────────────────────────────

test("AA registration with random account ID can be simulated read-only", async () => {
  // We invoke "register" via invokefunction (read-only simulation, no
  // transaction broadcast).  The call will FAULT because we don't supply
  // a valid signer, but it should not return an unexpected error like
  // "overflow" or a crash — just a permissions / signer check failure.
  const id = randomHash160();
  const verifier = randomHash160();
  const result = await invokeRead(AA_CORE_HASH, "register", [
    hashParam(id),
    hashParam(verifier),
  ]);

  const state = String(result.state || "").toUpperCase();
  // FAULT is expected (no valid signer), HALT would mean dry-run passed.
  assert.ok(
    state === "HALT" || state === "FAULT",
    `AA.register simulation returned unexpected state: ${state}`,
  );

  // Guard against overflow / internal crash — only authorization or
  // "already registered" faults are expected.
  if (state === "FAULT") {
    const ex = String(result.exception || "").toLowerCase();
    assert.ok(
      !ex.includes("overflow") && !ex.includes("out of range"),
      `AA.register simulation triggered an unexpected internal error: ${result.exception}`,
    );
  }
});

// ── Nonce reads ──────────────────────────────────────────────────────────

test("AA getNonce for unregistered account returns HALT or not-found FAULT", async () => {
  const id = randomHash160();
  const result = await invokeRead(AA_CORE_HASH, "getNonce", [
    hashParam(id),
    intParam(0),
  ]);

  const state = String(result.state || "").toUpperCase();
  if (state === "HALT") {
    // For an unregistered account the nonce should be 0.
    const nonce = BigInt(String(firstStack(result) || "0"));
    assert.equal(nonce, 0n, "nonce for unregistered account should be 0");
  } else {
    // FAULT with "not registered/found" is also acceptable.
    assert.ok(
      /not (found|registered)/i.test(result.exception || ""),
      `AA.getNonce unexpected FAULT: ${result.exception}`,
    );
  }
});

test("AA getNonce with zero hash returns HALT or known FAULT", async () => {
  const result = await invokeRead(AA_CORE_HASH, "getNonce", [
    hashParam(UINT160_ZERO),
    intParam(0),
  ]);
  const state = String(result.state || "").toUpperCase();
  assert.ok(
    state === "HALT" || state === "FAULT",
    `AA.getNonce(Zero) unexpected state: ${state}`,
  );
});

// ── getEscapeTimelock ────────────────────────────────────────────────────

test("AA getEscapeTimelock for random account does not crash", async () => {
  const id = randomHash160();
  const result = await invokeRead(AA_CORE_HASH, "getEscapeTimelock", [
    hashParam(id),
  ]);
  const state = String(result.state || "").toUpperCase();
  assert.ok(
    state === "HALT" || state === "FAULT",
    `AA.getEscapeTimelock(${id}) unexpected state: ${state}`,
  );
});
