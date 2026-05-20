import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/explorer/stats env access", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.NEO_RPC_TESTNET;
    delete process.env.NEO_RPC_MAINNET;
    delete process.env.INDEXER_SUPABASE_URL;
    delete process.env.INDEXER_SUPABASE_SERVICE_KEY;
  });

  it("answers public read CORS preflight without touching upstream services", async () => {
    const handler = require("@/pages/api/explorer/stats").default as (
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

  it("reads rpc env lazily and does not synthesize transaction counts", async () => {
    const handler = require("@/pages/api/explorer/stats").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    process.env.NEO_RPC_MAINNET = "https://mainnet.example.test";
    process.env.NEO_RPC_TESTNET = "https://testnet.example.test";

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 201 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 101 }) });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });

    await handler(req, res);

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://mainnet.example.test",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://testnet.example.test",
      expect.objectContaining({ method: "POST" }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        mainnet: { height: 201, txCount: null, txCountSource: "unavailable" },
        testnet: { height: 101, txCount: null, txCountSource: "unavailable" },
      }),
    );
  });
});
