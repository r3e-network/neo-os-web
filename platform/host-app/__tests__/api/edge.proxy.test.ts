import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/edge/[endpoint]", () => {
  const originalEdgeBaseUrl = process.env.EDGE_BASE_URL;
  const originalPublicEdgeUrl = process.env.NEXT_PUBLIC_EDGE_URL;
  const originalAllowlist = process.env.MINIAPP_EDGE_ALLOWLIST;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.EDGE_BASE_URL = originalEdgeBaseUrl;
    process.env.NEXT_PUBLIC_EDGE_URL = originalPublicEdgeUrl;
    process.env.MINIAPP_EDGE_ALLOWLIST = originalAllowlist;
    global.fetch = originalFetch;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("proxies OS service calls to the configured edge functions base URL", async () => {
    process.env.EDGE_BASE_URL = "https://edge.example/functions/v1";
    const upstreamBody = Buffer.from(JSON.stringify({ ok: true }));
    const fetchMock = jest.fn().mockResolvedValue(
      {
        status: 200,
        headers: {
          forEach: (cb: (value: string, key: string) => void) =>
            cb("application/json", "content-type"),
        },
        arrayBuffer: async () =>
          upstreamBody.buffer.slice(
            upstreamBody.byteOffset,
            upstreamBody.byteOffset + upstreamBody.byteLength,
          ),
      },
    );
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-storage-get" },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wallet-session",
      },
    });
    const requestBody = Buffer.from(
      JSON.stringify({ appId: "miniapp-demo", key: "profile" }),
    );
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://edge.example/functions/v1/os-storage-get",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("uses NEXT_PUBLIC_EDGE_URL when EDGE_BASE_URL is not set", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    process.env.NEXT_PUBLIC_EDGE_URL = "https://edge-public.example";
    const upstreamBody = Buffer.from(JSON.stringify({ ok: true }));
    const fetchMock = jest.fn().mockResolvedValue(
      {
        status: 200,
        headers: {
          forEach: (cb: (value: string, key: string) => void) =>
            cb("application/json", "content-type"),
        },
        arrayBuffer: async () =>
          upstreamBody.buffer.slice(
            upstreamBody.byteOffset,
            upstreamBody.byteOffset + upstreamBody.byteLength,
          ),
      },
    );
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-storage-list" },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wallet-session",
      },
    });
    const requestBody = Buffer.from(JSON.stringify({ appId: "miniapp-demo" }));
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://edge-public.example/functions/v1/os-storage-list",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("does not synthesize OS service data when edge is not configured", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-game-status" },
      headers: { "content-type": "application/json" },
    });
    const requestBody = Buffer.from(
      JSON.stringify({ appId: "miniapp-last-survivor", poolId: "round-1" }),
    );
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData()).error.message).toMatch(
      /EDGE_BASE_URL/,
    );
  });

  it("returns neutral read state for unauthenticated read-only OS calls", async () => {
    process.env.EDGE_BASE_URL = "https://edge.example/functions/v1";
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-storage-list" },
      headers: { "content-type": "application/json" },
    });
    const requestBody = Buffer.from(
      JSON.stringify({ appId: "miniapp-demo", prefix: "items:" }),
    );
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("X-MiniApp-Edge-State")).toBe("wallet-required");
    expect(JSON.parse(res._getData())).toEqual({
      ok: true,
      data: {},
      meta: { state: "wallet_required" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still proxies authenticated read-only OS calls to the edge service", async () => {
    process.env.EDGE_BASE_URL = "https://edge.example/functions/v1";
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    const upstreamBody = Buffer.from(JSON.stringify({ ok: true, data: {} }));
    const fetchMock = jest.fn().mockResolvedValue(
      {
        status: 200,
        headers: {
          forEach: (cb: (value: string, key: string) => void) =>
            cb("application/json", "content-type"),
        },
        arrayBuffer: async () =>
          upstreamBody.buffer.slice(
            upstreamBody.byteOffset,
            upstreamBody.byteOffset + upstreamBody.byteLength,
          ),
      },
    );
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-storage-list" },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wallet-session",
      },
    });
    const requestBody = Buffer.from(
      JSON.stringify({ appId: "miniapp-demo", prefix: "items:" }),
    );
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://edge.example/functions/v1/os-storage-list",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("keeps write-like OS services blocked when edge is not configured", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-payment-deposit" },
      headers: { "content-type": "application/json" },
    });
    const requestBody = Buffer.from(
      JSON.stringify({ appId: "miniapp-demo", amount: "1" }),
    );
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData()).error.message).toMatch(
      /EDGE_BASE_URL/,
    );
  });

  it("does not forward encoded-body headers after Node fetch has decoded the upstream body", async () => {
    process.env.EDGE_BASE_URL = "https://edge.example/functions/v1";
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    const upstreamBody = Buffer.from(JSON.stringify({ error: { code: "AUTH_REQUIRED" } }));
    const fetchMock = jest.fn().mockResolvedValue(
      {
        status: 401,
        headers: {
          forEach: (cb: (value: string, key: string) => void) => {
            cb("application/json", "content-type");
            cb("br", "content-encoding");
            cb(String(upstreamBody.byteLength), "content-length");
          },
        },
        arrayBuffer: async () =>
          upstreamBody.buffer.slice(
            upstreamBody.byteOffset,
            upstreamBody.byteOffset + upstreamBody.byteLength,
          ),
      },
    );
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-storage-list" },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wallet-session",
      },
    });
    const requestBody = Buffer.from(JSON.stringify({ appId: "miniapp-demo" }));
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(res.getHeader("content-type")).toBe("application/json");
    expect(res.getHeader("content-encoding")).toBeUndefined();
    expect(res.getHeader("content-length")).toBeUndefined();
  });

  it("rejects non-OS endpoints unless explicitly allowlisted", async () => {
    process.env.EDGE_BASE_URL = "https://edge.example/functions/v1";
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "admin-danger" },
      body: {},
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
  });
});
