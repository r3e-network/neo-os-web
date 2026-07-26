import { beforeEach, describe, expect, it } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import { createUseI18n } from "../composables/useI18n";
import { messages } from "../../wallet-health/src/locale/messages";
import { useHealthScore } from "../../wallet-health/src/composables/useHealthScore";
import type { ChecklistStore } from "../../wallet-health/src/composables/useHealthScore";

// `useHealthScore` exposes user-facing STRINGS (it calls `t(...)` internally), so
// expectations resolve through the same catalog the composable uses. Asserting the
// raw key would only pass via the missing-key fallback in `useI18n` — which is how
// these assertions used to "pass" while `@/locale/messages` mis-resolved to
// apps/shared's catalog under this test program. Resolving here keeps the
// assertions locale-independent without hardcoding English copy.
const { t } = createUseI18n(messages)();

// Every user-facing key these tests compare against. `useI18n` returns the key
// itself when a catalog entry is missing, so a mis-resolved catalog would make
// `toContain(t(key))` compare a key against a key and pass regardless of the
// composable's behaviour. Pinning resolution here keeps that failure mode loud.
const ASSERTED_MESSAGE_KEYS = [
  "recommendation2fa",
  "recommendationBackup",
  "recommendationDevice",
  "recommendationGasLow",
  "recommendationHardware",
  "recommendationPermissions",
  "reviewNotStarted",
] as const;

/**
 * wallet-health findings:
 *  - pre-connect, the auto GAS check must be "pending" (excluded from the score
 *    denominator), NOT a failed item, so a disconnected user doesn't see a false
 *    "top up GAS" recommendation / alarming High-risk verdict;
 *  - recommendations must derive from every unchecked item, so the panel and the
 *    score/risk chip never disagree ("All checks look good" while items pending);
 *  - checklist persistence keys stay byte-identical to the pre-framework
 *    runtime-cache key so existing user data survives the migration.
 */

// Minimal in-memory ChecklistStore (the synchronous device-local checklist
// only needs get/set; app.storage.local satisfies the same shape at runtime).
function memoryStore(): ChecklistStore {
  const data: Record<string, unknown> = {};
  return {
    get<T>(key: string, fallback: T | null = null): T | null {
      return key in data ? (data[key] as T) : fallback;
    },
    set(key: string, value: unknown): void {
      data[key] = value;
    },
  };
}

describe("wallet-health test-catalog resolution", () => {
  it.each(ASSERTED_MESSAGE_KEYS)("resolves %s to real copy, not the key", (key) => {
    const resolved = t(key);
    expect(resolved).not.toBe(key);
    expect(resolved.trim().length).toBeGreaterThan(0);
  });
});

describe("wallet-health useHealthScore — pre-connect gating", () => {
  it("treats the GAS check as pending (not failed) while disconnected", () => {
    const gasOk = createObservable(false);
    const isConnected = createObservable(false);
    const health = useHealthScore(gasOk, isConnected, memoryStore());

    const gas = health.checklistItems.get().find((i) => i.id === "gas");
    expect(gas?.pending).toBe(true);
    expect(gas?.done).toBe(false);

    // The pending GAS item is excluded from the denominator (5 evaluable items).
    expect(health.totalChecklistCount.get()).toBe(5);

    // No GAS recommendation while disconnected.
    expect(health.recommendations.get()).not.toContain(t("recommendationGasLow"));
  });

  it("does not report an alarming High-risk score from the GAS default pre-connect", () => {
    const gasOk = createObservable(false);
    const isConnected = createObservable(false);
    const health = useHealthScore(gasOk, isConnected, memoryStore());

    // With 0/5 manual items done the score is 0 — but it is NOT inflated-down by
    // counting the un-evaluable GAS item as a failure (which would make the
    // denominator 6 and still read 0). The key guarantee: GAS isn't counted.
    expect(health.totalChecklistCount.get()).toBe(5);
    expect(health.riskLabel.get()).toBe(t("reviewNotStarted"));
    expect(health.riskClass.get()).toBe("review-empty");
  });

  it("surfaces the GAS recommendation once connected with low gas", () => {
    const gasOk = createObservable(false);
    const isConnected = createObservable(true);
    const health = useHealthScore(gasOk, isConnected, memoryStore());

    const gas = health.checklistItems.get().find((i) => i.id === "gas");
    expect(gas?.pending).toBeFalsy();
    expect(health.totalChecklistCount.get()).toBe(6);
    expect(health.recommendations.get()).toContain(t("recommendationGasLow"));
  });
});

