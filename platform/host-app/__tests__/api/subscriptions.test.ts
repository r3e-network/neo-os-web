/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

import handler from "@/pages/api/subscriptions/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chainable(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "order", "range", "upsert", "single"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  Object.assign(chain, overrides);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Subscriptions API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({ method: "DELETE" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  describe("GET", () => {
    it("returns subscriptions with pagination", async () => {
      const subs = [{ id: "1", app_id: "app1", plan: "basic", status: "active" }];
      const chain = chainable({
        range: jest.fn().mockResolvedValue({ data: subs, count: 1 }),
      });
      mockFrom.mockReturnValue(chain);

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.subscriptions).toHaveLength(1);
      expect(data.total).toBe(1);
    });
  });

  describe("POST", () => {
    it("returns 400 on invalid body (missing app_id)", async () => {
      const { req, res } = createMocks({ method: "POST", body: { plan: "basic" } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });

    it("creates subscription", async () => {
      const sub = { id: "1", app_id: "app1", plan: "basic", status: "active" };
      const chain = chainable({
        single: jest.fn().mockResolvedValue({ data: sub, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      const { req, res } = createMocks({
        method: "POST",
        body: { app_id: "app1", plan: "basic" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(201);
    });
  });
});
