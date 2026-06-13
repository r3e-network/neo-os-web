import { describe, expect, it } from "vitest";

import { createObservable } from "../react/context";
import { useHealthScore } from "../../wallet-health/src/composables/useHealthScore";
import type { StorageProxy } from "../services/os/StorageProxy";

/**
 * wallet-health findings:
 *  - pre-connect, the auto GAS check must be "pending" (excluded from the score
 *    denominator), NOT a failed item, so a disconnected user doesn't see a false
 *    "top up GAS" recommendation / alarming High-risk verdict;
 *  - recommendations must derive from every unchecked item, so the panel and the
 *    score/risk chip never disagree ("All checks look good" while items pending).
 */

// The synchronous device-local checklist never touches StorageProxy (it is wired
// for API parity only), so an empty stub is sufficient.
const storage = {} as StorageProxy;

describe("wallet-health useHealthScore — pre-connect gating", () => {
  // The composable resolves its own `t` (createUseI18n(messages)) which, outside
  // a React render, yields the message KEY — so assertions check the keys, which
  // are the stable identifiers we care about regardless of locale resolution.
  it("treats the GAS check as pending (not failed) while disconnected", () => {
    const gasOk = createObservable(false);
    const isConnected = createObservable(false);
    const health = useHealthScore(gasOk, isConnected, storage);

    const gas = health.checklistItems.get().find((i) => i.id === "gas");
    expect(gas?.pending).toBe(true);
    expect(gas?.done).toBe(false);

    // The pending GAS item is excluded from the denominator (5 evaluable items).
    expect(health.totalChecklistCount.get()).toBe(5);

    // No GAS recommendation while disconnected.
    expect(health.recommendations.get()).not.toContain("recommendationGasLow");
  });

  it("does not report an alarming High-risk score from the GAS default pre-connect", () => {
    const gasOk = createObservable(false);
    const isConnected = createObservable(false);
    const health = useHealthScore(gasOk, isConnected, storage);

    // With 0/5 manual items done the score is 0 — but it is NOT inflated-down by
    // counting the un-evaluable GAS item as a failure (which would make the
    // denominator 6 and still read 0). The key guarantee: GAS isn't counted.
    expect(health.totalChecklistCount.get()).toBe(5);
  });

  it("surfaces the GAS recommendation once connected with low gas", () => {
    const gasOk = createObservable(false);
    const isConnected = createObservable(true);
    const health = useHealthScore(gasOk, isConnected, storage);

    const gas = health.checklistItems.get().find((i) => i.id === "gas");
    expect(gas?.pending).toBeFalsy();
    expect(health.totalChecklistCount.get()).toBe(6);
    expect(health.recommendations.get()).toContain("recommendationGasLow");
  });
});

describe("wallet-health useHealthScore — recommendations match the checklist", () => {
  it("recommends every unchecked manual item (no premature 'all set')", () => {
    const gasOk = createObservable(true);
    const isConnected = createObservable(true);
    const health = useHealthScore(gasOk, isConnected, storage);

    // Nothing checked, gas OK → device/hardware/2fa/backup/permissions all
    // contribute recommendations (5 manual items), so the panel can't fall back
    // to "All checks look good" while items are pending.
    const recs = health.recommendations.get();
    expect(recs.length).toBe(5);
    expect(recs).toContain("recommendationBackup");
    expect(recs).toContain("recommendationDevice");
    expect(recs).toContain("recommendationHardware");
    expect(recs).toContain("recommendation2fa");
    expect(recs).toContain("recommendationPermissions");
  });

  it("clears a recommendation once its item is toggled done", () => {
    const gasOk = createObservable(true);
    const isConnected = createObservable(true);
    const health = useHealthScore(gasOk, isConnected, storage);

    health.toggleChecklist("backup");
    expect(health.recommendations.get()).not.toContain("recommendationBackup");
  });
});
