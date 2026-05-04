import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/rpc/neo-read", () => {
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NEO_TESTNET_RPC_URL = "https://testnet.example";
    process.env.NEO_MAINNET_RPC_URL = "https://mainnet.example";
    global.fetch = mockFetch;
    handler = require("@/pages/api/rpc/neo-read").default;
  });

  it("forwards read-only invocations to the selected network", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: { state: "HALT", stack: [{ type: "Integer", value: "7" }] },
      }),
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        network: "testnet",
        contractHash: "0xabc",
        method: "totalCheckins",
        params: [],
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://testnet.example",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "invokefunction",
      params: ["0xabc", "totalCheckins", []],
    });
  });

  it("degrades upstream read failures into a 200 FAULT envelope", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("bad gateway");
      },
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        network: "testnet",
        contractHash: "0xabc",
        method: "getPlatformStats",
        params: [],
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.result).toMatchObject({
      state: "FAULT",
      stack: [],
      exception: "RPC gateway returned 502",
    });
  });

  it("degrades transport exceptions into a 200 FAULT envelope", async () => {
    mockFetch.mockRejectedValue(new Error("network reset"));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        contractHash: "0xabc",
        method: "isPaused",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData()).result.state).toBe("FAULT");
  });
});
