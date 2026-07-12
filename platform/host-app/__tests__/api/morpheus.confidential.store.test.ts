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
    delete process.env.MORPHEUS_TESTNET_CONFIDENTIAL_STORE_TOKEN;
    delete process.env.MORPHEUS_CONFIDENTIAL_STORE_TOKEN;
    delete process.env.MORPHEUS_TESTNET_PROVIDER_CONFIG_API_KEY;
    delete process.env.MORPHEUS_PROVIDER_CONFIG_API_KEY;
    delete process.env.MORPHEUS_TESTNET_CONFIDENTIAL_STORE_PROJECT_SLUG;
    delete process.env.MORPHEUS_CONFIDENTIAL_STORE_PROJECT_SLUG;
  });

  it("reports an unavailable read-only capability when server integration is absent", async () => {
    const handler = require("@/pages/api/morpheus/confidential/store").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      available: false,
      network: "testnet",
      target_chain: "neo_n3",
    });
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers opaque-frame preflight without contacting Morpheus", async () => {
    const handler = require("@/pages/api/morpheus/confidential/store").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "OPTIONS" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(204);
    expect(res.getHeader("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(res.getHeader("Access-Control-Allow-Headers")).toBe("Accept, Content-Type");
    expect(mockFetch).not.toHaveBeenCalled();
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
    process.env.MORPHEUS_TESTNET_CONFIDENTIAL_STORE_TOKEN = "server-store-token";
    process.env.MORPHEUS_TESTNET_CONFIDENTIAL_STORE_PROJECT_SLUG = "neo-miniapps";
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
      public_envelope: { encryption_algorithm: "X25519-HKDF-SHA256-AES-256-GCM" },
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
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Api-Key": "server-store-token",
        },
        body: JSON.stringify({
          ...payload,
          project_slug: "neo-miniapps",
          metadata: { public_envelope: payload.public_envelope },
          encryption_algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
        }),
      }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ secret_ref: "abc-123", target_chain: "neo_n3" });
  });

  it("returns an inline fallback envelope when upstream storage rejects the request", async () => {
    process.env.MORPHEUS_TESTNET_PUBLIC_API_URL = "https://oracle.example";
    process.env.MORPHEUS_TESTNET_CONFIDENTIAL_STORE_TOKEN = "server-store-token";
    process.env.MORPHEUS_TESTNET_CONFIDENTIAL_STORE_PROJECT_SLUG = "neo-miniapps";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ error: "missing store token" }),
    });

    const handler = require("@/pages/api/morpheus/confidential/store").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        ciphertext: "sealed-ciphertext",
        network: "testnet",
        target_chain: "neo_n3",
        name: "demo",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      status: "inline_fallback",
      inline_fallback: true,
      store_available: false,
      upstream_status: 401,
      error: "missing store token",
    });
  });
});
