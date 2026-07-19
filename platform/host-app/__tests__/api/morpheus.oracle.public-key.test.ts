import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/morpheus/oracle/public-key", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it("reads and decodes the Oracle encryption key from the testnet contract", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            stack: [{ type: "ByteString", value: "WDI1NTE5LUhLREYtU0hBMjU2LUFFUy0yNTYtR0NN" }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            stack: [{ type: "ByteString", value: "ZStOSG1GeVg1UGhFSFBXTlhibkI3R3FhV2M2ZHhFendrSHlUNm9DYThnVT0=" }],
          },
        }),
      });

    const handler = require("@/pages/api/morpheus/oracle/public-key").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet" },
    });

    await handler(req, res);

    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(res.getHeader("Cache-Control")).toBe("no-store, private");
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://api.n3index.dev/testnet",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://api.n3index.dev/testnet",
      expect.objectContaining({ method: "POST" }),
    );

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      network: "testnet",
      source: "neo_n3_contract",
      contract: "0xf54d8584ef82315c1800373272ab08ae0db2d5ef",
      rpc_url: "https://api.n3index.dev/testnet",
      algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
      public_key: "e+NHmFyX5PhEHPWNXbnB7GqaWc6dxEzwkHyT6oCa8gU=",
      public_key_format: "raw",
    });
  });

  it("returns 502 when the RPC call fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "rpc failed" } }),
    });

    const handler = require("@/pages/api/morpheus/oracle/public-key").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(502);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({ error: "Failed to load oracle public key" }),
    );
  });

  it("answers opaque-frame preflight without contacting the chain", async () => {
    const handler = require("@/pages/api/morpheus/oracle/public-key").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "OPTIONS" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(204);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(res.getHeader("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
