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

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://n3seed1.ngd.network:20332",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://n3seed1.ngd.network:20332",
      expect.objectContaining({ method: "POST" }),
    );

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      network: "testnet",
      source: "neo_n3_contract",
      contract: "0x4b882e94ed766807c4fd728768f972e13008ad52",
      rpc_url: "https://n3seed1.ngd.network:20332",
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
      expect.objectContaining({ error: "rpc failed" }),
    );
  });
});
