import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

const mockStandardLimit = jest.fn(() => false);

jest.mock("@/lib/rate-limit", () => ({
  standardLimit: mockStandardLimit,
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

describe("/api/rpc/neo", () => {
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.NEO_TESTNET_RPC_URL;
    delete process.env.NEO_MAINNET_RPC_URL;
    delete process.env.NEO_RPC_TESTNET;
    delete process.env.NEO_RPC_MAINNET;
    delete process.env.NEO_RPC_URL;
    delete process.env.NEXT_PUBLIC_NEO_RPC_TESTNET;
    delete process.env.NEXT_PUBLIC_NEO_RPC_MAINNET;
    process.env.NEO_TESTNET_RPC_URL = "https://testnet.example";
    process.env.NEO_MAINNET_RPC_URL = "https://mainnet.example";
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: 123 }),
    });
    handler = require("@/pages/api/rpc/neo").default;
  });

  it("forwards allowlisted Neo RPC methods to the selected network", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        network: "testnet",
        method: "getblockcount",
        params: [],
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://testnet.example",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "getblockcount",
      params: [],
    });
  });

  it("uses Neo3Fura public RPC gateways as the safe default when env overrides are absent", async () => {
    delete process.env.NEO_TESTNET_RPC_URL;
    delete process.env.NEO_MAINNET_RPC_URL;
    jest.resetModules();
    handler = require("@/pages/api/rpc/neo").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        network: "mainnet",
        method: "getblockcount",
        params: [],
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.n3index.dev/mainnet",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects non-allowlisted methods before calling upstream RPC", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        network: "testnet",
        method: "dumpprivkey",
        params: [],
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
