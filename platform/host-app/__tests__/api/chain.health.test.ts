import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/chain/health", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.NEO_RPC_TESTNET;
    delete process.env.NEO_RPC_MAINNET;
  });

  it("reads rpc env lazily at request time", async () => {
    const handler = require("@/pages/api/chain/health").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    process.env.NEO_RPC_TESTNET = "https://rpc.example.test";

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 101 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { time: Math.floor(Date.now() / 1000) } }),
      });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet" },
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://rpc.example.test",
      expect.objectContaining({ method: "POST" }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({ network: "testnet", blockHeight: 101 }),
    );
  });
});
