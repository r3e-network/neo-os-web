import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/morpheus/neodid/resolve", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.MORPHEUS_TESTNET_RUNTIME_URL;
    delete process.env.MORPHEUS_TESTNET_RUNTIME_TOKEN;
    delete process.env.MORPHEUS_TESTNET_PHALA_API_URL;
    delete process.env.MORPHEUS_TESTNET_PHALA_API_TOKEN;
    delete process.env.PHALA_API_URL;
    delete process.env.PHALA_API_TOKEN;
  });

  it("resolves the NeoDID service DID against testnet runtime metadata", async () => {
    process.env.MORPHEUS_TESTNET_RUNTIME_URL = "https://testnet-runtime.example";
    process.env.MORPHEUS_TESTNET_RUNTIME_TOKEN = "testnet-token";

    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({
        compose_hash: "compose-testnet-123",
        verification_public_key: "03407c24a382011c16be1597699cd6460f54e49c25098d4943fdf0192c80cb6917",
        verifier_curve: "secp256r1",
      }),
      json: async () => ({
        compose_hash: "compose-testnet-123",
        verification_public_key: "03407c24a382011c16be1597699cd6460f54e49c25098d4943fdf0192c80cb6917",
        verifier_curve: "secp256r1",
      }),
    });

    const handler = require("@/pages/api/morpheus/neodid/resolve").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {
        did: "did:morpheus:neo_n3:service:neodid",
        network: "testnet",
      },
      headers: {
        host: "miniapps.example",
        accept: "application/json",
      },
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://testnet-runtime.example/neodid/runtime",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.any(Headers),
      }),
    );

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer testnet-token");
    expect(headers.get("x-phala-token")).toBe("testnet-token");

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.didDocument.id).toBe("did:morpheus:neo_n3:service:neodid");
    expect(payload.didDocumentMetadata.versionId).toBe("compose-testnet-123");

    const registry = payload.didDocument.service.find((item: Record<string, unknown>) =>
      String(item.id).endsWith("#registry"),
    );
    const oracle = payload.didDocument.service.find((item: Record<string, unknown>) =>
      String(item.id).endsWith("#oracle-entry"),
    );
    const runtime = payload.didDocument.service.find((item: Record<string, unknown>) =>
      String(item.id).endsWith("#runtime"),
    );

    expect(registry.serviceEndpoint.contract).toBe("");
    expect(oracle.serviceEndpoint.contract).toBe("0x4b882e94ed766807c4fd728768f972e13008ad52");
    expect(runtime.serviceEndpoint.runtime_url).toBe(
      "https://oracle.meshmini.app/testnet",
    );
  });

  it("returns a bare DID document when format=document is requested", async () => {
    const handler = require("@/pages/api/morpheus/neodid/resolve").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {
        did: "did:morpheus:neo_n3:vault:6d0656f6dd91469db1c90cc1e574380613f43738",
        network: "testnet",
        format: "document",
      },
      headers: {
        host: "miniapps.example",
      },
    });

    mockFetch.mockRejectedValue(new Error("runtime unavailable"));

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.id).toBe("did:morpheus:neo_n3:vault:6d0656f6dd91469db1c90cc1e574380613f43738");
    expect(payload.didResolutionMetadata).toBeUndefined();
  });

  it("rejects invalid did strings", async () => {
    const handler = require("@/pages/api/morpheus/neodid/resolve").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {
        did: "did:wrong:value",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    const payload = JSON.parse(res._getData());
    expect(payload.didResolutionMetadata.error).toBe("invalidDid");
  });
});
