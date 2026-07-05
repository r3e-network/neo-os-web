import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("Morpheus runtime proxy routes", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    process.env.PLAYWRIGHT = "1";
    process.env.MORPHEUS_TESTNET_RUNTIME_URL = "https://runtime.example/";
    process.env.MORPHEUS_TESTNET_RUNTIME_TOKEN = "runtime-token";
  });

  afterEach(() => {
    delete process.env.PLAYWRIGHT;
    delete process.env.MORPHEUS_TESTNET_RUNTIME_URL;
    delete process.env.MORPHEUS_TESTNET_RUNTIME_TOKEN;
  });

  it("rejects non-POST session requests", async () => {
    const handler = require("@/pages/api/morpheus/session/[action]").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { action: "start" },
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects unsupported runtime actions", async () => {
    const handler = require("@/pages/api/morpheus/session/[action]").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { action: "delete" },
      body: { network: "testnet" },
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies generic game sessions to /session/{action} with server-side auth", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ commitment: "a".repeat(64), session_token: "token" }),
    });

    const handler = require("@/pages/api/morpheus/session/[action]").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const body = {
      network: "testnet",
      app_id: "snake-bounty",
      engine_hash: "engine",
      game_id: "game-1",
    };
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { action: "start" },
      body,
    });
    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://runtime.example/session/start",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          accept: "application/json",
          "content-type": "application/json",
          authorization: "Bearer runtime-token",
          "x-nitro-token": "runtime-token",
          "x-morpheus-network": "testnet",
        }),
        body: JSON.stringify(body),
      }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      commitment: "a".repeat(64),
      session_token: "token",
    });
  });

  it("proxies legacy game-session clients to /game/{action}", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ ok: true, seq: 2 }),
    });

    const handler = require("@/pages/api/morpheus/game/[action]").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const body = {
      network: "testnet",
      app_id: "jump-rush",
      session_token: "session",
      seq: 2,
      op: { type: "jump", chargeMs: 420 },
    };
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { action: "move" },
      body,
    });
    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://runtime.example/game/move",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ ok: true, seq: 2 });
  });

  it("fails over retryable runtime responses before returning to the miniapp", async () => {
    process.env.MORPHEUS_TESTNET_RUNTIME_URL = "https://runtime-a.example";
    process.env.MORPHEUS_RUNTIME_URL = "https://runtime-b.example";
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ error: "cold start" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ ok: true }),
      });

    const handler = require("@/pages/api/morpheus/session/[action]").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { action: "step" },
      body: { network: "testnet", session_token: "session", seq: 1, op: { type: "noop" } },
    });
    await handler(req, res);

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://runtime-a.example/session/step",
      expect.any(Object),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://runtime-b.example/session/step",
      expect.any(Object),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ ok: true });
  });

  it("does not retry application-level 409 responses", async () => {
    process.env.MORPHEUS_TESTNET_RUNTIME_URL = "https://runtime-a.example";
    process.env.MORPHEUS_RUNTIME_URL = "https://runtime-b.example";
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ error: "stale seq", expected_min: 3 }),
    });

    const handler = require("@/pages/api/morpheus/session/[action]").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { action: "step" },
      body: { network: "testnet", session_token: "session", seq: 1, op: { type: "noop" } },
    });
    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(res._getStatusCode()).toBe(409);
    expect(JSON.parse(res._getData())).toEqual({
      error: "stale seq",
      expected_min: 3,
    });
  });
});