describe("wallet-health useHealthScore — recommendations match the checklist", () => {
  it("recommends every unchecked manual item (no premature 'all set')", () => {
    const gasOk = createObservable(true);
    const isConnected = createObservable(true);
    const health = useHealthScore(gasOk, isConnected, memoryStore());

    // Nothing checked, gas OK → device/hardware/2fa/backup/permissions all
    // contribute recommendations (5 manual items), so the panel can't fall back
    // to "All checks look good" while items are pending.
    const recs = health.recommendations.get();
    expect(recs.length).toBe(5);
    expect(recs).toContain(t("recommendationBackup"));
    expect(recs).toContain(t("recommendationDevice"));
    expect(recs).toContain(t("recommendationHardware"));
    expect(recs).toContain(t("recommendation2fa"));
    expect(recs).toContain(t("recommendationPermissions"));
  });

  it("clears a recommendation once its item is toggled done", () => {
    const gasOk = createObservable(true);
    const isConnected = createObservable(true);
    const health = useHealthScore(gasOk, isConnected, memoryStore());

    health.toggleChecklist("backup");
    expect(health.recommendations.get()).not.toContain(t("recommendationBackup"));
  });
});

describe("wallet-health checklist persistence — legacy storage key survives the framework migration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeApp() {
    const chain = {
      address: createObservable<string | null>(null),
      ensureWallet: async () => "",
      read: async () => "0",
      invoke: async () => ({ txid: "0x0", success: true }),
    };
    return createMiniAppFramework(
      { services: { chain }, t: (key: string) => key } as never,
      {
        appId: "miniapp-wallet-health",
        // Mirrors main.tsx: the checklist lived under the raw
        // "miniapp-wallet-health:checklist" key before app.storage.local.
        storagePrefix: "miniapp-wallet-health:",
      },
    );
  }

  it("writes the exact pre-framework localStorage key via app.storage.local", () => {
    const app = makeApp();
    const health = useHealthScore(
      createObservable(true),
      createObservable(true),
      app.storage.local,
    );

    health.toggleChecklist("backup");

    expect(localStorage.getItem("miniapp-wallet-health:checklist")).toBe(
      JSON.stringify({ backup: true }),
    );
  });

  it("resolves checklist state persisted under the legacy key (round-trip)", () => {
    // Simulate data written by the pre-framework runtime-cache build.
    localStorage.setItem(
      "miniapp-wallet-health:checklist",
      JSON.stringify({ backup: true, device: true }),
    );

    const app = makeApp();
    const health = useHealthScore(
      createObservable(true),
      createObservable(true),
      app.storage.local,
    );
    health.loadChecklist();

    const done = health.checklistItems
      .get()
      .filter((item) => item.done)
      .map((item) => item.id);
    expect(done).toContain("backup");
    expect(done).toContain("device");
  });
});

describe("wallet-health checklist persistence — untrusted local data", () => {
  it("accepts only known boolean checklist values", () => {
    const store: ChecklistStore = {
      get: () => ({
        backup: "false",
        device: true,
        gas: true,
        rogue: true,
      }) as never,
      set: () => undefined,
    };
    const health = useHealthScore(
      createObservable(false),
      createObservable(false),
      store,
    );

    health.loadChecklist();
    const done = health.checklistItems.get().filter((item) => item.done).map((item) => item.id);
    expect(done).toEqual(["device"]);
    health.toggleChecklist("gas");
    health.toggleChecklist("rogue");
    expect(health.checklistItems.get().filter((item) => item.done).map((item) => item.id)).toEqual(["device"]);
  });

  it("continues in-memory when browser storage is unavailable", () => {
    const brokenStore: ChecklistStore = {
      get: () => { throw new Error("blocked"); },
      set: () => { throw new Error("blocked"); },
    };
    const health = useHealthScore(
      createObservable(true),
      createObservable(true),
      brokenStore,
    );

    expect(() => health.loadChecklist()).not.toThrow();
    expect(health.storageAvailable.get()).toBe(false);
    expect(() => health.toggleChecklist("backup")).not.toThrow();
    expect(health.checklistItems.get().find((item) => item.id === "backup")?.done).toBe(true);
    expect(health.storageAvailable.get()).toBe(false);
  });
});
