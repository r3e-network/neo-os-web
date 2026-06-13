import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutomationCopilot } from "../../automation-copilot/src/composables/useAutomationCopilot";
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
});

describe("useAutomationCopilot hero status (empty state)", () => {
  it("returns an empty latestTriggerState so the UI falls back to Ready, not N/A", () => {
    const copilot = useAutomationCopilot({ t });
    // No trigger registered yet → empty string (PlayArea resolves to apiIdle).
    expect(copilot.latestTriggerState.get()).toBe("");
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
});
