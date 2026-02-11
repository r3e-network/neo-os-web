/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: jest.fn(() => ({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  })),
}));

jest.mock("@/lib/security/ratelimit", () => ({
  apiRateLimiter: { check: jest.fn(() => ({ allowed: true, remaining: 99 })), windowSec: 60 },
  writeRateLimiter: { check: jest.fn(() => ({ allowed: true, remaining: 19 })), windowSec: 60 },
  authRateLimiter: { check: jest.fn(() => ({ allowed: true, remaining: 9 })), windowSec: 60 },
}));

jest.mock("@/lib/admin-auth", () => ({
  requireAdmin: jest.fn(() => ({ ok: true })),
}));

import handler from "@/pages/api/user/wishlist";

function chainable(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "order", "upsert", "single", "delete", "range"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  Object.assign(chain, overrides);
  return chain;
}

describe("Wishlist API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 405 for PATCH", async () => {
    const { req, res } = createMocks({ method: "PATCH" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  describe("GET", () => {
    it("returns wishlist items", async () => {
      const items = [{ app_id: "app1", created_at: "2026-01-01" }];
      const chain = chainable({
        order: jest.fn().mockResolvedValue({ data: items, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.wishlist).toHaveLength(1);
    });
  });

  describe("POST", () => {
    it("returns 400 on missing app_id", async () => {
      const { req, res } = createMocks({ method: "POST", body: {} });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });

    it("adds item to wishlist", async () => {
      const item = { app_id: "app1", wallet_address: "NNLi44d" };
      const chain = chainable({
        single: jest.fn().mockResolvedValue({ data: item, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      const { req, res } = createMocks({
        method: "POST",
        body: { app_id: "app1" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe("DELETE", () => {
    it("removes item from wishlist", async () => {
      const chain = chainable();
      // delete().eq(wallet).eq(app_id) — last eq resolves
      const deleteChain: Record<string, jest.Mock> = {};
      deleteChain.eq = jest.fn().mockReturnValueOnce({ eq: jest.fn().mockResolvedValue({}) });
      chain.delete = jest.fn().mockReturnValue(deleteChain);
      mockFrom.mockReturnValue(chain);

      const { req, res } = createMocks({
        method: "DELETE",
        body: { app_id: "app1" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
    });
  });
});
