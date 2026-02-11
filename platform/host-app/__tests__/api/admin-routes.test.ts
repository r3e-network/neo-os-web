/** @jest-environment node */

import { createMocks } from "node-mocks-http";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFromChain: Record<string, jest.Mock> = {};
const mockFrom = jest.fn(() => mockFromChain);
const mockRpc = jest.fn().mockResolvedValue({ error: null });
let mockResult: { data: unknown; error: unknown; count?: number } = { data: null, error: null };

function resetChain() {
  const methods = ["select", "insert", "update", "delete", "upsert", "eq", "single", "order", "limit", "range", "in"];
  for (const m of methods) {
    mockFromChain[m] = jest.fn(() => mockFromChain);
  }
  (mockFromChain as any).then = (resolve: (v: unknown) => void) => resolve(mockResult);
}
resetChain();

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom, rpc: mockRpc },
  isSupabaseConfigured: true,
}));

jest.mock("@/lib/admin-auth", () => ({
  requireAdmin: jest.fn(() => ({ ok: true })),
}));

import reviewQueueHandler from "@/pages/api/admin/miniapps/review-queue";
import reviewHandler from "@/pages/api/admin/miniapps/review";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => jest.restoreAllMocks());

beforeEach(() => {
  resetChain();
  mockFrom.mockClear();
  mockRpc.mockClear().mockResolvedValue({ error: null });
  mockResult = { data: null, error: null };
  (requireAdmin as jest.Mock).mockReturnValue({ ok: true });
});

// ===========================================================================
// review-queue.ts
// ===========================================================================

describe("GET /api/admin/miniapps/review-queue", () => {
  it("returns 405 for non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await reviewQueueHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ error: "Method not allowed" });
  });

  it("returns 401 when admin auth fails", async () => {
    (requireAdmin as jest.Mock).mockReturnValue({ ok: false, status: 401, error: "Unauthorized" });
    const { req, res } = createMocks({ method: "GET" });
    await reviewQueueHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
    expect(res._getJSONData()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when DB not configured", async () => {
    const mod = jest.requireMock("@/lib/supabase") as any;
    const original = mod.supabaseAdmin;
    mod.supabaseAdmin = null;
    try {
      const { req, res } = createMocks({ method: "GET" });
      await reviewQueueHandler(req, res);
      expect(res._getStatusCode()).toBe(500);
      expect(res._getJSONData()).toEqual({ error: "Database not configured" });
    } finally {
      mod.supabaseAdmin = original;
    }
  });

  it("returns 200 with empty items when no pending reviews", async () => {
    mockResult = { data: [], error: null };
    const { req, res } = createMocks({ method: "GET" });
    await reviewQueueHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ items: [] });
  });

  it("returns 200 with review queue items", async () => {
    const versionRow = {
      id: "v1",
      app_id: "app1",
      version: "1.0.0",
      version_code: 1,
      entry_url: "https://example.com/app",
      status: "pending_review",
      supported_chains: ["neo-n3-mainnet"],
      contracts: {},
      release_notes: "Initial release",
      release_notes_zh: null,
      created_at: "2025-01-01T00:00:00Z",
      miniapp_registry: {
        name: "Test App",
        name_zh: null,
        description: "A test app",
        description_zh: null,
        category: "utility",
        icon_url: null,
        banner_url: null,
        developer_address: "NXaddr",
        developer_name: "dev",
        status: "pending_review",
        visibility: "private",
      },
    };

    mockResult = { data: [versionRow], error: null };
    const { req, res } = createMocks({ method: "GET" });
    await reviewQueueHandler(req, res);
    expect(res._getStatusCode()).toBe(200);

    const body = res._getJSONData();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].app_id).toBe("app1");
    expect(body.items[0].version.id).toBe("v1");
    expect(body.items[0].app.name).toBe("Test App");
  });

  it("returns 500 on DB error", async () => {
    mockResult = { data: null, error: { message: "query fail" } };
    const { req, res } = createMocks({ method: "GET" });
    await reviewQueueHandler(req, res);
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Failed to load review queue" });
  });
});

