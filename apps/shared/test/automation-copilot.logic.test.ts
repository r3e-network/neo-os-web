import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FRESH_PRICE_MAX_AGE_SECONDS,
  assessPriceFreshness,
  useAutomationCopilot,
} from "../../automation-copilot/src/composables/useAutomationCopilot";
import type { AutomationTrigger } from "../../automation-copilot/src/automationGateway";

/**
 * Drives the useAutomationCopilot composable for the UX fixes that don't depend
 * on the live datafeed: cron schedule validation, the empty-state hero status,
 * and multi-trigger select/delete (the edge layer's delete endpoint).
 *
 * fetch is mocked so deleteTrigger's automation-trigger-delete call is observed
 * without a network round-trip.
 */

function t(key: string) {
  return key;
}

function trigger(id: string, over: Partial<AutomationTrigger> = {}): AutomationTrigger {
  return {
    id,
    name: `Trigger ${id}`,
    trigger_type: "threshold",
    enabled: true,
    created_at: "2026-06-01T00:00:00.000Z",
    ...over,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true, data: { status: "deleted" }, meta: {} }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useAutomationCopilot schedule validation", () => {
  it("rejects a malformed cron schedule before building the recipe", () => {
    const copilot = useAutomationCopilot({ t });
    copilot.targetPrice.set("20");
    copilot.schedule.set("not a cron");

    expect(() => copilot.buildRecipePayload()).toThrow();
    expect(copilot.lastError.get()).toBe("scheduleInvalid");
  });

  it("accepts a valid 5-field cron schedule", () => {
    const copilot = useAutomationCopilot({ t });
    copilot.targetPrice.set("20");
    copilot.schedule.set("0 */6 * * *");

    expect(copilot.buildRecipePayload()).toEqual({ success: true });
    expect(copilot.lastError.get()).toBe("");
  });

  it("rejects cron values outside their field ranges", () => {
    const copilot = useAutomationCopilot({ t });
    copilot.targetPrice.set("20");

    for (const schedule of [
      "60 * * * *",
      "0 24 * * *",
      "0 0 0 * *",
      "0 0 * 13 *",
      "0 0 * * 8",
      "0 */0 * * *",
      "0 10-2 * * *",
    ]) {
      copilot.schedule.set(schedule);
      expect(() => copilot.buildRecipePayload()).toThrow();
      expect(copilot.lastError.get()).toBe("scheduleInvalid");
    }
  });

  it("rejects blank or malformed workflow identifiers", () => {
    const copilot = useAutomationCopilot({ t });
    copilot.targetPrice.set("20");
    copilot.schedule.set("0 */6 * * *");

    for (const actionName of ["", "1bad", "has spaces", "x".repeat(65)]) {
      copilot.actionName.set(actionName);
      expect(() => copilot.buildRecipePayload()).toThrow();
      expect(copilot.lastError.get()).toBe("actionNameInvalid");
    }
  });
});

