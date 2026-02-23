import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/template-catalog";

jest.mock("@/lib/admin-auth", () => ({
  requireMiniAppAdmin: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  standardLimit: jest.fn(() => false),
}));

const { requireMiniAppAdmin } = jest.requireMock("@/lib/admin-auth") as {
  requireMiniAppAdmin: jest.Mock;
};

describe("/api/miniapps/admin/template-catalog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 405 for non-GET", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns catalog for authorized admin", async () => {
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(Array.isArray(payload.frontend_templates)).toBe(true);
    expect(Array.isArray(payload.contract_templates)).toBe(true);
    expect(Array.isArray(payload.blueprints)).toBe(true);
    expect(payload.frontend_templates[0]).toEqual(expect.objectContaining({ template_id: expect.any(String) }));
    expect(payload.contract_templates[0]).toEqual(expect.objectContaining({ template_id: expect.any(String) }));
  });
});
