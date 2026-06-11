import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe("/api/edge/[endpoint]", () => {
  const originalEdgeBaseUrl = process.env.EDGE_BASE_URL;
  const originalPublicEdgeUrl = process.env.NEXT_PUBLIC_EDGE_URL;
  const originalAllowlist = process.env.MINIAPP_EDGE_ALLOWLIST;
  const originalTargetNetwork = process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK;
  const originalFetch = global.fetch;

  afterEach(() => {
    restoreEnv("EDGE_BASE_URL", originalEdgeBaseUrl);
    restoreEnv("NEXT_PUBLIC_EDGE_URL", originalPublicEdgeUrl);
    restoreEnv("MINIAPP_EDGE_ALLOWLIST", originalAllowlist);
    restoreEnv("NEXT_PUBLIC_NEO_TARGET_NETWORK", originalTargetNetwork);
    global.fetch = originalFetch;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("answers sandboxed miniapp CORS preflights before proxying", async () => {
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "OPTIONS",
      query: { endpoint: "os-game-status" },
      headers: {
        origin: "null",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(204);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(res.getHeader("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.getHeader("Access-Control-Allow-Headers")).toContain(
      "Content-Type",
    );
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
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
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

  it("returns neutral read state for unauthenticated OS calls even when edge is not configured", async () => {
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

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(res.getHeader("X-MiniApp-Edge-State")).toBe("wallet-required");
    expect(JSON.parse(res._getData())).toEqual({
      ok: true,
      data: null,
      meta: { state: "wallet_required" },
    });
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

  it("returns a local Morpheus kernel write intent for storage writes when edge is not configured", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK = "testnet";
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-storage-set" },
      headers: { "content-type": "application/json" },
      body: {
        appId: "miniapp-forever-album",
        key: "photos:NWallet:photo-1",
        value: { id: "photo-1", encrypted: false },
      },
    });
    const requestBody = Buffer.from(
      JSON.stringify({
        appId: "miniapp-forever-album",
        key: "photos:NWallet:photo-1",
        value: { id: "photo-1", encrypted: false },
      }),
    );
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("X-MiniApp-Edge-State")).toBe("local_kernel_intent");
    expect(JSON.parse(res._getData())).toMatchObject({
      ok: true,
      data: {
        contract: "0x4b882e94ed766807c4fd728768f972e13008ad52",
        operation: "putMiniAppState",
        args: [
          { type: "String", value: "miniapp-forever-album" },
          { type: "ByteArray" },
          { type: "ByteArray" },
        ],
      },
      meta: { state: "local_kernel_intent" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a quiet optional fallback for upload marker services when edge is not configured", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-nft-mint" },
      headers: { "content-type": "application/json" },
      body: { appId: "miniapp-forever-album", metadata: {} },
    });
    const requestBody = Buffer.from(
      JSON.stringify({ appId: "miniapp-forever-album", metadata: {} }),
    );
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("X-MiniApp-Edge-State")).toBe(
      "local_optional_unavailable",
    );
    expect(JSON.parse(res._getData())).toEqual({
      ok: true,
      data: null,
      meta: { state: "local_optional_unavailable" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a local automation handoff intent when edge automation is not configured", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const requestBody = {
      name: "NEO threshold auto_repay_self_loan",
      trigger_type: "threshold",
      schedule: "0 */6 * * *",
      condition: { kind: "price_threshold", asset: "NEO" },
      action: { type: "morpheus_workflow" },
    };
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "automation-triggers" },
      headers: { "content-type": "application/json" },
    });
    const raw = Buffer.from(JSON.stringify(requestBody));
    process.nextTick(() => {
      req.emit("data", raw);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("X-MiniApp-Edge-State")).toBe("local_automation_intent");
    expect(JSON.parse(res._getData())).toMatchObject({
      ok: true,
      data: {
        name: "NEO threshold auto_repay_self_loan",
        trigger_type: "threshold",
        enabled: false,
        registration_state: "local_automation_intent",
      },
      meta: { state: "local_automation_intent" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows automation endpoints through the miniapp edge proxy and forwards query params", async () => {
    process.env.EDGE_BASE_URL = "https://edge.example/functions/v1";
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    const upstreamBody = Buffer.from(JSON.stringify([{ id: "exec-1" }]));
    const fetchMock = jest.fn().mockResolvedValue({
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
    });
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {
        endpoint: "automation-trigger-executions",
        id: "trigger-1",
        limit: "5",
      },
      headers: { authorization: "Bearer wallet-session" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://edge.example/functions/v1/automation-trigger-executions?id=trigger-1&limit=5",
      expect.objectContaining({ method: "GET" }),
    );
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

  it("returns a local GAS deposit wallet intent when edge is not configured", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK = "testnet";
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-payment-deposit" },
      headers: { "content-type": "application/json" },
    });
    const requestBody = Buffer.from(
      JSON.stringify({
        appId: "miniapp-unbreakablevault",
        amount: "1.25",
        memo: "miniapp-unbreakablevault:create:abc123",
      }),
    );
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("X-MiniApp-Edge-State")).toBe("local_wallet_intent");
    expect(JSON.parse(res._getData())).toEqual({
      ok: true,
      data: {
        intent: "deposit",
        invocation: {
          contract_hash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
          method: "transfer",
          params: [
            { type: "Hash160", value: "SENDER" },
            {
              type: "Hash160",
              value: "0x4b882e94ed766807c4fd728768f972e13008ad52",
            },
            { type: "Integer", value: "125000000" },
            {
              type: "String",
              value: "miniapp-unbreakablevault:create:abc123",
            },
          ],
        },
        meta: { amountGas: "1.25" },
      },
      meta: { state: "local_wallet_intent" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a local escrow create wallet intent when edge is not configured", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK = "testnet";
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-escrow-create" },
      headers: { "content-type": "application/json" },
    });
    const requestBody = Buffer.from(
      JSON.stringify({
        appId: "miniapp-unbreakablevault",
        amount: "0.5",
        beneficiary: "",
        milestones: [{ name: "vault", amount: "0.5" }],
      }),
    );
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("X-MiniApp-Edge-State")).toBe("local_wallet_intent");
    expect(JSON.parse(res._getData())).toEqual({
      ok: true,
      data: {
        intent: "escrow_create",
        contract: "0x4b882e94ed766807c4fd728768f972e13008ad52",
        operation: "CreateEscrow",
        args: [
          { type: "String", value: "miniapp-unbreakablevault" },
          { type: "Hash160", value: "SENDER" },
          { type: "Hash160", value: "SENDER" },
          { type: "Integer", value: "50000000" },
          { type: "Integer", value: "1" },
        ],
        meta: { amountGas: "0.5" },
      },
      meta: { state: "local_wallet_intent" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a local game bet wallet intent when edge is not configured", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK = "testnet";
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-game-bet" },
      headers: { "content-type": "application/json" },
    });
    const requestBody = Buffer.from(
      JSON.stringify({
        appId: "miniapp-burn-league",
        poolId: "burn-league",
        amount: "5",
      }),
    );
    process.nextTick(() => {
      req.emit("data", requestBody);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("X-MiniApp-Edge-State")).toBe("local_wallet_intent");
    expect(JSON.parse(res._getData())).toEqual({
      ok: true,
      data: {
        intent: "game_bet",
        contract: "0x4b882e94ed766807c4fd728768f972e13008ad52",
        operation: "PlaceBet",
        args: [
          { type: "String", value: "miniapp-burn-league" },
          { type: "Integer", value: "0" },
          { type: "Hash160", value: "SENDER" },
          { type: "Integer", value: "500000000" },
        ],
        meta: {
          requestedPoolId: "burn-league",
          amountGas: "5",
        },
      },
      meta: { state: "local_wallet_intent" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects ambiguous pure-integer base-unit amounts and scales decimal GAS amounts", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK = "testnet";
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const postDeposit = async (amount: string) => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "POST",
        query: { endpoint: "os-payment-deposit" },
        headers: { "content-type": "application/json" },
      });
      const requestBody = Buffer.from(
        JSON.stringify({ appId: "miniapp-unbreakablevault", amount }),
      );
      process.nextTick(() => {
        req.emit("data", requestBody);
        req.emit("end");
      });
      await handler(req, res);
      return res;
    };

    // 1e8 as a pure integer is indistinguishable from fixed8 base units.
    const rejected = await postDeposit("100000000");
    expect(rejected._getStatusCode()).toBe(400);
    expect(JSON.parse(rejected._getData()).error.message).toMatch(
      /decimal GAS amount/,
    );

    // "1.0" is an explicit decimal GAS amount: exactly 1 GAS in base units.
    const accepted = await postDeposit("1.0");
    expect(accepted._getStatusCode()).toBe(200);
    const acceptedData = JSON.parse(accepted._getData()).data;
    expect(acceptedData.invocation.params[2]).toEqual({
      type: "Integer",
      value: "100000000",
    });
    expect(acceptedData.meta).toEqual({ amountGas: "1" });

    // Pure integers below 1e8 stay whole-GAS: no digit-count unit flipping.
    const wholeGas = await postDeposit("99999999");
    expect(wholeGas._getStatusCode()).toBe(200);
    expect(JSON.parse(wholeGas._getData()).data.invocation.params[2]).toEqual({
      type: "Integer",
      value: "9999999900000000",
    });
  });

  it("rejects oversized request bodies with 413 and destroys the request stream", async () => {
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.MINIAPP_EDGE_ALLOWLIST;
    const handler = require("@/pages/api/edge/[endpoint]").default;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { endpoint: "os-storage-set" },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wallet-session",
      },
    });
    const destroySpy = jest.spyOn(req, "destroy");
    const oversized = Buffer.alloc(256 * 1024 + 1, 0x61);
    process.nextTick(() => {
      req.emit("data", oversized);
      req.emit("end");
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(413);
    expect(JSON.parse(res._getData()).error.message).toBe(
      "request body too large",
    );
    expect(destroySpy).toHaveBeenCalled();
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
