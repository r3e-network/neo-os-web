import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/explorer/recent", () => {
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
    const handler = require("@/pages/api/explorer/recent").default as (
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
    const handler = require("@/pages/api/explorer/recent").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { limit: "1" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(JSON.parse(res._getData())).toEqual({
      error: { code: "BAD_REQUEST", message: "network must be mainnet or testnet" },
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("falls back to live Neo RPC blocks when the transaction indexer is not configured", async () => {
    const handler = require("@/pages/api/explorer/recent").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 103 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            index: 102,
            hash: "0xblock102",
            time: 1710000102,
            tx: [
              {
                hash: "0xtx102",
                vm_state: "HALT",
                sender: "Nsender",
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            index: 101,
            hash: "0xblock101",
            time: 1710000101,
            tx: [],
          },
        }),
      });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet", limit: "1" },
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://testnet-rpc.example.test",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"method":"getblockcount"'),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
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
        network: "testnet",
        source: "rpc",
        count: 1,
        transactions: [
          expect.objectContaining({
            hash: "0xtx102",
            tx_hash: "0xtx102",
            vm_state: "HALT",
            block_index: 102,
            block_hash: "0xblock102",
            source: "rpc",
          }),
        ],
      }),
    );
  });
});
