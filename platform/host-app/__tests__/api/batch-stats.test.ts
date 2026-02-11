/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockGetBatchStats = jest.fn();
const mockGetAggregatedBatchStats = jest.fn();
jest.mock("@/lib/miniapp-stats", () => ({
  getBatchStats: mockGetBatchStats,
  getAggregatedBatchStats: mockGetAggregatedBatchStats,
}));

const mockGetChain = jest.fn();
const mockGetActiveChains = jest.fn();
jest.mock("@/lib/chains/registry", () => ({
  getChainRegistry: () => ({
    getChain: mockGetChain,
    getActiveChains: mockGetActiveChains,
  }),
}));

// createHandler dependencies
jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: jest.fn() },
  isSupabaseConfigured: true,
}));

jest.mock("@/lib/security/ratelimit", () => ({
  apiRateLimiter: { check: () => ({ allowed: true, remaining: 99 }), windowSec: 60 },
  writeRateLimiter: { check: () => ({ allowed: true, remaining: 99 }), windowSec: 60 },
  authRateLimiter: { check: () => ({ allowed: true, remaining: 99 }), windowSec: 60 },
}));

jest.mock("@/lib/admin-auth", () => ({
  requireAdmin: jest.fn(() => ({ ok: true })),
}));

import handler from "@/pages/api/miniapps/batch-stats";

const MOCK_CHAIN = {
  id: "neo-n3-mainnet",
  type: "neo-n3",
  status: "active",
  isTestnet: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetChain.mockImplementation((id: string) => (id === "neo-n3-mainnet" ? MOCK_CHAIN : undefined));
  mockGetActiveChains.mockReturnValue([MOCK_CHAIN]);
});

describe("Batch Stats API", () => {
  it("rejects unsupported methods", async () => {
    const { req, res } = createMocks({ method: "DELETE" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 400 when appIds missing (GET)", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 400 when appIds missing (POST)", async () => {
    const { req, res } = createMocks({ method: "POST", body: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns per-chain stats via GET", async () => {
    mockGetBatchStats.mockResolvedValue({ "app-1": { views: 10 } });
    const { req, res } = createMocks({
      method: "GET",
      query: { appIds: "app-1,app-2", chain_id: "neo-n3-mainnet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.chainId).toBe("neo-n3-mainnet");
  });

  it("returns aggregated stats with chain_id=all", async () => {
    mockGetAggregatedBatchStats.mockResolvedValue({ "app-1": { views: 50 } });
    const { req, res } = createMocks({
      method: "GET",
      query: { appIds: "app-1", chain_id: "all" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.aggregated).toBe(true);
  });

  it("accepts appIds via POST body", async () => {
    mockGetBatchStats.mockResolvedValue({});
    const { req, res } = createMocks({
      method: "POST",
      query: { chain_id: "neo-n3-mainnet" },
      body: { appIds: ["app-1", "app-2"] },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
  });

  it("returns 400 for invalid chain_id", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { appIds: "app-1", chain_id: "bad" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });
});
