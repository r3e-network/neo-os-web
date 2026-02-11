/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockRpc = jest.fn();
const mockFromInsert = jest.fn();
const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    rpc: mockRpc,
    from: mockFrom,
  },
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
  withRateLimit: (_limiter: unknown, handler: (...args: unknown[]) => unknown) => handler,
}));

import handler from "@/pages/api/hall-of-fame/vote";

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ data: 500, error: null });
  mockFrom.mockReturnValue({
    insert: jest.fn().mockResolvedValue({ error: null }),
  });
});

describe("POST /api/hall-of-fame/vote", () => {
  it("rejects non-POST methods", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 400 when entrantId is missing", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { amount: 1 },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/entrantId/);
  });

  it("records vote and returns new score", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { entrantId: "entrant-1", amount: 2 },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
    expect(body.newScore).toBe(500);
    expect(mockRpc).toHaveBeenCalledWith("increment_hall_of_fame_score", {
      p_entrant_id: "entrant-1",
      p_increment: 200, // 2 * 100
    });
  });

  it("defaults amount to 1 when not provided", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { entrantId: "entrant-1" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("increment_hall_of_fame_score", {
      p_entrant_id: "entrant-1",
      p_increment: 100, // 1 * 100
    });
  });

  it("returns 500 when rpc fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "DB error" } });
    const { req, res } = createMocks({
      method: "POST",
      body: { entrantId: "entrant-1" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});
