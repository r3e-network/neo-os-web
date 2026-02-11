/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: jest.fn(() => ({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  })),
}));

import handler from "@/pages/api/secrets/index";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Secrets API - GET", () => {
  it("returns secrets list for authenticated user", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [{ id: 1, secret_name: "my-key", description: "test" }],
        error: null,
      }),
    });

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.secrets).toHaveLength(1);
    expect(body.secrets[0].secret_name).toBe("my-key");
  });

  it("returns 500 on database error", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      }),
    });

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});

describe("Secrets API - POST", () => {
  it("returns 400 when required fields are missing", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { secretName: "key" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("creates encrypted secret successfully", async () => {
    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

    const { req, res } = createMocks({
      method: "POST",
      body: {
        secretName: "api-key",
        secretValue: "secret-value-123",
        password: "strong-password",
        description: "My API key",
      },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(201);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
  });

  it("returns 500 on insert error", async () => {
    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: { message: "Insert failed" } }),
    });

    const { req, res } = createMocks({
      method: "POST",
      body: {
        secretName: "api-key",
        secretValue: "secret-value-123",
        password: "strong-password",
      },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});

describe("Secrets API - Method check", () => {
  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({ method: "DELETE" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });
});
