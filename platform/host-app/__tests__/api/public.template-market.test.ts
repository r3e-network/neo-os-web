import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/template-market";

jest.mock("@/lib/rate-limit", () => ({
  standardLimit: jest.fn(() => false),
}));

jest.mock("@/lib/server-supabase", () => ({
  hasServiceRoleSupabase: jest.fn(() => true),
  getServerSupabaseClient: jest.fn(() => ({})),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@/lib/template-market", () => ({
  listTemplateEntries: jest.fn(),
  normalizeTemplateKind: jest.fn((value: unknown) => {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "frontend" || raw === "contract") return raw;
    return null;
  }),
  normalizeTemplateSourceType: jest.fn((value: unknown) => {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "miniapp" || raw === "verified") return raw;
    return "community";
  }),
}));

const { hasServiceRoleSupabase } = jest.requireMock("@/lib/server-supabase") as {
  hasServiceRoleSupabase: jest.Mock;
};

const { listTemplateEntries } = jest.requireMock("@/lib/template-market") as {
  listTemplateEntries: jest.Mock;
};

describe("/api/miniapps/template-market", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasServiceRoleSupabase.mockReturnValue(true);
    listTemplateEntries.mockResolvedValue([
      {
        row_id: "11111111-1111-1111-1111-111111111111",
        template_kind: "frontend",
        template_id: "prediction.market.modern",
        version: "1.0.0",
        owner_user_id: null,
        name: "Prediction Market",
        description: "Prediction market frontend template",
        category: "defi",
        source_type: "community",
        tags: ["prediction"],
        is_active: true,
        is_verified: true,
        usage_count: 5,
        rating_avg: 4.5,
        rating_count: 3,
        schema: {},
        ui_schema: {},
        manifest: { template: { frontend_template: { template_id: "prediction.market.modern" } } },
        factory_template_ref: null,
        updated_at: "2026-02-22T00:00:00Z",
      },
    ]);
  });

  it("returns 405 for non-GET", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns template list for valid query", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { kind: "all", source: "all", verified: "all", limit: "20" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(Array.isArray(payload.templates)).toBe(true);
    expect(payload.templates[0]).toEqual(
      expect.objectContaining({
        template_id: "prediction.market.modern",
        template_kind: "frontend",
        is_verified: true,
      }),
    );
  });

  it("returns config error when service role is unavailable", async () => {
    hasServiceRoleSupabase.mockReturnValue(false);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: {
        code: "CONFIG_ERROR",
        message: "Template marketplace is not available",
      },
    });
  });
});
