import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/morpheus/oracle/message-reveal", () => {
  const mockFetch = jest.fn();
  const now = 1_800_000_000_000;
  const validBody = {
    chain: "neox",
    messageId: "42",
    signature: `0x${"ab".repeat(65)}`,
    issuedAt: Math.floor(now / 1000),
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    jest.spyOn(Date, "now").mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("forwards a valid mainnet recipient reveal and preserves the response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ plaintext: "hello from the oracle" }),
    });
    const handler = require("@/pages/api/morpheus/oracle/message-reveal").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: validBody,
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(res.getHeader("Cache-Control")).toBe("no-store, private");
    expect(JSON.parse(res._getData())).toEqual({ plaintext: "hello from the oracle" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/mainnet\/oracle\/message-reveal$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(validBody),
        cache: "no-store",
      }),
    );
  });

  it.each([
    [{ ...validBody, chain: "neo" }, "wrong chain"],
    [{ ...validBody, messageId: "0" }, "zero message"],
    [{ ...validBody, signature: "0x1234" }, "short signature"],
    [{ ...validBody, issuedAt: validBody.issuedAt - 601 }, "stale request"],
  ])("rejects %s (%s) before contacting the oracle", async (body) => {
    const handler = require("@/pages/api/morpheus/oracle/message-reveal").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST", body });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("answers preflight without forwarding plaintext or signatures", async () => {
    const handler = require("@/pages/api/morpheus/oracle/message-reveal").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "OPTIONS" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(204);
    expect(res.getHeader("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns a clear gateway failure when every canonical endpoint is unavailable", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));
    const handler = require("@/pages/api/morpheus/oracle/message-reveal").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: validBody,
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(502);
    expect(JSON.parse(res._getData())).toMatchObject({
      error: { code: "GATEWAY_ERROR", message: "Morpheus message reveal is unavailable" },
    });
  });
});
