import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/import-definitions";

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
  hasServiceRoleSupabase: jest.fn(),
  getServerSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/miniapp-definitions", () => ({
  loadMiniAppDefinitionPayloads: jest.fn(),
}));

jest.mock("@/lib/miniapp-admin", () => ({
  normalizeMiniAppAdminPayload: jest.fn(),
}));

jest.mock("@/lib/miniapp-versioning", () => ({
  recordMiniAppVersion: jest.fn(),
}));

const { requireMiniAppAdmin } = jest.requireMock("@/lib/admin-auth") as {
  requireMiniAppAdmin: jest.Mock;
};

const { hasServiceRoleSupabase, getServerSupabaseClient } = jest.requireMock("@/lib/server-supabase") as {
  hasServiceRoleSupabase: jest.Mock;
  getServerSupabaseClient: jest.Mock;
};

const { loadMiniAppDefinitionPayloads } = jest.requireMock("@/lib/miniapp-definitions") as {
  loadMiniAppDefinitionPayloads: jest.Mock;
};

const { normalizeMiniAppAdminPayload } = jest.requireMock("@/lib/miniapp-admin") as {
  normalizeMiniAppAdminPayload: jest.Mock;
};

const { recordMiniAppVersion } = jest.requireMock("@/lib/miniapp-versioning") as {
  recordMiniAppVersion: jest.Mock;
};

function makeSupabaseMock(existingRows: Array<Record<string, unknown> | null>) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  for (const row of existingRows) {
    maybeSingle.mockResolvedValueOnce({ data: row, error: null });
  }

  const upsert = jest.fn().mockResolvedValue({ error: null });
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select, upsert }));

  return {
    supabase: { from },
    maybeSingle,
    upsert,
  };
}

