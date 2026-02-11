/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
  supabaseAdmin: { from: mockFrom },
  isSupabaseConfigured: true,
}));

jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: jest.fn(() => ({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  })),
}));

import handler from "@/pages/api/messaging/contracts";

/** Returns a chainable mock where every method returns `this`, with overrides. */
function chainable(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "order", "insert", "upsert", "update", "single", "limit"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  Object.assign(chain, overrides);
  return chain;
}

/** Mock that returns ownership data for miniapp_registry, and a custom chain for other tables. */
function mockOwnership(otherChain: ReturnType<typeof chainable>) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "miniapp_registry") {
      return chainable({
        single: jest.fn().mockResolvedValue({
          data: { developer_address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs" },
          error: null,
        }),
      });
    }
    return otherChain;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Messaging Contracts API", () => {
  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({ method: "PUT" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  describe("GET", () => {
    it("returns 400 when appId is missing", async () => {
      const { req, res } = createMocks({ method: "GET", query: {} });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });

    it("returns contracts for provider role", async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ id: 1, provider_app_id: "app-1" }],
            error: null,
          }),
        }),
      });

      const { req, res } = createMocks({
        method: "GET",
        query: { appId: "app-1", role: "provider" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const body = JSON.parse(res._getData());
      expect(body.contracts).toHaveLength(1);
    });
  });

  describe("POST", () => {
    it("returns 400 when required fields are missing", async () => {
      const { req, res } = createMocks({
        method: "POST",
        body: { provider_app_id: "app-1" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });

    it("creates contract successfully", async () => {
      const upsertChain = chainable({
        single: jest.fn().mockResolvedValue({
          data: { id: 1, provider_app_id: "app-1", consumer_app_id: "app-2" },
          error: null,
        }),
      });
      mockOwnership(upsertChain);

      const { req, res } = createMocks({
        method: "POST",
        body: {
          provider_app_id: "app-1",
          consumer_app_id: "app-2",
          data_schema: { type: "object" },
        },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(201);
      const body = JSON.parse(res._getData());
      expect(body.contract).toBeDefined();
    });
  });

  describe("DELETE", () => {
    it("returns 400 when contract_id is missing", async () => {
      const { req, res } = createMocks({
        method: "DELETE",
        body: {},
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });

    it("revokes contract successfully", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "shared_data_contracts" && callCount === 0) {
          // First call: lookup contract to get provider_app_id
          callCount++;
          return chainable({
            single: jest.fn().mockResolvedValue({
              data: { provider_app_id: "app-1" },
              error: null,
            }),
          });
        }
        if (table === "miniapp_registry") {
          // Ownership check
          return chainable({
            single: jest.fn().mockResolvedValue({
              data: { developer_address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs" },
              error: null,
            }),
          });
        }
        // Final update call
        return chainable({
          eq: jest.fn().mockResolvedValue({ error: null }),
        });
      });

      const { req, res } = createMocks({
        method: "DELETE",
        body: { contract_id: "contract-1" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const body = JSON.parse(res._getData());
      expect(body.success).toBe(true);
    });
  });
});
