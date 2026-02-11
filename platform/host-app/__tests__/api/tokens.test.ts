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

import handler from "@/pages/api/tokens/index";

function chainable(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "is", "order", "limit", "insert"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  Object.assign(chain, overrides);
  return chain;
}

describe("Tokens API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 405 for DELETE", async () => {
    const { req, res } = createMocks({ method: "DELETE" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  describe("GET", () => {
    it("returns token list", async () => {
      const tokens = [{ id: "1", name: "test", token_prefix: "neo_abc" }];
      const chain = chainable({
        limit: jest.fn().mockResolvedValue({ data: tokens, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.tokens).toHaveLength(1);
    });
  });

  describe("POST", () => {
    it("returns 400 on missing name", async () => {
      const { req, res } = createMocks({ method: "POST", body: {} });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });

    it("creates token and returns it", async () => {
      const chain = chainable({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });
      mockFrom.mockReturnValue(chain);

      const { req, res } = createMocks({
        method: "POST",
        body: { name: "My Token" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(201);
      const data = JSON.parse(res._getData());
      expect(data.token).toMatch(/^neo_/);
      expect(data.tokenPrefix).toBeDefined();
    });
  });
});
