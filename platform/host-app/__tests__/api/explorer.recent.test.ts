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
