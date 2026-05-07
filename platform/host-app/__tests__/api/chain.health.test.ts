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

  afterEach(() => {
    jest.restoreAllMocks();
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

  it("falls back to the next configured RPC when the first endpoint times out", async () => {
    const handler = require("@/pages/api/chain/health").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    process.env.NEO_RPC_MAINNET = "https://primary.example,https://secondary.example";

    mockFetch
      .mockRejectedValueOnce(new DOMException("The operation was aborted", "TimeoutError"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 202 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { time: Date.now() } }),
      });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "mainnet" },
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://primary.example",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://secondary.example",
      expect.objectContaining({ method: "POST" }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({ network: "mainnet", blockHeight: 202, rpcUrl: "https://secondary.example" }),
    );
  });

  it("normalizes Neo N3 millisecond header timestamps before computing freshness", async () => {
    const handler = require("@/pages/api/chain/health").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;
    const nowMs = Date.parse("2026-05-05T12:00:00.000Z");
    jest.spyOn(Date, "now").mockReturnValue(nowMs);

    process.env.NEO_RPC_TESTNET = "https://rpc.example.test";

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 303 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { time: nowMs - 30_000 } }),
      });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        lastBlockTime: Math.floor((nowMs - 30_000) / 1000),
        status: "healthy",
      }),
    );
  });

  it("returns a critical health payload instead of a 500 when every RPC endpoint fails", async () => {
    const handler = require("@/pages/api/chain/health").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    mockFetch.mockRejectedValue(new Error("upstream unavailable"));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        network: "testnet",
        blockHeight: 0,
        status: "critical",
        error: "All configured Neo RPC endpoints failed",
      }),
    );
  });
});
