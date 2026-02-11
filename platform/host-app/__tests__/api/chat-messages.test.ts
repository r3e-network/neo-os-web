/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockFrom = jest.fn();
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

import handler from "@/pages/api/chat/[appId]/messages";

beforeEach(() => {
  jest.clearAllMocks();
});

function setupGetMocks() {
  const chainedQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          wallet_address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
          content: "hello",
          created_at: "2025-01-01T00:00:00Z",
          message_type: "text",
        },
      ],
      error: null,
    }),
  };
  // Second call for participant count
  const countQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockResolvedValue({ count: 3 }),
  };
  mockFrom.mockReturnValueOnce(chainedQuery).mockReturnValueOnce(countQuery);
}

describe("Chat Messages API", () => {
  it("returns 400 when appId is missing", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({ method: "DELETE", query: { appId: "test-app" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("GET returns formatted messages with participant count", async () => {
    setupGetMocks();
    const { req, res } = createMocks({ method: "GET", query: { appId: "test-app" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toBe("hello");
    expect(body.participantCount).toBe(3);
  });

  it("POST returns 400 when content is missing", async () => {
    const { req, res } = createMocks({
      method: "POST",
      query: { appId: "test-app" },
      body: {},
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("POST returns 400 when content exceeds 500 chars", async () => {
    const { req, res } = createMocks({
      method: "POST",
      query: { appId: "test-app" },
      body: { content: "x".repeat(501) },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Validation failed");
  });

  it("POST creates message and updates participant", async () => {
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 99,
          wallet_address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
          content: "hi",
          created_at: "2025-01-01T00:00:00Z",
        },
        error: null,
      }),
    };
    const upsertChain = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValueOnce(insertChain).mockReturnValueOnce(upsertChain);

    const { req, res } = createMocks({
      method: "POST",
      query: { appId: "test-app" },
      body: { content: "hi" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(201);
    const body = JSON.parse(res._getData());
    expect(body.message.content).toBe("hi");
  });
});
