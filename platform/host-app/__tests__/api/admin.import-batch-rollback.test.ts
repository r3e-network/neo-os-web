import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/import-batch-rollback";

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
  rollbackMiniAppVersion: jest.fn(),
  recordMiniAppVersion: jest.fn(),
}));

const { requireMiniAppAdmin } = jest.requireMock("@/lib/admin-auth") as {
  requireMiniAppAdmin: jest.Mock;
};
const { getServerSupabaseClient } = jest.requireMock("@/lib/server-supabase") as {
  getServerSupabaseClient: jest.Mock;
};
const { normalizeMiniAppAdminPayload } = jest.requireMock("@/lib/miniapp-admin") as {
  normalizeMiniAppAdminPayload: jest.Mock;
};
const { rollbackMiniAppVersion, recordMiniAppVersion } = jest.requireMock("@/lib/miniapp-versioning") as {
  rollbackMiniAppVersion: jest.Mock;
  recordMiniAppVersion: jest.Mock;
};

function createSupabaseMock() {
  const miniappsMaybeSingle = jest.fn().mockResolvedValue({
    data: {
      app_id: "miniapp-created",
      name: "Created App",
      description: "",
      icon: "🧩",
      category: "utility",
      entry_url: "mf://manifest?app=miniapp-created",
      contract_hash: null,
      status: "pending",
      permissions: {},
      limits: {},
      logo_url: null,
      banner_url: null,
      docs_url: null,
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      developer_pubkey: "03ab",
      assets_allowed: ["GAS"],
      governance_assets_allowed: ["BNEO"],
      manifest: { app_id: "miniapp-created", name: "Created App", template_type: "utility" },
    },
    error: null,
  });
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: miniappsMaybeSingle,
      })),
    })),
    upsert,
  }));

  return { supabase: { from }, upsert };
}

describe("/api/miniapps/admin/import-batch-rollback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    rollbackMiniAppVersion.mockResolvedValue({
      row: { app_id: "miniapp-a", name: "A", entry_url: "mf://manifest?app=miniapp-a", manifest_hash: "0x123", manifest: {} },
      targetVersion: { version_no: 1 },
    });
    normalizeMiniAppAdminPayload.mockReturnValue({
      ok: true,
      action: "disable",
      blueprint: "default",
      row: { app_id: "miniapp-created", name: "Created App" },
    });
    recordMiniAppVersion.mockResolvedValue({
      version: {
        id: "11111111-1111-4111-8111-111111111111",
      },
    });
  });

  it("returns 405 for non-POST requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("rolls back update targets by version id", async () => {
    const { supabase, upsert } = createSupabaseMock();
    getServerSupabaseClient.mockReturnValue(supabase);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        targets: [
          {
            app_id: "miniapp-a",
            mode: "update",
            rollback_version_id: "11111111-1111-4111-8111-111111111111",
            rollback_release_channel: "draft",
          },
        ],
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.summary.rolled_back).toBe(1);
    expect(upsert).toHaveBeenCalled();
    expect(rollbackMiniAppVersion).toHaveBeenCalled();
  });

  it("disables created targets when no rollback version id is available", async () => {
    const { supabase, upsert } = createSupabaseMock();
    getServerSupabaseClient.mockReturnValue(supabase);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        targets: [
          {
            app_id: "miniapp-created",
            mode: "create",
          },
        ],
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.summary.disabled_created_app).toBe(1);
    expect(upsert).toHaveBeenCalled();
    expect(recordMiniAppVersion).toHaveBeenCalled();
  });
});
