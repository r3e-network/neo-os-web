import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/morpheus/confidential/store", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.MORPHEUS_TESTNET_PUBLIC_API_URL;
    delete process.env.MORPHEUS_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_MORPHEUS_PUBLIC_API_URL;
  });

  it("rejects non-POST requests", async () => {
    const handler = require("@/pages/api/morpheus/confidential/store").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
  });

  it("requires ciphertext", async () => {
    const handler = require("@/pages/api/morpheus/confidential/store").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {},
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: { code: "BAD_REQUEST", message: "ciphertext is required" },
    });
  });

  it("forwards the request body to Morpheus confidential store", async () => {
    process.env.MORPHEUS_TESTNET_PUBLIC_API_URL = "https://oracle.example";
    mockFetch.mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ secret_ref: "abc-123", target_chain: "neo_n3" }),
    });

    const handler = require("@/pages/api/morpheus/confidential/store").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const payload = {
      ciphertext: "sealed-ciphertext",
      network: "testnet",
      target_chain: "neo_n3",
      name: "demo",
    };
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: payload,
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://oracle.example/api/confidential/store",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ secret_ref: "abc-123", target_chain: "neo_n3" });
  });
});
