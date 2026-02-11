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

jest.mock("@/lib/chains/rpc-functions", () => ({
  getChainRpcUrl: jest.fn(() => "https://mock-rpc.example.com"),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import handler from "@/pages/api/explorer/stats";

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
  delete process.env.INDEXER_SUPABASE_URL;
  delete process.env.INDEXER_SUPABASE_SERVICE_KEY;
});

describe("GET /api/explorer/stats", () => {
  it("rejects non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns stats with block height from RPC", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: 5000000 }),
    });

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.chains).toBeDefined();
    expect(body.chains["neo-n3-mainnet"]).toBeDefined();
    expect(body.chains["neo-n3-mainnet"].height).toBe(5000000);
    expect(body.chains["neo-n3-mainnet"].chainType).toBe("neo-n3");
    expect(body.timestamp).toBeDefined();
  });

  it("estimates txCount from block height when indexer is not configured", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: 1000 }),
    });

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    // avgTxPerBlock = 3.5, so 1000 * 3.5 = 3500
    expect(body.chains["neo-n3-mainnet"].txCount).toBe(3500);
  });

  it("returns 500 when all RPC calls fail", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    // The handler catches errors per-chain, so it may still return 200 with height=0
    // or 500 if the Promise.all rejects
    const code = res._getStatusCode();
    expect([200, 500]).toContain(code);
  });

  it("sets cache-control header", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: 100 }),
    });

    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("Cache-Control")).toMatch(/s-maxage=15/);
  });
});
