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
  writeRateLimiter: {
    check: jest.fn(() => ({ allowed: true, remaining: 19 })),
    windowSec: 60,
  },
  withRateLimit: jest.fn((_limiter: unknown, handler: (...args: unknown[]) => unknown) => handler),
}));

jest.mock("@/lib/contracts", () => ({
  normalizeContracts: jest.fn((v: unknown) => v || {}),
}));

import handler from "@/pages/api/miniapps/submit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validBody = {
  name: "Test App",
  name_zh: "测试应用",
  description: "A test miniapp",
  description_zh: "一个测试小程序",
  icon: "https://example.com/icon.png",
  category: "utility",
  entry_url: "https://example.com/app",
  developer_address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  permissions: { payments: true },
};

// Suppress console.error in tests
beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/miniapps/submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetChain();
    mockFrom.mockReturnValue(mockFromChain);
  });

  it("rejects non-POST methods", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("rejects when auth fails", async () => {
    const { requireWalletAuth } = require("@/lib/security/wallet-auth");
    requireWalletAuth.mockReturnValueOnce({ ok: false, status: 401, error: "No auth" });

    const { req, res } = createMocks({ method: "POST", body: validBody });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("rejects missing required fields", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { name: "Test", name_zh: "", description: "d", description_zh: "d", entry_url: "https://x.com" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData()).error).toContain("Missing required");
  });

  it("rejects invalid entry_url", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { ...validBody, entry_url: "ftp://bad" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData()).error).toContain("Entry URL");
  });

  it("rejects invalid build_url", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { ...validBody, build_url: "ftp://bad-build" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData()).error).toContain("Build URL");
  });

  it("creates registry and version on success", async () => {
    // registry insert -> select -> single
    mockFromChain.single = jest
      .fn()
      .mockResolvedValueOnce({ data: { app_id: "community-test-app-abc" }, error: null })
      // version insert (no single)
      .mockResolvedValueOnce({ data: null, error: null });
    // version insert returns no error
    mockFromChain.insert = jest.fn(() => ({
      ...mockFromChain,
      select: jest.fn(() => ({
        ...mockFromChain,
        single: jest.fn().mockResolvedValueOnce({
          data: { app_id: "community-test-app-abc" },
          error: null,
        }),
      })),
      error: null,
    }));

    const { req, res } = createMocks({ method: "POST", body: validBody });
    await handler(req, res);

    // Should call from("miniapp_registry") at minimum
    expect(mockFrom).toHaveBeenCalledWith("miniapp_registry");
  });

  it("returns 500 on DB error", async () => {
    mockFromChain.single = jest.fn().mockResolvedValueOnce({
      data: null,
      error: { message: "DB error", code: "500" },
    });
    mockFromChain.insert = jest.fn(() => ({
      ...mockFromChain,
      select: jest.fn(() => ({
        ...mockFromChain,
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: "DB error", code: "500" },
        }),
      })),
    }));

    const { req, res } = createMocks({ method: "POST", body: validBody });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});
