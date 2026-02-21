import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/blueprints";

jest.mock("@/lib/admin-auth", () => ({
  requireMiniAppAdmin: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  standardLimit: jest.fn(() => false),
}));

const { requireMiniAppAdmin } = jest.requireMock("@/lib/admin-auth") as {
  requireMiniAppAdmin: jest.Mock;
};

describe("/api/miniapps/admin/blueprints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 405 for non-GET requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns blueprint metadata for authorized admin", async () => {
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(Array.isArray(body.blueprints)).toBe(true);
    expect(body.blueprints.length).toBeGreaterThanOrEqual(2);
    expect(body.blueprints[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        starter: expect.any(Object),
      }),
    );
  });

  it("returns auth error when admin auth fails", async () => {
    requireMiniAppAdmin.mockImplementation(async (_req, res) => {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "unauthorized" } });
      return null;
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
  });
});
