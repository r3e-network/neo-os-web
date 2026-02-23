import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/import-batch";

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
  getServerSupabaseClient: jest.fn(),
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
const { normalizeMiniAppAdminPayload } = jest.requireMock("@/lib/miniapp-admin") as {
  normalizeMiniAppAdminPayload: jest.Mock;
};
const { recordMiniAppVersion } = jest.requireMock("@/lib/miniapp-versioning") as {
  recordMiniAppVersion: jest.Mock;
};

function createSupabaseMock() {
  const miniappsMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const releasesMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const upsert = jest.fn().mockResolvedValue({ error: null });

  const from = jest.fn((table: string) => {
    if (table === "miniapps") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: miniappsMaybeSingle,
          })),
        })),
        upsert,
      };
    }
    if (table === "miniapp_releases") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: releasesMaybeSingle,
          })),
        })),
      };
    }
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    };
  });

  return {
    supabase: { from },
    upsert,
  };
}

describe("/api/miniapps/admin/import-batch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    hasServiceRoleSupabase.mockReturnValue(true);
    normalizeMiniAppAdminPayload.mockReturnValue({
      ok: true,
      action: "save_draft",
      blueprint: "default",
      row: { app_id: "miniapp-batch-a", name: "Batch A" },
    });
    recordMiniAppVersion.mockResolvedValue({
      version: {
        id: "11111111-1111-4111-8111-111111111111",
        app_id: "miniapp-batch-a",
        version_no: 2,
        release_channel: "draft",
      },
    });
  });

  it("returns 405 for non-POST requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns config error when service role is unavailable", async () => {
    hasServiceRoleSupabase.mockReturnValue(false);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { definitions: [] },
    });

    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });

  it("validates uploaded definitions in dry-run mode", async () => {
    const { supabase, upsert } = createSupabaseMock();
    getServerSupabaseClient.mockReturnValue(supabase);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        dry_run: true,
        definitions: [
          {
            file_name: "a.json",
            payload: {
              app_id: "miniapp-batch-a",
              name: "Batch A",
              template_type: "utility",
              entry_url: "https://example.com/a",
            },
          },
        ],
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.dry_run).toBe(true);
    expect(payload.summary).toEqual({ total: 1, failed: 0, validated: 1, imported: 0 });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("imports uploaded definitions and returns rollback plan", async () => {
    const { supabase, upsert } = createSupabaseMock();
    getServerSupabaseClient.mockReturnValue(supabase);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        dry_run: false,
        definitions: [
          {
            file_name: "a.yaml",
            payload: {
              app_id: "miniapp-batch-a",
              name: "Batch A",
              template_type: "utility",
              entry_url: "https://example.com/a",
            },
          },
        ],
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.summary).toEqual({ total: 1, failed: 0, validated: 0, imported: 1 });
    expect(payload.rollback_plan).toEqual(
      expect.objectContaining({
        import_batch_id: expect.any(String),
      }),
    );
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(recordMiniAppVersion).toHaveBeenCalledTimes(1);
  });
});
