import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/explorer/search", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.INDEXER_SUPABASE_URL;
    delete process.env.INDEXER_SUPABASE_SERVICE_KEY;
    process.env.NEO_RPC_MAINNET = "https://mainnet-rpc.example.test";
    process.env.NEO_RPC_TESTNET = "https://testnet-rpc.example.test";
  });

  it("answers public read CORS preflight without touching upstream services", async () => {
    const handler = require("@/pages/api/explorer/search").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "OPTIONS",
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(204);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(res.getHeader("Access-Control-Allow-Methods")).toBe("GET,OPTIONS");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects missing network instead of silently using testnet", async () => {
    const handler = require("@/pages/api/explorer/search").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { q: "42" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(JSON.parse(res._getData())).toEqual({
      error: { code: "BAD_REQUEST", message: "network must be mainnet or testnet" },
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("resolves a block height through the selected Neo RPC instead of returning demo data", async () => {
    const handler = require("@/pages/api/explorer/search").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          hash: "0xabc123",
          index: 42,
          time: 1710000000000,
          size: 1024,
          tx: [{ hash: "0xtx01" }, { hash: "0xtx02" }],
        },
      }),
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { q: "42", network: "testnet" },
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://testnet-rpc.example.test",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"method":"getblock"'),
      }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        type: "block",
        found: true,
        network: "testnet",
        data: expect.objectContaining({
          index: 42,
          hash: "0xabc123",
          tx_count: 2,
        }),
      }),
    );
  });
});
