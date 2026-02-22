import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/upsert";

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

jest.mock("@/lib/miniapp-admin", () => ({
  normalizeMiniAppAdminPayload: jest.fn(),
}));

jest.mock("@/lib/miniapp", () => ({
  coerceMiniAppInfo: jest.fn((row) => row),
}));

jest.mock("@/lib/miniapp-versioning", () => ({
  recordMiniAppVersion: jest.fn(),
}));

jest.mock("@/lib/miniapp-publish-approval", () => ({
  createPublishRequest: jest.fn(),
  getPendingPublishRequest: jest.fn(async () => null),
  isApprovalRequired: jest.fn(() => false),
}));

jest.mock("@/lib/publish-approval-audit", () => ({
  appendPublishApprovalAuditEvent: jest.fn(),
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

const { createPublishRequest, isApprovalRequired } = jest.requireMock("@/lib/miniapp-publish-approval") as {
  createPublishRequest: jest.Mock;
  isApprovalRequired: jest.Mock;
};

function makeSupabaseMock() {
  const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const existingEq = jest.fn(() => ({ maybeSingle }));
  const existingSelect = jest.fn(() => ({ eq: existingEq }));

  const upsertSingle = jest.fn().mockResolvedValue({
    data: {
      app_id: "miniapp-versioned",
      name: "Versioned",
      description: "",
      icon: "🧩",
      category: "utility",
      entry_url: "https://example.com/versioned",
      contract_hash: null,
      status: "pending",
      permissions: {},
      limits: {},
      logo_url: null,
      banner_url: null,
      docs_url: null,
      manifest: {},
    },
    error: null,
  });

  const upsertSelect = jest.fn(() => ({ single: upsertSingle }));
  const upsert = jest.fn(() => ({ select: upsertSelect }));

  const from = jest.fn((table: string) => {
    if (table === "miniapps") {
      return {
        select: existingSelect,
        upsert,
      };
    }
    return {
      select: jest.fn(() => ({ maybeSingle: jest.fn() })),
      upsert: jest.fn(),
    };
  });

  return {
    supabase: { from },
  };
}

describe("/api/miniapps/admin/upsert versioning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    hasServiceRoleSupabase.mockReturnValue(true);
    isApprovalRequired.mockReturnValue(false);
  });

  it("returns version metadata after successful upsert", async () => {
    const { supabase } = makeSupabaseMock();
    getServerSupabaseClient.mockReturnValue(supabase);

    normalizeMiniAppAdminPayload.mockReturnValue({
      ok: true,
      action: "save_draft",
      blueprint: "default",
      row: {
        app_id: "miniapp-versioned",
        name: "Versioned",
        description: "",
        icon: "🧩",
        category: "utility",
        entry_url: "https://example.com/versioned",
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
    });

    recordMiniAppVersion.mockResolvedValue({
      version: {
        id: "11111111-1111-4111-8111-111111111111",
        app_id: "miniapp-versioned",
        version_no: 1,
        release_channel: "draft",
        source_action: "save_draft",
      },
      releases: {
        app_id: "miniapp-versioned",
        draft_version_id: "11111111-1111-4111-8111-111111111111",
        published_version_id: null,
        updated_at: "2026-02-22T00:00:00.000Z",
      },
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        app_id: "miniapp-versioned",
        name: "Versioned",
        template_type: "utility",
        entry_url: "https://example.com/versioned",
        developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(201);
    const payload = JSON.parse(res._getData());
    expect(payload.success).toBe(true);
    expect(payload.version).toEqual(
      expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
        version_no: 1,
        release_channel: "draft",
      }),
    );
  });

  it("creates publish request when approval is required", async () => {
    const { supabase } = makeSupabaseMock();
    getServerSupabaseClient.mockReturnValue(supabase);
    isApprovalRequired.mockReturnValue(true);

    normalizeMiniAppAdminPayload.mockReturnValue({
      ok: true,
      action: "publish",
      blueprint: "prediction",
      row: {
        app_id: "miniapp-versioned",
        name: "Versioned",
        description: "",
        icon: "🧩",
        category: "utility",
        entry_url: "https://example.com/versioned",
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
        manifest_hash: "abc",
        manifest: {},
      },
    });

    recordMiniAppVersion.mockResolvedValue({
      version: {
        id: "33333333-3333-4333-8333-333333333333",
        app_id: "miniapp-versioned",
        version_no: 2,
        release_channel: "draft",
        source_action: "save_draft",
      },
      releases: {
        app_id: "miniapp-versioned",
        draft_version_id: "33333333-3333-4333-8333-333333333333",
        published_version_id: null,
        updated_at: "2026-02-22T00:00:00.000Z",
      },
    });

    createPublishRequest.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      app_id: "miniapp-versioned",
      status: "pending",
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        app_id: "miniapp-versioned",
        name: "Versioned",
        template_type: "utility",
        entry_url: "https://example.com/versioned",
        developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
        action: "publish",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(202);
    const payload = JSON.parse(res._getData());
    expect(payload.action).toBe("publish_requested");
    expect(createPublishRequest).toHaveBeenCalled();
  });
});
