/**
 * @jest-environment node
 */

import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import { withCronAuth } from "@/lib/security/cron-auth";

describe("withCronAuth", () => {
  const CRON_SECRET = "test-cron-secret-minimum-16-chars";
  const mockHandler = jest.fn((_req: NextApiRequest, res: NextApiResponse) => {
    res.status(200).json({ ok: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    const wrapped = withCronAuth(mockHandler);
    const { req, res } = createMocks({
      method: "GET",
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });

    await wrapped(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: "Cron authentication not configured",
    });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header is missing", async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    const wrapped = withCronAuth(mockHandler);
    const { req, res } = createMocks({ method: "GET" });

    await wrapped(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({ error: "Unauthorized" });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when bearer token is wrong", async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    const wrapped = withCronAuth(mockHandler);
    const { req, res } = createMocks({
      method: "GET",
      headers: { authorization: "Bearer wrong-secret" },
    });

    await wrapped(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization format is invalid", async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    const wrapped = withCronAuth(mockHandler);
    const { req, res } = createMocks({
      method: "GET",
      headers: { authorization: CRON_SECRET },
    });

    await wrapped(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("calls handler when bearer token matches CRON_SECRET", async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    const wrapped = withCronAuth(mockHandler);
    const { req, res } = createMocks({
      method: "GET",
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });

    await wrapped(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ ok: true });
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
});
