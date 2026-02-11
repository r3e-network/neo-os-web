/** @jest-environment node */

import { createMocks } from "node-mocks-http";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFromChain: Record<string, jest.Mock> = {};
const mockFrom = jest.fn(() => mockFromChain);

let mockResult: { data: unknown; error: unknown } = { data: null, error: null };

function resetChain() {
  const methods = ["select", "insert", "update", "delete", "upsert", "eq", "single", "in", "order", "limit"];
  for (const m of methods) {
    mockFromChain[m] = jest.fn(() => mockFromChain);
  }
  // Make chain thenable so `await db.from().select().eq().eq()` resolves
  (mockFromChain as any).then = (resolve: (v: unknown) => void) => resolve(mockResult);
}
resetChain();

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
  isSupabaseConfigured: true,
}));

jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: jest.fn(() => ({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  })),
}));

import handler from "@/pages/api/miniapps/[appId]/cloud-saves";

// Suppress console.error
beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/miniapps/[appId]/cloud-saves", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetChain();
    mockFrom.mockReturnValue(mockFromChain);
    mockResult = { data: null, error: null };
  });

  it("returns 500 when DB not configured", async () => {
    // Temporarily override supabaseAdmin to null
    const supabaseMod = require("@/lib/supabase");
    const original = supabaseMod.supabaseAdmin;
    supabaseMod.supabaseAdmin = null;

    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "test-app" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);

    supabaseMod.supabaseAdmin = original;
  });

  it("rejects when auth fails", async () => {
    const { requireWalletAuth } = require("@/lib/security/wallet-auth");
    requireWalletAuth.mockReturnValueOnce({
      ok: false,
      status: 401,
      error: "No auth",
    });

    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "test-app" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("rejects missing appId", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: {},
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("rejects unsupported methods", async () => {
    const { req, res } = createMocks({
      method: "DELETE",
      query: { appId: "test-app" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  describe("GET saves", () => {
    it("returns saves array on success", async () => {
      const saves = [
        { slot_name: "default", save_data: { level: 5 } },
        { slot_name: "backup", save_data: { level: 3 } },
      ];
      mockResult = { data: saves, error: null };

      const { req, res } = createMocks({
        method: "GET",
        query: { appId: "test-app" },
      });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const body = JSON.parse(res._getData());
      expect(body.saves).toHaveLength(2);
      expect(body.saves[0].slot_name).toBe("default");
    });

    it("returns empty array when no saves exist", async () => {
      mockResult = { data: [], error: null };

      const { req, res } = createMocks({
        method: "GET",
        query: { appId: "test-app" },
      });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const body = JSON.parse(res._getData());
      expect(body.saves).toEqual([]);
    });

    it("returns 500 on DB error", async () => {
      mockResult = { data: null, error: { message: "query fail" } };

      const { req, res } = createMocks({
        method: "GET",
        query: { appId: "test-app" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(500);
    });
  });

  describe("PUT save", () => {
    it("rejects missing save_data", async () => {
      const { req, res } = createMocks({
        method: "PUT",
        query: { appId: "test-app" },
        body: { slot_name: "default" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData()).error).toContain("Save data required");
    });

    it("upserts save on valid PUT", async () => {
      const savedRow = {
        app_id: "test-app",
        wallet_address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
        slot_name: "default",
        save_data: { level: 10 },
      };
      mockFromChain.upsert = jest.fn(() => ({
        ...mockFromChain,
        select: jest.fn(() => ({
          ...mockFromChain,
          single: jest.fn().mockResolvedValueOnce({
            data: savedRow,
            error: null,
          }),
        })),
      }));

      const { req, res } = createMocks({
        method: "PUT",
        query: { appId: "test-app" },
        body: { save_data: { level: 10 }, slot_name: "default" },
      });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const body = JSON.parse(res._getData());
      expect(body.save.slot_name).toBe("default");
    });

    it("returns 500 on upsert DB error", async () => {
      mockFromChain.upsert = jest.fn(() => ({
        ...mockFromChain,
        select: jest.fn(() => ({
          ...mockFromChain,
          single: jest.fn().mockResolvedValueOnce({
            data: null,
            error: { message: "upsert fail" },
          }),
        })),
      }));

      const { req, res } = createMocks({
        method: "PUT",
        query: { appId: "test-app" },
        body: { save_data: { level: 1 } },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(500);
    });
  });
});