// ===========================================================================
// review.ts
// ===========================================================================

describe("POST /api/admin/miniapps/review", () => {
  it("returns 405 for non-POST methods", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await reviewHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(res._getJSONData()).toEqual({ error: "Method not allowed" });
  });

  it("returns 401 when admin auth fails", async () => {
    (requireAdmin as jest.Mock).mockReturnValue({ ok: false, status: 401, error: "Unauthorized" });
    const { req, res } = createMocks({ method: "POST" });
    await reviewHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
    expect(res._getJSONData()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when DB not configured", async () => {
    const mod = jest.requireMock("@/lib/supabase") as any;
    const original = mod.supabaseAdmin;
    mod.supabaseAdmin = null;
    try {
      const { req, res } = createMocks({
        method: "POST",
        body: { app_id: "app1", version_id: "v1", action: "approve" },
      });
      await reviewHandler(req, res);
      expect(res._getStatusCode()).toBe(500);
      expect(res._getJSONData()).toEqual({ error: "Database not configured" });
    } finally {
      mod.supabaseAdmin = original;
    }
  });

  it("returns 400 when missing required fields", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { app_id: "app1" },
    });
    await reviewHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "app_id, version_id, and valid action are required",
    });
  });

  it("returns 400 for invalid action value", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { app_id: "app1", version_id: "v1", action: "delete" },
    });
    await reviewHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      error: "app_id, version_id, and valid action are required",
    });
  });

  it("returns 404 when version not found", async () => {
    mockResult = { data: null, error: { message: "not found" } };
    const { req, res } = createMocks({
      method: "POST",
      body: { app_id: "app1", version_id: "v1", action: "approve" },
    });
    await reviewHandler(req, res);
    expect(res._getStatusCode()).toBe(404);
    expect(res._getJSONData()).toEqual({ error: "Version not found" });
  });

  it("returns 200 on approve action", async () => {
    mockResult = {
      data: { id: "v1", app_id: "app1", supported_chains: ["neo-n3-mainnet"], contracts: {} },
      error: null,
    };
    const { req, res } = createMocks({
      method: "POST",
      body: { app_id: "app1", version_id: "v1", action: "approve", reviewer: "admin-user" },
    });
    await reviewHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ success: true });
    expect(mockRpc).toHaveBeenCalledWith("publish_version", { p_version_id: "v1" });
  });

  it("returns 200 on reject action", async () => {
    mockResult = {
      data: { id: "v1", app_id: "app1", supported_chains: ["neo-n3-mainnet"], contracts: {} },
      error: null,
    };
    const { req, res } = createMocks({
      method: "POST",
      body: { app_id: "app1", version_id: "v1", action: "reject", notes: "Not ready" },
    });
    await reviewHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ success: true });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 200 on request_changes action", async () => {
    mockResult = {
      data: { id: "v1", app_id: "app1", supported_chains: ["neo-n3-mainnet"], contracts: {} },
      error: null,
    };
    const { req, res } = createMocks({
      method: "POST",
      body: { app_id: "app1", version_id: "v1", action: "request_changes", notes: "Fix icon" },
    });
    await reviewHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ success: true });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 500 on DB error during update", async () => {
    // First call (version lookup) succeeds, then thenable resolves with error for update
    let callCount = 0;
    (mockFromChain as any).then = (resolve: (v: unknown) => void) => {
      callCount++;
      if (callCount === 1) {
        resolve({ data: { id: "v1", app_id: "app1", supported_chains: [], contracts: {} }, error: null });
      } else {
        resolve({ data: null, error: { message: "update failed" } });
      }
    };
    const { req, res } = createMocks({
      method: "POST",
      body: { app_id: "app1", version_id: "v1", action: "reject" },
    });
    await reviewHandler(req, res);
    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Failed to update review status" });
  });
});
