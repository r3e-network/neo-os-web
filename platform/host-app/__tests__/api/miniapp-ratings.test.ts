/** @jest-environment node */

import { createMocks } from "node-mocks-http";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFromChain: Record<string, jest.Mock> = {};
const mockFrom = jest.fn(() => mockFromChain);

function resetChain() {
  const methods = ["select", "insert", "update", "delete", "upsert", "eq", "single", "in", "order", "limit"];
  for (const m of methods) {
    mockFromChain[m] = jest.fn(() => mockFromChain);
  }
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

jest.mock("@/lib/security/ratelimit", () => ({
  apiRateLimiter: { check: () => ({ allowed: true, remaining: 99 }), windowSec: 60 },
  writeRateLimiter: { check: () => ({ allowed: true, remaining: 99 }), windowSec: 60 },
  authRateLimiter: { check: () => ({ allowed: true, remaining: 99 }), windowSec: 60 },
}));

jest.mock("@/lib/admin-auth", () => ({
  requireAdmin: jest.fn(() => ({ ok: true })),
}));

import handler from "@/pages/api/miniapps/[appId]/reviews/ratings";

// Suppress console.error
beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/miniapps/[appId]/reviews/ratings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetChain();
    mockFrom.mockReturnValue(mockFromChain);
  });

  it("rejects missing appId", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
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

  describe("GET ratings", () => {
    it("returns rating distribution and average", async () => {
      const ratings = [
        { rating_value: 5, review_text: "Great", wallet_address: "Naddr1" },
        { rating_value: 4, review_text: null, wallet_address: "Naddr2" },
        { rating_value: 5, review_text: "Awesome", wallet_address: "Naddr3" },
      ];
      mockFromChain.eq = jest.fn(() => ({
        data: ratings,
        error: null,
      }));

      const { req, res } = createMocks({
        method: "GET",
        query: { appId: "test-app" },
      });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const body = JSON.parse(res._getData());
      expect(body.rating.total_ratings).toBe(3);
      expect(body.rating.avg_rating).toBeCloseTo(4.667, 2);
      expect(body.rating.distribution["5"]).toBe(2);
      expect(body.rating.distribution["4"]).toBe(1);
    });

    it("includes user_rating when wallet query param provided", async () => {
      const ratings = [{ rating_value: 3, review_text: "OK", wallet_address: "NMyWallet" }];
      mockFromChain.eq = jest.fn(() => ({
        data: ratings,
        error: null,
      }));

      const { req, res } = createMocks({
        method: "GET",
        query: { appId: "test-app", wallet: "NMyWallet" },
      });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const body = JSON.parse(res._getData());
      expect(body.rating.user_rating).toBeDefined();
      expect(body.rating.user_rating.rating_value).toBe(3);
    });

    it("returns 500 on DB error", async () => {
      mockFromChain.eq = jest.fn(() => ({
        data: null,
        error: { message: "DB fail" },
      }));

      const { req, res } = createMocks({
        method: "GET",
        query: { appId: "test-app" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(500);
    });
  });

  describe("POST rating", () => {
    it("rejects when auth fails", async () => {
      const { requireWalletAuth } = require("@/lib/security/wallet-auth");
      requireWalletAuth.mockReturnValueOnce({
        ok: false,
        status: 401,
        error: "No auth",
      });

      const { req, res } = createMocks({
        method: "POST",
        query: { appId: "test-app" },
        body: { value: 5 },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(401);
    });

    it("rejects invalid rating value (out of range)", async () => {
      const { req, res } = createMocks({
        method: "POST",
        query: { appId: "test-app" },
        body: { value: 6 },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData()).error).toBe("Validation failed");
    });

    it("rejects non-numeric rating value", async () => {
      const { req, res } = createMocks({
        method: "POST",
        query: { appId: "test-app" },
        body: { value: "five" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });

    it("upserts rating on valid POST", async () => {
      mockFromChain.upsert = jest.fn(() => ({
        error: null,
      }));

      const { req, res } = createMocks({
        method: "POST",
        query: { appId: "test-app" },
        body: { value: 4, review: "Good app" },
      });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(201);
      expect(mockFrom).toHaveBeenCalledWith("miniapp_ratings");
    });

    it("returns 500 on upsert DB error", async () => {
      mockFromChain.upsert = jest.fn(() => ({
        error: { message: "upsert fail" },
      }));

      const { req, res } = createMocks({
        method: "POST",
        query: { appId: "test-app" },
        body: { value: 3 },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(500);
    });
  });
});
