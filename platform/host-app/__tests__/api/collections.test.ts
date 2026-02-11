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

jest.mock("@/lib/csrf", () => ({
  validateCsrfToken: jest.fn(() => true),
}));

import handler from "@/pages/api/collections/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chainable(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "order", "range", "insert", "limit"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  Object.assign(chain, overrides);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Collections API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({ method: "DELETE" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  describe("GET", () => {
    it("returns collections list with pagination", async () => {
      const collections = [{ app_id: "app1", created_at: "2026-01-01" }];
      const chain = chainable({
        range: jest.fn().mockResolvedValue({ data: collections, error: null, count: 1 }),
      });
      mockFrom.mockReturnValue(chain);

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.collections).toHaveLength(1);
      expect(data.total).toBe(1);
    });
  });

  describe("POST", () => {
    it("returns 400 on invalid body (missing appId)", async () => {
      const { req, res } = createMocks({ method: "POST", body: {} });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });

    it("adds app to collection", async () => {
      const chain = chainable({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });
      mockFrom.mockReturnValue(chain);

      const { req, res } = createMocks({
        method: "POST",
        body: { appId: "test-app-id" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(201);
    });
  });
});
