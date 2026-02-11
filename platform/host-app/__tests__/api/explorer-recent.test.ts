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

import handler from "@/pages/api/explorer/recent";

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

describe("GET /api/explorer/recent", () => {
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
    expect(body.availableChains).toBeDefined();
  });

  it("returns transactions from RPC fallback", async () => {
    // getblockcount
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: 100 }),
    });
    // getblock for height 99
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        result: {
          time: 1700000000,
          tx: [{ hash: "0xabc123" }],
        },
      }),
    });

    const { req, res } = createMocks({
      method: "GET",
      query: { chain_id: "neo-n3-mainnet", limit: "1" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.chainId).toBe("neo-n3-mainnet");
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0].hash).toBe("0xabc123");
    expect(body.count).toBe(1);
  });

  it("respects limit parameter capped at 50", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: 100 }),
    });
    // Return empty blocks so loop terminates
    for (let i = 0; i < 10; i++) {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ result: { time: 1700000000, tx: [] } }),
      });
    }

    const { req, res } = createMocks({
      method: "GET",
      query: { chain_id: "neo-n3-mainnet", limit: "999" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
  });

  it("returns empty transactions when RPC fails", async () => {
    mockFetch.mockRejectedValue(new Error("RPC down"));

    const { req, res } = createMocks({
      method: "GET",
      query: { chain_id: "neo-n3-mainnet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.transactions).toEqual([]);
    expect(body.count).toBe(0);
  });

  it("accepts network as alias for chain_id", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: 10 }),
    });
    for (let i = 0; i < 10; i++) {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ result: { time: 1700000000, tx: [] } }),
      });
    }

    const { req, res } = createMocks({
      method: "GET",
      query: { network: "neo-n3-mainnet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
  });
});
