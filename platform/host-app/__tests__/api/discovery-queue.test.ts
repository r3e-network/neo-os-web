/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockSelect = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockIs = jest.fn().mockReturnThis();
const mockOrder = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });
const mockUpdate = jest.fn().mockReturnThis();

const mockDb = {
  from: jest.fn(() => ({
    select: mockSelect,
    eq: mockEq,
    is: mockIs,
    order: mockOrder,
    limit: mockLimit,
    update: mockUpdate,
  })),
};

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: mockDb,
}));

jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: jest.fn(() => ({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  })),
}));

jest.mock("@/lib/security/ratelimit", () => ({
  apiRateLimiter: {
    check: jest.fn(() => ({ allowed: true, remaining: 99 })),
    windowSec: 60,
  },
  writeRateLimiter: {
    check: jest.fn(() => ({ allowed: true, remaining: 19 })),
    windowSec: 60,
  },
  authRateLimiter: {
    check: jest.fn(() => ({ allowed: true, remaining: 9 })),
    windowSec: 60,
  },
}));

jest.mock("@/lib/admin-auth", () => ({
  requireAdmin: jest.fn(() => ({ ok: true })),
}));

import handler from "@/pages/api/user/discovery-queue";

beforeEach(() => {
  jest.clearAllMocks();
  mockLimit.mockResolvedValue({ data: [], error: null });
  mockEq.mockReturnThis();
});

describe("Discovery Queue API", () => {
  it("GET returns discovery queue items", async () => {
    mockLimit.mockResolvedValue({
      data: [{ app_id: "app-1", score: 95 }],
      error: null,
    });

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.queue).toHaveLength(1);
  });

  it("GET returns 500 on database error", async () => {
    mockLimit.mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });

  it("POST returns 400 when app_id or action missing", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { app_id: "app-1" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("POST updates action successfully", async () => {
    // The handler calls db.from().update().eq().eq()
    // The last .eq() in the chain must resolve (be awaitable)
    const innerEq = jest.fn().mockResolvedValue({ error: null });
    const outerEq = jest.fn().mockReturnValue({ eq: innerEq });
    mockUpdate.mockReturnValue({ eq: outerEq });

    const { req, res } = createMocks({
      method: "POST",
      body: { app_id: "app-1", action: "skip" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
  });

  it("rejects unsupported methods via createHandler", async () => {
    const { req, res } = createMocks({ method: "DELETE" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });
});
