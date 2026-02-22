import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/status";

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
  recordMiniAppVersion: jest.fn(),
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

const { recordMiniAppVersion } = jest.requireMock("@/lib/miniapp-versioning") as {
  recordMiniAppVersion: jest.Mock;
};

function makeSupabaseMock() {
  const existingMaybeSingle = jest.fn().mockResolvedValue({
    data: {
      app_id: "miniapp-market",
      manifest: { admin: { lifecycle_status: "pending" } },
    },
    error: null,
  });

  const maybeSingle = jest.fn().mockResolvedValue({
    data: {
      app_id: "miniapp-market",
      name: "Market",
      description: "",
      icon: "🧩",
      category: "utility",
      entry_url: "https://example.com/market",
      contract_hash: null,
      status: "pending",
      permissions: {},
      limits: {},
      logo_url: null,
      banner_url: null,
      docs_url: null,
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      developer_pubkey: "",
      assets_allowed: ["GAS"],
      governance_assets_allowed: ["BNEO"],
      manifest_hash: "abc",
      manifest: {},
    },
    error: null,
  });

  const existingEq = jest.fn(() => ({ maybeSingle: existingMaybeSingle }));
  const existingSelect = jest.fn(() => ({ eq: existingEq }));

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
      developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      developer_pubkey: "",
      assets_allowed: ["GAS"],
      governance_assets_allowed: ["BNEO"],
      manifest_hash: "def",
      manifest: { admin: { lifecycle_status: "active" } },
    },
    error: null,
  });

  const updateEq = jest.fn(() => ({ select: jest.fn(() => ({ single })) }));
  const update = jest.fn(() => ({ eq: updateEq }));

  const from = jest.fn(() => ({
    select: existingSelect,
    update,
  }));

  return {
    supabase: { from },
  };
}

describe("/api/miniapps/admin/status versioning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    hasServiceRoleSupabase.mockReturnValue(true);
    recordMiniAppVersion.mockResolvedValue({
      version: {
        id: "11111111-1111-4111-8111-111111111111",
        app_id: "miniapp-market",
        version_no: 2,
        release_channel: "published",
        source_action: "publish",
      },
      releases: {
        app_id: "miniapp-market",
        draft_version_id: null,
        published_version_id: "11111111-1111-4111-8111-111111111111",
        updated_at: "2026-02-22T00:00:00.000Z",
      },
    });
  });

  it("records a version snapshot after status update", async () => {
    const { supabase } = makeSupabaseMock();
    getServerSupabaseClient.mockReturnValue(supabase);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        app_id: "miniapp-market",
        status: "active",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(recordMiniAppVersion).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: "publish",
      }),
    );
  });
});
