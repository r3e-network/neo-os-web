import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/rollback";

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

jest.mock("@/lib/miniapp-versioning", () => ({
  rollbackMiniAppVersion: jest.fn(),
}));

jest.mock("@/lib/miniapp", () => ({
  coerceMiniAppInfo: jest.fn((row) => row),
}));

const { requireMiniAppAdmin } = jest.requireMock("@/lib/admin-auth") as {
  requireMiniAppAdmin: jest.Mock;
};

const { hasServiceRoleSupabase, getServerSupabaseClient } = jest.requireMock("@/lib/server-supabase") as {
  hasServiceRoleSupabase: jest.Mock;
  getServerSupabaseClient: jest.Mock;
};

const { rollbackMiniAppVersion } = jest.requireMock("@/lib/miniapp-versioning") as {
  rollbackMiniAppVersion: jest.Mock;
};

function buildSupabaseMock() {
  const single = jest.fn().mockResolvedValue({
    data: {
      app_id: "miniapp-market",
      name: "Market",
      description: "",
      icon: "🧩",
      category: "utility",
      entry_url: "https://example.com/market",
      contract_hash: null,
      status: "active",
      permissions: {},
      limits: {},
      logo_url: null,
      banner_url: null,
      docs_url: null,
      manifest: {},
    },
    error: null,
  });

  const select = jest.fn(() => ({ single }));
  const upsert = jest.fn(() => ({ select }));
  const from = jest.fn(() => ({ upsert }));

  return {
    supabase: { from },
    upsert,
  };
}

describe("/api/miniapps/admin/rollback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    hasServiceRoleSupabase.mockReturnValue(true);
  });

  it("returns 405 for non-POST requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("rejects rollback request without target version selector", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { app_id: "miniapp-market" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(rollbackMiniAppVersion).not.toHaveBeenCalled();
  });

  it("rolls back to a selected version and updates miniapps row", async () => {
    const { supabase, upsert } = buildSupabaseMock();
    getServerSupabaseClient.mockReturnValue(supabase);

    rollbackMiniAppVersion.mockResolvedValue({
      row: {
        app_id: "miniapp-market",
        name: "Market",
        description: "",
        icon: "🧩",
        category: "utility",
        entry_url: "https://example.com/market",
        contract_hash: null,
        status: "active",
        permissions: {},
        limits: {},
        logo_url: null,
        banner_url: null,
        docs_url: null,
        developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
        developer_pubkey: "",
        assets_allowed: ["GAS"],
        governance_assets_allowed: ["BNEO"],
        manifest_hash: "abc123",
        manifest: {},
      },
      targetVersion: {
        id: "11111111-1111-4111-8111-111111111111",
        app_id: "miniapp-market",
        version_no: 2,
      },
      newVersion: {
        id: "22222222-2222-4222-8222-222222222222",
        app_id: "miniapp-market",
        version_no: 3,
      },
      releases: {
        app_id: "miniapp-market",
        draft_version_id: null,
        published_version_id: "22222222-2222-4222-8222-222222222222",
        updated_at: "2026-02-22T00:00:00.000Z",
      },
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        app_id: "miniapp-market",
        version_id: "11111111-1111-4111-8111-111111111111",
        release_channel: "published",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.success).toBe(true);
    expect(payload.rollback).toEqual(
      expect.objectContaining({
        target_version_no: 2,
        new_version_no: 3,
      }),
    );
    expect(rollbackMiniAppVersion).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        appId: "miniapp-market",
        releaseChannel: "published",
      }),
    );
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
