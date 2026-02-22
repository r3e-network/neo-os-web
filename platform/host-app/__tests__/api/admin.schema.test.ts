import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/schema";

jest.mock("@/lib/admin-auth", () => ({
  requireMiniAppAdmin: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  standardLimit: jest.fn(() => false),
}));

const { requireMiniAppAdmin } = jest.requireMock("@/lib/admin-auth") as {
  requireMiniAppAdmin: jest.Mock;
};

describe("/api/miniapps/admin/schema", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 405 for non-GET", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns schema for authorized admin", async () => {
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.schema).toEqual(expect.objectContaining({ title: expect.any(String) }));
  });
});
