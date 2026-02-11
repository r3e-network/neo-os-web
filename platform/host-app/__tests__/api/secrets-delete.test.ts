/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

const mockRequireWalletAuth = jest.fn();
jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: mockRequireWalletAuth,
}));

import handler from "@/pages/api/secrets/[id]";

beforeEach(() => {
  jest.clearAllMocks();
  // Default: authenticated user
  mockRequireWalletAuth.mockReturnValue({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  });
});

describe("DELETE /api/secrets/[id]", () => {
  it("rejects non-DELETE methods", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 401 when wallet auth is missing", async () => {
    mockRequireWalletAuth.mockReturnValue({
      ok: false,
      status: 401,
      error: "Missing authorization header",
    });

    const { req, res } = createMocks({
      method: "DELETE",
      query: { id: "42" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Missing authorization header");
  });

  it("returns 400 when id is missing", async () => {
    const { req, res } = createMocks({
      method: "DELETE",
      query: {},
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("deletes secret successfully", async () => {
    mockFrom.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      match: jest.fn().mockResolvedValue({ error: null }),
    });

    const { req, res } = createMocks({
      method: "DELETE",
      query: { id: "42" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
  });

  it("returns 500 on database error", async () => {
    mockFrom.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      match: jest.fn().mockResolvedValue({ error: { message: "DB error" } }),
    });

    const { req, res } = createMocks({
      method: "DELETE",
      query: { id: "42" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});
