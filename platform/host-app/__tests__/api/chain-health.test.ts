/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

// Mock chain registry
const mockGetChain = jest.fn();
const mockGetActiveChains = jest.fn();
jest.mock("@/lib/chains/registry", () => ({
  getChainRegistry: () => ({
    getChain: mockGetChain,
    getActiveChains: mockGetActiveChains,
  }),
  chainRegistry: {
    getChain: mockGetChain,
    getActiveChains: mockGetActiveChains,
  },
}));

// Mock RPC functions
jest.mock("@/lib/chains/rpc-functions", () => ({
  getChainRpcUrl: jest.fn(() => "https://mock-rpc.example.com"),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import handler from "@/pages/api/chain/health";

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

describe("GET /api/chain/health", () => {
  it("rejects non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 400 for missing chain_id", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/Invalid or missing chain_id/);
    expect(body.availableChains).toBeDefined();
  });

  it("returns 400 for unsupported chain_id", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { chain_id: "unsupported-chain" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns healthy status when block is recent", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockFetch
      .mockResolvedValueOnce({
        json: async () => ({ result: 5000000 }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ result: { time: now - 10 } }),
      });

    const { req, res } = createMocks({
      method: "GET",
      query: { chain_id: "neo-n3-mainnet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.status).toBe("healthy");
    expect(body.blockHeight).toBe(5000000);
    expect(body.chainType).toBe("neo-n3");
  });

  it("returns warning status when block is 60-120s old", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockFetch
      .mockResolvedValueOnce({
        json: async () => ({ result: 5000000 }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ result: { time: now - 90 } }),
      });

    const { req, res } = createMocks({
      method: "GET",
      query: { chain_id: "neo-n3-mainnet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.status).toBe("warning");
  });

  it("returns critical status when block is >120s old", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockFetch
      .mockResolvedValueOnce({
        json: async () => ({ result: 5000000 }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ result: { time: now - 200 } }),
      });

    const { req, res } = createMocks({
      method: "GET",
      query: { chain_id: "neo-n3-mainnet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.status).toBe("critical");
  });

  it("accepts network as alias for chain_id", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockFetch
      .mockResolvedValueOnce({
        json: async () => ({ result: 100 }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ result: { time: now - 5 } }),
      });

    const { req, res } = createMocks({
      method: "GET",
      query: { network: "neo-n3-mainnet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
  });

  it("returns 500 when RPC call fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("RPC timeout"));

    const { req, res } = createMocks({
      method: "GET",
      query: { chain_id: "neo-n3-mainnet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/Failed to check chain health/);
  });
});
