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
