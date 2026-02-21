import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireMiniAppAdmin } from "@/lib/admin-auth";

jest.mock("@/lib/require-wallet-auth", () => ({
  requireWalletAuth: jest.fn(),
}));

const { requireWalletAuth } = jest.requireMock("@/lib/require-wallet-auth") as {
  requireWalletAuth: jest.Mock;
};

describe("requireMiniAppAdmin", () => {
  const env = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env };
    delete process.env.MINIAPP_ADMIN_API_KEY;
    delete process.env.MINIAPP_ADMIN_WALLETS;
  });

  afterAll(() => {
    process.env = env;
  });

  it("rejects when no admin auth method is configured", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: {},
    });

    const actor = await requireMiniAppAdmin(req, res);
    expect(actor).toBeNull();
    expect(res._getStatusCode()).toBe(500);
  });

  it("accepts a valid admin API key", async () => {
    process.env.MINIAPP_ADMIN_API_KEY = "top-secret";
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { "x-admin-key": "top-secret" },
    });

    const actor = await requireMiniAppAdmin(req, res);
    expect(actor).toEqual({ kind: "api_key", value: "api_key" });
  });

  it("rejects an invalid admin API key", async () => {
    process.env.MINIAPP_ADMIN_API_KEY = "top-secret";
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { "x-admin-key": "wrong-key" },
    });

    const actor = await requireMiniAppAdmin(req, res);
    expect(actor).toBeNull();
    expect(res._getStatusCode()).toBe(401);
  });

  it("accepts allowlisted wallet admin when wallet auth passes", async () => {
    process.env.MINIAPP_ADMIN_WALLETS = "NQwQf6SQMpxkM9yrfQnJx4p6CFVJm9m4PP";
    requireWalletAuth.mockResolvedValue("NQwQf6SQMpxkM9yrfQnJx4p6CFVJm9m4PP");
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { authorization: "Bearer fake-token" },
    });

    const actor = await requireMiniAppAdmin(req, res);
    expect(actor).toEqual({
      kind: "wallet",
      value: "NQwQf6SQMpxkM9yrfQnJx4p6CFVJm9m4PP",
    });
  });
});
