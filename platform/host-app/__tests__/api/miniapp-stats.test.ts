/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockGetMiniAppStats = jest.fn();
const mockGetAggregatedMiniAppStats = jest.fn();
jest.mock("@/lib/miniapp-stats", () => ({
  getMiniAppStats: mockGetMiniAppStats,
  getAggregatedMiniAppStats: mockGetAggregatedMiniAppStats,
}));

jest.mock("@/lib/api-response", () => ({
  apiError: {
    methodNotAllowed: (res: any) => res.status(405).json({ error: "Method not allowed" }),
  },
}));

const mockGetChain = jest.fn();
const mockGetActiveChains = jest.fn();
jest.mock("@/lib/chains/registry", () => ({
  getChainRegistry: () => ({
    getChain: mockGetChain,
    getActiveChains: mockGetActiveChains,
  }),
}));

import handler from "@/pages/api/miniapps/[appId]/stats";

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

describe("GET /api/miniapps/[appId]/stats", () => {
  it("rejects non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 400 when appId is missing", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 400 for invalid chain_id", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "app-1", chain_id: "bad" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.availableChains).toBeDefined();
  });

  it("returns per-chain stats", async () => {
    mockGetMiniAppStats.mockResolvedValue({ views: 100, launches: 50 });
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "app-1", chain_id: "neo-n3-mainnet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.stats.views).toBe(100);
    expect(body.chainId).toBe("neo-n3-mainnet");
  });

  it("returns 404 when app stats not found", async () => {
    mockGetMiniAppStats.mockResolvedValue(null);
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "nonexistent", chain_id: "neo-n3-mainnet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(404);
  });

  it("returns aggregated stats with chain_id=all", async () => {
    mockGetAggregatedMiniAppStats.mockResolvedValue({ views: 200, launches: 100 });
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "app-1", chain_id: "all" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.aggregated).toBe(true);
    expect(body.stats.views).toBe(200);
  });

  it("returns aggregated stats with aggregate=true", async () => {
    mockGetAggregatedMiniAppStats.mockResolvedValue({ views: 300 });
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "app-1", aggregate: "true" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.aggregated).toBe(true);
  });
});
