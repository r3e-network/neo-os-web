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
  requireWalletAuth: jest.fn(() => ({ ok: true, address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs" })),
}));

jest.mock("@/lib/security/ratelimit", () => ({
  apiRateLimiter: { check: jest.fn(() => ({ allowed: true, remaining: 99 })), windowSec: 60 },
  writeRateLimiter: { check: jest.fn(() => ({ allowed: true, remaining: 19 })), windowSec: 60 },
  authRateLimiter: { check: jest.fn(() => ({ allowed: true, remaining: 9 })), windowSec: 60 },
}));

jest.mock("@/lib/admin-auth", () => ({
  requireAdmin: jest.fn(() => ({ ok: true })),
}));

import handler from "@/pages/api/notifications/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chainable(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ["select", "eq", "order", "limit", "update", "in", "insert", "head"];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  // Allow awaiting the chain — resolves to overrides._result or { data: null, error: null }
  (chain as any).then = (resolve: (v: unknown) => void) => resolve(overrides._result ?? { data: null, error: null });
  Object.assign(chain, overrides);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Notifications API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({ method: "DELETE" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  describe("GET", () => {
    it("returns notifications list", async () => {
      const notifications = [
        { id: "1", type: "info", title: "Test", content: "Hello", metadata: {}, read: false, created_at: "2026-01-01" },
      ];
      // First from() call: data query
      const dataChain = chainable({ _result: { data: notifications, error: null } });
      // Second from() call: count query
      const countChain = chainable({ _result: { count: 1 } });
      mockFrom.mockReturnValueOnce(dataChain).mockReturnValueOnce(countChain);

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.notifications).toHaveLength(1);
    });
  });

  describe("POST", () => {
    it("returns 400 on invalid body (missing ids and all)", async () => {
      const { req, res } = createMocks({ method: "POST", body: {} });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });

    it("marks all as read", async () => {
      const chain = chainable({ _result: { error: null } });
      mockFrom.mockReturnValue(chain);

      const { req, res } = createMocks({ method: "POST", body: { all: true } });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
    });
  });
});
