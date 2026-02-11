/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockDb = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
  })),
};

jest.mock("@/lib/supabase", () => ({
  supabase: mockDb,
  supabaseAdmin: mockDb,
  isSupabaseConfigured: true,
}));

jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: jest.fn(() => ({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  })),
}));

import handler from "@/pages/api/messaging/index";

describe("Messaging API", () => {
  it("returns 401 if wallet auth fails for GET", async () => {
    const { requireWalletAuth } = require("@/lib/security/wallet-auth");
    requireWalletAuth.mockReturnValueOnce({ ok: false, status: 401, error: "Unauthorized" });
    const { req, res } = createMocks({ method: "GET", query: { appId: "app-1" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({ method: "DELETE" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });
});
