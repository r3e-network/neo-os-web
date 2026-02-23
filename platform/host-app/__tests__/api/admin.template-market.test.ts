import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/template-market";

jest.mock("@/lib/csrf", () => ({
  withCsrfProtection: (wrapped: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void) => wrapped,
}));

jest.mock("@/lib/admin-auth", () => ({
  requireMiniAppAdmin: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  strictLimit: jest.fn(() => false),
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
  isTemplateApprovalRequired: jest.fn(() => false),
  isTemplateReviewer: jest.fn(() => true),
  listTemplateEntries: jest.fn(),
  listTemplatePublishRequests: jest.fn(),
  normalizeTemplateId: jest.fn((value: unknown) => String(value || "").trim().toLowerCase()),
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
  setTemplateEntryPublishState: jest.fn(),
  updateTemplatePublishRequestStatus: jest.fn(),
  upsertTemplateEntry: jest.fn(),
  createTemplatePublishRequest: jest.fn(),
}));

const { requireMiniAppAdmin } = jest.requireMock("@/lib/admin-auth") as {
  requireMiniAppAdmin: jest.Mock;
};

const templateMarket = jest.requireMock("@/lib/template-market") as {
  listTemplateEntries: jest.Mock;
  listTemplatePublishRequests: jest.Mock;
  upsertTemplateEntry: jest.Mock;
};

describe("/api/miniapps/admin/template-market", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });

    templateMarket.listTemplateEntries.mockResolvedValue([
      {
        row_id: "11111111-1111-1111-1111-111111111111",
        template_kind: "frontend",
        template_id: "prediction.frontend",
        version: "1.0.0",
        owner_user_id: null,
        name: "Prediction Frontend",
        description: "Template for prediction-style UI",
        category: "defi",
        source_type: "community",
        tags: ["prediction"],
        is_active: true,
        is_verified: false,
        usage_count: 3,
        rating_avg: 4.2,
        rating_count: 2,
        schema: {},
        ui_schema: {},
        manifest: { page_template: { layout: "prediction" } },
        factory_template_ref: null,
        updated_at: "2026-02-20T00:00:00Z",
      },
    ]);

    templateMarket.listTemplatePublishRequests.mockResolvedValue([]);

    templateMarket.upsertTemplateEntry.mockResolvedValue({
      row_id: "33333333-3333-3333-3333-333333333333",
      template_kind: "frontend",
      template_id: "prediction.frontend",
      version: "1.0.0",
      owner_user_id: null,
      name: "Prediction Frontend",
      description: "Template for prediction-style UI",
      category: "defi",
      source_type: "community",
      tags: ["prediction"],
      is_active: true,
      is_verified: false,
      usage_count: 0,
      rating_avg: null,
      rating_count: 0,
      schema: {},
      ui_schema: {},
      manifest: { page_template: { layout: "prediction" } },
      factory_template_ref: null,
      updated_at: "2026-02-20T00:00:00Z",
    });
  });

  it("returns templates in template mode", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { mode: "templates" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.mode).toBe("templates");
    expect(Array.isArray(payload.templates)).toBe(true);
  });

  it("accepts template upsert action", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        action: "upsert_template",
        kind: "frontend",
        template_id: "prediction.frontend",
        version: "1.0.0",
        name: "Prediction Frontend",
        category: "defi",
        manifest: { page_template: { layout: "prediction" } },
      },
    });

    await handler(req, res);

    expect([201, 202]).toContain(res._getStatusCode());
    const payload = JSON.parse(res._getData());
    expect(payload.success).toBe(true);
  });
});
