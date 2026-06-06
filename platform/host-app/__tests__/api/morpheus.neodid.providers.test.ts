import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/morpheus/neodid/providers", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.MORPHEUS_TESTNET_RUNTIME_URL;
    delete process.env.MORPHEUS_TESTNET_RUNTIME_TOKEN;
    delete process.env.MORPHEUS_TESTNET_NITRO_API_URL;
    delete process.env.MORPHEUS_TESTNET_NITRO_API_TOKEN;
    delete process.env.MORPHEUS_TESTNET_PHALA_API_URL;
    delete process.env.MORPHEUS_TESTNET_PHALA_API_TOKEN;
    delete process.env.NITRO_API_URL;
    delete process.env.NITRO_API_TOKEN;
    delete process.env.PHALA_API_URL;
    delete process.env.PHALA_API_TOKEN;
  });

  it("rejects missing network instead of silently using mainnet", async () => {
    const handler = require("@/pages/api/morpheus/neodid/providers").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {},
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: { code: "BAD_REQUEST", message: "network must be mainnet or testnet" },
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns provider data from the configured runtime when available", async () => {
    process.env.MORPHEUS_TESTNET_RUNTIME_URL = "https://testnet-runtime.example";
    process.env.MORPHEUS_TESTNET_RUNTIME_TOKEN = "testnet-token";

    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({
        providers: [{ id: "google", status: "active" }],
      }),
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
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        providers: [{ id: "google", status: "active" }],
      }),
    );
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
    expect(payload.source).toBe("canonical-network-metadata");
    expect(payload.network).toBe("testnet");
    const { MORPHEUS_PUBLIC_REGISTRY } = require("../../../../apps/shared/constants/generated-morpheus-registry");
    const testnetRegistry = MORPHEUS_PUBLIC_REGISTRY.testnet;
    expect(payload.registry.contract).toBe("");
    expect(payload.oracle.contract).toBe(testnetRegistry.contracts.morpheusOracle);
    expect(payload.aa.contract).toBe(testnetRegistry.contracts.aaCore);
    expect(payload.runtime.runtime_url).toBe(testnetRegistry.morpheus.runtimeUrl);
    expect(payload.runtime.edge_url).toBe(testnetRegistry.morpheus.edgeUrl);
    expect(payload.runtime.control_plane_url).toBe(testnetRegistry.morpheus.controlPlaneUrl);
  });
});