describe("useAutomationCopilot price readiness", () => {
  it("classifies feed timestamps without trusting missing or future metadata", () => {
    const nowMs = Date.UTC(2026, 6, 11, 12, 0, 0);
    const nowSeconds = Math.floor(nowMs / 1000);

    expect(assessPriceFreshness(nowSeconds - FRESH_PRICE_MAX_AGE_SECONDS, nowMs)).toBe("fresh");
    expect(assessPriceFreshness(nowSeconds - FRESH_PRICE_MAX_AGE_SECONDS - 1, nowMs)).toBe("stale");
    expect(assessPriceFreshness(0, nowMs)).toBe("unknown");
    expect(assessPriceFreshness(nowSeconds + 301, nowMs)).toBe("unknown");
  });

  it("requires a fresh fetched price before remote registration", async () => {
    const copilot = useAutomationCopilot({ t });

    await expect(copilot.registerTrigger()).rejects.toThrow("priceRequired");
    expect(fetchMock).not.toHaveBeenCalled();

    copilot.latestPrice.set(20);
    copilot.priceFreshnessState.set("stale");
    copilot.buildRecipePayload();
    expect(copilot.triggerRequest.get()?.condition.current_price).toBeNull();
    await expect(copilot.registerTrigger()).rejects.toThrow("priceStale");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("invalidates price and copied request state when the watched asset changes", () => {
    const copilot = useAutomationCopilot({ t });
    copilot.latestPrice.set(20);
    copilot.priceDataTimestamp.set(1_700_000_000);
    copilot.priceFreshnessState.set("fresh");
    copilot.buildRecipePayload();
    expect(copilot.triggerRequest.get()).not.toBeNull();

    copilot.asset.set("GAS");

    expect(copilot.latestPrice.get()).toBeNull();
    expect(copilot.priceDataTimestamp.get()).toBe(0);
    expect(copilot.priceFreshnessState.get()).toBe("unloaded");
    expect(copilot.triggerRequest.get()).toBeNull();
  });
});

describe("useAutomationCopilot hero status (empty state)", () => {
  it("returns an empty latestTriggerState so the UI falls back to Ready, not N/A", () => {
    const copilot = useAutomationCopilot({ t });
    // No trigger registered yet → empty string (PlayArea resolves to apiIdle).
    expect(copilot.latestTriggerState.get()).toBe("");
  });

  it("exposes a locale-independent trigger mode for scene state", () => {
    const copilot = useAutomationCopilot({ t });
    expect(copilot.latestTriggerMode.get()).toBe("draft");

    copilot.latestTrigger.set(trigger("live", { enabled: true }));
    expect(copilot.latestTriggerMode.get()).toBe("enabled");

    copilot.latestTrigger.set(trigger("paused", { enabled: false }));
    expect(copilot.latestTriggerMode.get()).toBe("disabled");

    copilot.latestTrigger.set(
      trigger("handoff", { registration_state: "local_automation_intent" }),
    );
    expect(copilot.latestTriggerMode.get()).toBe("handoff");
  });
});

describe("useAutomationCopilot multi-trigger management", () => {
  it("selects a trigger from the list as the active trigger", () => {
    const copilot = useAutomationCopilot({ t });
    copilot.triggers.set([trigger("a"), trigger("b")]);
    copilot.latestTrigger.set(trigger("a"));

    copilot.selectTrigger("b");

    expect(copilot.latestTrigger.get()?.id).toBe("b");
  });

  it("deletes a verified trigger via the delete endpoint and drops it from the list", async () => {
    const copilot = useAutomationCopilot({ t });
    copilot.triggers.set([trigger("a"), trigger("b")]);
    copilot.latestTrigger.set(trigger("a"));

    await copilot.deleteTrigger("a");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/edge/automation-trigger-delete",
      expect.objectContaining({ method: "POST" }),
    );
    const remaining = copilot.triggers.get().map((tr) => tr.id);
    expect(remaining).toEqual(["b"]);
    // The active selection re-points to the next remaining trigger.
    expect(copilot.latestTrigger.get()?.id).toBe("b");
  });

  it("drops a local handoff intent without any network call", async () => {
    const copilot = useAutomationCopilot({ t });
    copilot.triggers.set([trigger("a")]);
    copilot.latestTrigger.set(
      trigger("local-1", { registration_state: "local_automation_intent" }),
    );
    copilot.triggers.set([
      trigger("local-1", { registration_state: "local_automation_intent" }),
    ]);

    await copilot.deleteTrigger("local-1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(copilot.triggers.get()).toHaveLength(0);
  });

  it("preserves verified triggers when the local gateway cannot list remote state", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        data: [],
        meta: { state: "local_automation_unavailable" },
      }),
    });
    const copilot = useAutomationCopilot({ t });
    copilot.triggers.set([trigger("existing")]);

    await expect(copilot.refreshTriggers()).rejects.toThrow("automationGatewayUnavailable");

    expect(copilot.triggers.get().map((item) => item.id)).toEqual(["existing"]);
    expect(copilot.lastError.get()).toBe("automationGatewayUnavailable");
  });

  it("does not fake a remote status change when the gateway returns a handoff", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        data: { status: "disabled" },
        meta: { state: "local_automation_intent" },
      }),
    });
    const copilot = useAutomationCopilot({ t });
    const live = trigger("live", { enabled: true });
    copilot.triggers.set([live]);
    copilot.latestTrigger.set(live);

    await expect(copilot.toggleLatestTrigger()).rejects.toThrow("automationGatewayUnavailable");

    expect(copilot.latestTrigger.get()?.enabled).toBe(true);
    expect(copilot.triggers.get()[0]?.enabled).toBe(true);
  });

  it("does not remove a verified trigger when remote deletion was not executed", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        data: { status: "deleted" },
        meta: { state: "local_automation_intent" },
      }),
    });
    const copilot = useAutomationCopilot({ t });
    copilot.triggers.set([trigger("live")]);
    copilot.latestTrigger.set(trigger("live"));

    await expect(copilot.deleteTrigger("live")).rejects.toThrow("automationGatewayUnavailable");

    expect(copilot.triggers.get().map((item) => item.id)).toEqual(["live"]);
    expect(copilot.latestTrigger.get()?.id).toBe("live");
  });
});
