import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe("/api/aa/relay CORS", () => {
  const originalFetch = global.fetch;
  const originalRelayUrl = process.env.AA_RELAY_URL;
  const originalPublicRelayUrl = process.env.NEXT_PUBLIC_AA_RELAY_URL;

  afterEach(() => {
    global.fetch = originalFetch;
    restoreEnv("AA_RELAY_URL", originalRelayUrl);
    restoreEnv("NEXT_PUBLIC_AA_RELAY_URL", originalPublicRelayUrl);
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("answers sandboxed miniapp relay preflights without touching upstream services", async () => {
    const handler = require("@/pages/api/aa/relay").default;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "OPTIONS",
      headers: {
        origin: "null",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, x-api-key",
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
    expect(res.getHeader("Access-Control-Allow-Headers")).toContain(
      "X-API-Key",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps sandboxed miniapp CORS headers on proxied relay responses", async () => {
    process.env.AA_RELAY_URL = "https://relay.example/submit";
    const upstreamBody = JSON.stringify({ txid: "0xabc123" });
    const fetchMock = jest.fn().mockResolvedValue({
      status: 202,
      headers: {
        get: (key: string) =>
          key.toLowerCase() === "content-type" ? "application/json" : null,
      },
      text: async () => upstreamBody,
    });
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/aa/relay").default;

    const payload = {
      metaInvocation: { scriptHash: "0xdbf0000000000000000000000000000000000000" },
      paymaster: { dapp_id: "miniapp-aa-relay-console", network: "testnet" },
    };
    const requestBody = Buffer.from(JSON.stringify(payload));
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      headers: {
        origin: "null",
        "content-type": "application/json",
      },
    });
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(202);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("null");
    expect(res.getHeader("Access-Control-Allow-Credentials")).toBe("true");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://relay.example/submit",
      expect.objectContaining({ method: "POST" }),
    );
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(Buffer.from(options.body as Uint8Array).toString()).toBe(
      JSON.stringify(payload),
    );
  });

  it("echoes same-host browser origins for relay submits", async () => {
    process.env.NEXT_PUBLIC_AA_RELAY_URL = "https://relay.example/submit";
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      headers: {
        get: (key: string) =>
          key.toLowerCase() === "content-type" ? "application/json" : null,
      },
      text: async () => JSON.stringify({ txid: "0xdef456" }),
    });
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/aa/relay").default;

    const requestBody = Buffer.from(JSON.stringify({ simulate: true }));
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      headers: {
        host: "r3e.local:3000",
        origin: "http://r3e.local:3000",
        "content-type": "application/json",
      },
    });
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe(
      "http://r3e.local:3000",
    );
  });

  it("keeps sandboxed miniapp CORS headers on configuration errors", async () => {
    delete process.env.AA_RELAY_URL;
    delete process.env.NEXT_PUBLIC_AA_RELAY_URL;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/aa/relay").default;

    const requestBody = Buffer.from(JSON.stringify({ simulate: true }));
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      headers: {
        origin: "null",
        "content-type": "application/json",
      },
    });
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("null");
    expect(res.getHeader("Access-Control-Allow-Credentials")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
