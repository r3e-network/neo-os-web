import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/rpc/[fn] CORS", () => {
  const originalFetch = global.fetch;
  const originalEdgeBaseUrl = process.env.EDGE_BASE_URL;
  const originalAllowlist = process.env.EDGE_RPC_ALLOWLIST;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEdgeBaseUrl === undefined) delete process.env.EDGE_BASE_URL;
    else process.env.EDGE_BASE_URL = originalEdgeBaseUrl;
    if (originalAllowlist === undefined) delete process.env.EDGE_RPC_ALLOWLIST;
    else process.env.EDGE_RPC_ALLOWLIST = originalAllowlist;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("answers sandboxed miniapp RPC preflights", async () => {
    const handler = require("@/pages/api/rpc/[fn]").default;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "OPTIONS",
      query: { fn: "gas-sponsor-request" },
      headers: {
        origin: "null",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(204);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("null");
    expect(res.getHeader("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.getHeader("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.getHeader("Access-Control-Allow-Headers")).toContain(
      "Content-Type",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps sandboxed miniapp CORS headers on proxied RPC responses", async () => {
    process.env.EDGE_BASE_URL = "https://edge.example/functions/v1";
    process.env.EDGE_RPC_ALLOWLIST = "gas-sponsor-check";
    const upstreamBody = Buffer.from(JSON.stringify({ eligible: true }));
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      headers: {
        get: (key: string) =>
          key.toLowerCase() === "content-length"
            ? String(upstreamBody.length)
            : null,
        forEach: (cb: (value: string, key: string) => void) =>
          cb("application/json", "content-type"),
      },
      arrayBuffer: async () =>
        upstreamBody.buffer.slice(
          upstreamBody.byteOffset,
          upstreamBody.byteOffset + upstreamBody.byteLength,
        ),
    });
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/rpc/[fn]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {
        fn: "gas-sponsor-check",
        dappId: "miniapp-aa-session-key-lab",
        network: "testnet",
      },
      headers: {
        origin: "null",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("null");
    expect(res.getHeader("Access-Control-Allow-Credentials")).toBe("true");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://edge.example/functions/v1/gas-sponsor-check?dappId=miniapp-aa-session-key-lab&network=testnet",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns a structured sponsor unavailable response when edge is not configured", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.EDGE_RPC_ALLOWLIST;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/rpc/[fn]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {
        fn: "gas-sponsor-check",
        dappId: "miniapp-aa-session-key-lab",
        network: "testnet",
      },
      headers: {
        origin: "null",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("null");
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        eligible: false,
        status: "unavailable",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