describe("/api/miniapps/admin/import-definitions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    hasServiceRoleSupabase.mockReturnValue(true);
    recordMiniAppVersion.mockResolvedValue({
      version: {
        id: "11111111-1111-4111-8111-111111111111",
        app_id: "miniapp-market",
        version_no: 1,
        release_channel: "draft",
        source_action: "save_draft",
      },
      releases: {
        app_id: "miniapp-market",
        draft_version_id: "11111111-1111-4111-8111-111111111111",
        published_version_id: null,
        updated_at: "2026-02-22T00:00:00.000Z",
      },
    });
  });

  it("returns 405 for non-POST requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns config error when service role key is unavailable", async () => {
    hasServiceRoleSupabase.mockReturnValue(false);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST", body: {} });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: {
        code: "CONFIG_ERROR",
        message: "SUPABASE_SERVICE_ROLE_KEY is required for admin miniapp writes",
      },
    });
  });

  it("validates definitions in dry-run mode without writing", async () => {
    const { supabase, upsert } = makeSupabaseMock([null]);
    getServerSupabaseClient.mockReturnValue(supabase);
    loadMiniAppDefinitionPayloads.mockResolvedValue({
      definitionsDir: "/tmp/miniapp-definitions",
      errors: [],
      definitions: [
        {
          fileName: "market.json",
          slug: "market",
          fullPath: "/tmp/miniapp-definitions/market.json",
          payload: {
            app_id: "miniapp-market",
            name: "Market",
            template_type: "prediction",
            entry_url: "https://example.com/market",
          },
        },
      ],
    });
    normalizeMiniAppAdminPayload.mockReturnValue({
      ok: true,
      action: "publish",
      blueprint: "prediction",
      row: { app_id: "miniapp-market" },
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { dry_run: true },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.dry_run).toBe(true);
    expect(payload.summary).toEqual({ total: 1, failed: 0, validated: 1, imported: 0 });
    expect(payload.results[0]).toEqual(
      expect.objectContaining({
        file: "market.json",
        app_id: "miniapp-market",
        status: "validated",
        mode: "create",
      }),
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it("imports valid definitions and reports failures", async () => {
    const { supabase, upsert } = makeSupabaseMock([null, { app_id: "miniapp-existing", developer_user_id: "abc" }]);
    getServerSupabaseClient.mockReturnValue(supabase);
    loadMiniAppDefinitionPayloads.mockResolvedValue({
      definitionsDir: "/tmp/miniapp-definitions",
      errors: [
        {
          fileName: "bad.json",
          slug: "bad",
          fullPath: "/tmp/miniapp-definitions/bad.json",
          error: "Unexpected token } in JSON at position 42",
        },
      ],
      definitions: [
        {
          fileName: "a.json",
          slug: "a",
          fullPath: "/tmp/miniapp-definitions/a.json",
          payload: {
            app_id: "miniapp-a",
            name: "A",
            template_type: "utility",
            entry_url: "https://example.com/a",
          },
        },
        {
          fileName: "existing.json",
          slug: "existing",
          fullPath: "/tmp/miniapp-definitions/existing.json",
          payload: {
            app_id: "miniapp-existing",
            name: "Existing",
            template_type: "utility",
            entry_url: "https://example.com/existing",
          },
        },
      ],
    });
    normalizeMiniAppAdminPayload
      .mockReturnValueOnce({
        ok: true,
        action: "publish",
        blueprint: "default",
        row: { app_id: "miniapp-a", name: "A" },
      })
      .mockReturnValueOnce({
        ok: false,
        error: "developer_user_id is required and must be a UUID",
      });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {},
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.success).toBe(false);
    expect(payload.summary).toEqual({ total: 3, failed: 2, validated: 0, imported: 1 });
    expect(payload.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "bad.json", status: "failed" }),
        expect.objectContaining({ file: "a.json", status: "imported", mode: "create" }),
        expect.objectContaining({
          file: "existing.json",
          status: "failed",
          error: "developer_user_id is required and must be a UUID",
        }),
      ]),
    );
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects definitions that violate schema-required fields", async () => {
    const { supabase, upsert } = makeSupabaseMock([]);
    getServerSupabaseClient.mockReturnValue(supabase);
    loadMiniAppDefinitionPayloads.mockResolvedValue({
      definitionsDir: "/tmp/miniapp-definitions",
      errors: [],
      definitions: [
        {
          fileName: "missing-template-type.json",
          slug: "missing-template-type",
          fullPath: "/tmp/miniapp-definitions/missing-template-type.json",
          payload: {
            app_id: "miniapp-missing-template-type",
            name: "Missing Template Type",
            entry_url: "https://example.com/missing-template-type",
          },
        },
      ],
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { dry_run: true },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.success).toBe(false);
    expect(payload.summary).toEqual({ total: 1, failed: 1, validated: 0, imported: 0 });
    expect(payload.results[0]).toEqual(
      expect.objectContaining({
        file: "missing-template-type.json",
        status: "failed",
        error: expect.stringContaining("template_type"),
      }),
    );
    expect(normalizeMiniAppAdminPayload).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects unsupported top-level fields from schema", async () => {
    const { supabase, upsert } = makeSupabaseMock([]);
    getServerSupabaseClient.mockReturnValue(supabase);
    loadMiniAppDefinitionPayloads.mockResolvedValue({
      definitionsDir: "/tmp/miniapp-definitions",
      errors: [],
      definitions: [
        {
          fileName: "invalid-field.json",
          slug: "invalid-field",
          fullPath: "/tmp/miniapp-definitions/invalid-field.json",
          payload: {
            app_id: "miniapp-invalid-field",
            name: "Invalid Field",
            template_type: "utility",
            entry_url: "https://example.com/invalid-field",
            unexpected_field: "not-allowed",
          },
        },
      ],
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { dry_run: true },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.success).toBe(false);
    expect(payload.summary).toEqual({ total: 1, failed: 1, validated: 0, imported: 0 });
    expect(payload.results[0]).toEqual(
      expect.objectContaining({
        file: "invalid-field.json",
        status: "failed",
        error: expect.stringContaining("Unsupported top-level field"),
      }),
    );
    expect(normalizeMiniAppAdminPayload).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
