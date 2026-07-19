import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/morpheus/vrf/status", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    process.env.PLAYWRIGHT = "1";
  });

  afterEach(() => {
    delete process.env.PLAYWRIGHT;
  });

  it("aggregates only public read-only status routes for an opaque MiniApp frame", async () => {
    mockFetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => url.endsWith("/health")
        ? { ready: true, network: "testnet" }
        : url.endsWith("/v1/status")
          ? { runtime: { status: "operational" } }
          : { verification_public_key: `0x03${"11".repeat(32)}` },
    }));
    const handler = require("@/pages/api/morpheus/vrf/status").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(res.getHeader("Cache-Control")).toBe("no-store, private");
    const body = JSON.parse(res._getData());
    expect(body).toMatchObject({
      network: "testnet",
      oracleContract: "0xf54d8584ef82315c1800373272ab08ae0db2d5ef",
      health: { ready: true, network: "testnet" },
      status: { runtime: { status: "operational" } },
      key: { verification_public_key: `0x03${"11".repeat(32)}` },
      errors: [],
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([
      "https://oracle.meshmini.app/testnet/health",
      "https://oracle.meshmini.app/testnet/v1/status",
      "https://oracle.meshmini.app/testnet/oracle/public-key",
    ]));
    expect(mockFetch.mock.calls.map(([url]) => String(url)).join(" ")).not.toContain("/vrf/random");
  });

  it("returns partial status with a named error instead of inventing readiness", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith("/health")) throw new Error("offline");
      return {
        ok: true,
        json: async () => url.endsWith("/v1/status")
          ? { runtime: { status: "operational" } }
          : { verification_public_key: `0x03${"22".repeat(32)}` },
      };
    });
    const handler = require("@/pages/api/morpheus/vrf/status").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "mainnet" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toMatchObject({
      network: "mainnet",
      health: null,
      errors: ["health"],
    });
  });

  it("rejects mutating methods without contacting Morpheus", async () => {
    const handler = require("@/pages/api/morpheus/vrf/status").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { network: "mainnet" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
