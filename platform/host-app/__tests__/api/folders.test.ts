/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
  isSupabaseConfigured: true,
}));

jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: jest.fn(() => ({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  })),
}));

import handler from "@/pages/api/folders/index";

function chainable(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "order", "insert", "single", "range"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  Object.assign(chain, overrides);
  return chain;
}

describe("Folders API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 405 for PATCH", async () => {
    const { req, res } = createMocks({ method: "PATCH" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  describe("GET", () => {
    it("returns folders for wallet", async () => {
      const folders = [{ id: "1", name: "My Folder" }];
      const chain = chainable({
        range: jest.fn().mockResolvedValue({ data: folders, error: null, count: 1 }),
      });
      mockFrom.mockReturnValue(chain);

      const { req, res } = createMocks({
        method: "GET",
        query: { wallet: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
    });
  });
});
