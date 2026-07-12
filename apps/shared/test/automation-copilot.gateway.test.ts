import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAutomationTriggerRequest,
  callAutomationEndpoint,
  isLocalAutomationIntent,
  normalizeTriggerList,
  resolveRuntimeCredentialHeaders,
} from "../../automation-copilot/src/automationGateway";

// Simulates the embedded opaque-sandbox context (audit fix C-4): the copilot
// document has a parent window that is not itself. Returns the fake parent so
// tests can assert on the credential bridge request envelope.
function stubEmbeddedHost(respond?: (message: Record<string, unknown>) => void) {
  const fakeParent = {
    postMessage: vi.fn((message: unknown) => {
      if (!respond) return;
      const record = message as Record<string, unknown>;
      setTimeout(() => respond(record), 0);
    }),
  };
  vi.stubGlobal("parent", fakeParent);
  return fakeParent;
}

function dispatchCredentialResponse(overrides: Record<string, unknown>) {
  window.dispatchEvent(
    new MessageEvent("message", {
      // Default MessageEvent source is null, which the client treats as a
      // synthetic same-document event (same convention as the wallet SDK
      // bridge tests); origin matches the URL-derived host origin.
      origin: window.location.origin,
      data: {
        type: "neo-miniapp-credential:response",
        version: 1,
        ok: true,
        token: "",
        apiKey: "",
        ...overrides,
      },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("Automation Copilot gateway helpers", () => {
  it("builds the exact host automation trigger request", () => {
    const request = buildAutomationTriggerRequest({
      asset: "neo",
      targetPrice: "25.5",
      schedule: "0 */6 * * *",
      actionName: "auto_repay_self_loan",
      network: "testnet",
      datafeedHash: "0xfeed",
      currentPrice: 23.25,
    });

    expect(request).toMatchObject({
      name: "NEO 25.5 auto_repay_self_loan",
      trigger_type: "threshold",
      schedule: "0 */6 * * *",
      condition: {
        kind: "price_threshold",
        asset: "NEO",
        operator: "gte",
        target_price: 25.5,
        current_price: 23.25,
        datafeed_contract: "0xfeed",
        network: "testnet",
      },
      action: {
        type: "morpheus_workflow",
        workflow_id: "automation.upkeep",
        route: "/automation/execute",
        action_name: "auto_repay_self_loan",
        app_id: "miniapp-automation-copilot",
      },
    });
  });

  it("calls the host edge automation endpoint and unwraps local fallback metadata", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        data: {
          id: "local-auto-123",
          name: "NEO trigger",
          trigger_type: "threshold",
          enabled: false,
          created_at: "2026-06-01T00:00:00.000Z",
          registration_state: "local_automation_intent",
        },
        meta: { state: "local_automation_intent" },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAutomationEndpoint("automation-triggers", {
      method: "POST",
      body: { name: "NEO trigger", trigger_type: "threshold", action: {} },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/edge/automation-triggers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "NEO trigger", trigger_type: "threshold", action: {} }),
      }),
    );
    expect(result.meta.state).toBe("local_automation_intent");
    expect(result.data).toMatchObject({ id: "local-auto-123" });
  });

  it("forwards the signed-in host session to the automation gateway", async () => {
    window.sessionStorage.setItem("sb-access-token", "automation-session-token");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ ok: true, data: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await callAutomationEndpoint("automation-triggers", { method: "GET" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/edge/automation-triggers",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer automation-session-token",
        }),
      }),
    );
  });

  it("obtains the host session over the credential bridge inside the opaque sandbox", async () => {
    // Audit fix C-4: embedded copilot documents cannot reach same-origin
    // storage, so the credential must arrive from the host bridge.
    const fakeParent = stubEmbeddedHost((request) => {
      dispatchCredentialResponse({
        requestId: request.requestId,
        token: "bridge-session-token",
      });
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ ok: true, data: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await callAutomationEndpoint("automation-triggers", { method: "GET" });

    expect(fakeParent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "neo-miniapp-credential:request",
        version: 1,
        appId: "miniapp-automation-copilot",
        scope: "automation-gateway",
      }),
      window.location.origin,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/edge/automation-triggers",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer bridge-session-token",
        }),
      }),
    );
  });

  it("prefers the direct storage credential over a bridge roundtrip", async () => {
    const fakeParent = stubEmbeddedHost();
    window.sessionStorage.setItem("sb-access-token", "storage-session-token");

    const headers = await resolveRuntimeCredentialHeaders({ bridgeTimeoutMs: 20 });

    expect(headers.Authorization).toBe("Bearer storage-session-token");
    expect(fakeParent.postMessage).not.toHaveBeenCalled();
  });

  it("falls back to unauthenticated headers when the credential bridge does not answer", async () => {
    const fakeParent = stubEmbeddedHost();

    const headers = await resolveRuntimeCredentialHeaders({ bridgeTimeoutMs: 20 });

    expect(fakeParent.postMessage).toHaveBeenCalledTimes(1);
    expect(headers).toEqual({ "Content-Type": "application/json" });
  });

  it("ignores forged bridge responses that do not match the outstanding request", async () => {
    stubEmbeddedHost((request) => {
      // Wrong requestId first (must be ignored), then the real answer.
      dispatchCredentialResponse({
        requestId: "attacker-guess-000",
        token: "forged-token",
      });
      dispatchCredentialResponse({
        requestId: request.requestId,
        token: "bridge-session-token",
      });
    });

    const headers = await resolveRuntimeCredentialHeaders({ bridgeTimeoutMs: 500 });

    expect(headers.Authorization).toBe("Bearer bridge-session-token");
  });

  it("normalizes trigger arrays and wrapped trigger lists", () => {
    expect(
      normalizeTriggerList({
        triggers: [
          {
            id: "trigger-1",
            name: "NEO trigger",
            trigger_type: "threshold",
            enabled: true,
            created_at: "2026-06-01T00:00:00.000Z",
          },
          { bad: true },
        ],
      }),
    ).toEqual([
      {
        id: "trigger-1",
        name: "NEO trigger",
        trigger_type: "threshold",
        schedule: "",
        condition: undefined,
        action: undefined,
        enabled: true,
        created_at: "2026-06-01T00:00:00.000Z",
        next_execution: "",
        last_execution: "",
        registration_state: "",
      },
    ]);
  });

  it("detects local automation handoff intents from trigger or gateway metadata", () => {
    expect(isLocalAutomationIntent({ registration_state: "local_automation_intent" })).toBe(true);
    expect(isLocalAutomationIntent(null, { state: "local_automation_intent" })).toBe(true);
    expect(isLocalAutomationIntent({ registration_state: "" }, { state: "created" })).toBe(false);
  });
});
