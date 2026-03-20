import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/morpheus/neodid/providers", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.MORPHEUS_TESTNET_PHALA_API_URL;
    delete process.env.MORPHEUS_TESTNET_PHALA_API_TOKEN;
    delete process.env.PHALA_API_URL;
    delete process.env.PHALA_API_TOKEN;
  });

  it("returns provider data from the configured runtime when available", async () => {
    process.env.MORPHEUS_TESTNET_PHALA_API_URL = "https://testnet-runtime.example";
    process.env.MORPHEUS_TESTNET_PHALA_API_TOKEN = "testnet-token";

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        providers: [{ id: "google", status: "active" }],
      }),
    });

    const handler = require("@/pages/api/morpheus/neodid/providers").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet" },
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://testnet-runtime.example/neodid/providers",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.any(Headers),
      }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      providers: [{ id: "google", status: "active" }],
    });
  });

  it("falls back to canonical static metadata when runtime providers are unavailable", async () => {
    mockFetch.mockRejectedValue(new Error("socket hang up"));

    const handler = require("@/pages/api/morpheus/neodid/providers").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.source).toBe("static-fallback");
    expect(payload.network).toBe("testnet");
    expect(payload.registry.contract).toBe("");
    expect(payload.oracle.contract).toBe("0x4b882e94ed766807c4fd728768f972e13008ad52");
    expect(payload.aa.contract).toBe("0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38");
    expect(payload.runtime.runtime_url).toBe(
      "https://morpheus-testnet.meshmini.app",
    );
  });
});
