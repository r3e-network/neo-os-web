import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSDK } from "../src/admin";

/**
 * AdminSDK.updateMiniAppStatus must RETURN the server payload.
 *
 * Regression: it used to resolve `void` and console.warn-swallow the
 * `requires_onchain_confirmation` response, so callers saw a successful
 * Promise while the status change had NOT actually happened (the registry
 * still needed the on-chain invocation submitted).
 */

const CONFIG = {
  adminBaseUrl: "http://admin.test",
  supabaseUrl: "http://supabase.test",
  adminApiKey: "test-admin-key",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("AdminSDK.updateMiniAppStatus", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the response payload on success", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ success: true }));

    const sdk = new AdminSDK(CONFIG);
    const result = await sdk.updateMiniAppStatus("miniapp-demo", "disabled");

    expect(result).toEqual({ success: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://admin.test/api/miniapps/update-status",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ appId: "miniapp-demo", status: "disabled" }),
        headers: expect.objectContaining({ "X-Admin-Key": "test-admin-key" }),
      }),
    );
  });

  it("surfaces requires_onchain_confirmation and the invocation to the caller", async () => {
    const invocation = {
      contract: "0x1234567890abcdef1234567890abcdef12345678",
      method: "setStatus",
      args: ["miniapp-demo", 0],
    };
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ requires_onchain_confirmation: true, invocation }),
    );

    const sdk = new AdminSDK(CONFIG);
    const result = await sdk.updateMiniAppStatus("miniapp-demo", "disabled");

    expect(result.requires_onchain_confirmation).toBe(true);
    expect(result.invocation).toEqual(invocation);
  });

  it("throws on a non-OK response", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: "nope" }, 502));

    const sdk = new AdminSDK(CONFIG);
    await expect(
      sdk.updateMiniAppStatus("miniapp-demo", "active"),
    ).rejects.toThrow("Failed to update MiniApp status (502)");
  });

  it("falls back to { success: true } when the OK response body is not JSON", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("not-json", { status: 200 }),
    );

    const sdk = new AdminSDK(CONFIG);
    const result = await sdk.updateMiniAppStatus("miniapp-demo", "active");

    expect(result).toEqual({ success: true });
  });
});
