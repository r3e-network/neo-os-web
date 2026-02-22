import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/publish-requests";

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

jest.mock("@/lib/miniapp-publish-approval", () => ({
  classifyPublishRequestTiming: jest.fn(() => ({
    ageMinutes: 10,
    slaMinutes: 60,
    escalationMinutes: 180,
    isSlaBreached: false,
    isEscalated: false,
  })),
  getPublishRequestSlaMinutes: jest.fn(() => 60),
  getPublishRequestEscalationMinutes: jest.fn(() => 180),
  isReviewer: jest.fn(() => true),
  listPublishRequests: jest.fn(),
  updatePublishRequestStatus: jest.fn(),
}));

jest.mock("@/lib/miniapp-versioning", () => ({
  recordMiniAppVersion: jest.fn(),
}));

jest.mock("@/lib/miniapp-admin", () => ({
  normalizeMiniAppAdminPayload: jest.fn(),
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

const {
  listPublishRequests,
  updatePublishRequestStatus,
  isReviewer,
} = jest.requireMock("@/lib/miniapp-publish-approval") as {
  classifyPublishRequestTiming: jest.Mock;
  getPublishRequestSlaMinutes: jest.Mock;
  getPublishRequestEscalationMinutes: jest.Mock;
  isReviewer: jest.Mock;
  listPublishRequests: jest.Mock;
  updatePublishRequestStatus: jest.Mock;
};

const { normalizeMiniAppAdminPayload } = jest.requireMock("@/lib/miniapp-admin") as {
  normalizeMiniAppAdminPayload: jest.Mock;
};

const { recordMiniAppVersion } = jest.requireMock("@/lib/miniapp-versioning") as {
  recordMiniAppVersion: jest.Mock;
};

const { appendPublishApprovalAuditEvent } = jest.requireMock("@/lib/publish-approval-audit") as {
  appendPublishApprovalAuditEvent: jest.Mock;
};

function makeSupabaseMock(options: { requestedBy?: string } = {}) {
  const requestSingle = jest.fn().mockResolvedValue({
    data: {
      id: "11111111-1111-4111-8111-111111111111",
      app_id: "miniapp-market",
      status: "pending",
      requested_by: options.requestedBy || "requester-wallet",
    },
    error: null,
  });

  const requestSelect = jest.fn(() => ({
    eq: jest.fn(() => ({
      single: requestSingle,
    })),
  }));

  const appSingle = jest.fn().mockResolvedValue({
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
      manifest: {},
    },
    error: null,
  });

  const appSelect = jest.fn(() => ({
    eq: jest.fn(() => ({
      single: appSingle,
    })),
  }));

  const upsertSingle = jest.fn().mockResolvedValue({
    data: {
      app_id: "miniapp-market",
      status: "active",
    },
    error: null,
  });

  const upsert = jest.fn(() => ({
    select: jest.fn(() => ({
      single: upsertSingle,
    })),
  }));

  const from = jest.fn((table: string) => {
    if (table === "miniapp_publish_requests") {
      return {
        select: requestSelect,
      };
    }

    if (table === "miniapps") {
      return {
        select: appSelect,
        upsert,
      };
    }

    return {
      select: jest.fn(),
      upsert: jest.fn(),
    };
  });

  return {
    supabase: { from },
  };
}

describe("/api/miniapps/admin/publish-requests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    hasServiceRoleSupabase.mockReturnValue(true);
    getServerSupabaseClient.mockReturnValue(makeSupabaseMock().supabase);
    isReviewer.mockReturnValue(true);
  });

  it("lists publish requests", async () => {
    listPublishRequests.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        app_id: "miniapp-market",
        status: "pending",
        requested_at: "2026-02-22T00:00:00.000Z",
      },
    ]);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { app_id: "miniapp-market", status: "pending" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.requests).toHaveLength(1);
    expect(payload.sla).toEqual(
      expect.objectContaining({
        minutes: 60,
        escalation_minutes: 180,
      }),
    );
  });

  it("approves pending publish request and applies publish", async () => {
    const { supabase } = makeSupabaseMock({ requestedBy: "requester-wallet" });
    getServerSupabaseClient.mockReturnValue(supabase);
    requireMiniAppAdmin.mockResolvedValue({ kind: "wallet", value: "reviewer-wallet" });

    updatePublishRequestStatus
      .mockResolvedValueOnce({ id: "11111111-1111-4111-8111-111111111111", status: "approved" })
      .mockResolvedValueOnce({ id: "11111111-1111-4111-8111-111111111111", status: "applied" });

    normalizeMiniAppAdminPayload.mockReturnValue({
      ok: true,
      action: "publish",
      blueprint: "prediction",
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
        manifest_hash: "abc",
        manifest: {},
      },
    });

    recordMiniAppVersion.mockResolvedValue({
      version: {
        id: "22222222-2222-4222-8222-222222222222",
        version_no: 4,
      },
      releases: {
        app_id: "miniapp-market",
      },
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        request_id: "11111111-1111-4111-8111-111111111111",
        decision: "approve",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.success).toBe(true);
    expect(recordMiniAppVersion).toHaveBeenCalled();
    expect(appendPublishApprovalAuditEvent).toHaveBeenCalled();
  });

  it("rejects review when actor is not reviewer", async () => {
    isReviewer.mockReturnValue(false);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        request_id: "11111111-1111-4111-8111-111111111111",
        decision: "approve",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
  });

  it("rejects self-approval for wallet requester", async () => {
    const { supabase } = makeSupabaseMock({ requestedBy: "same-wallet" });
    getServerSupabaseClient.mockReturnValue(supabase);
    requireMiniAppAdmin.mockResolvedValue({ kind: "wallet", value: "same-wallet" });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        request_id: "11111111-1111-4111-8111-111111111111",
        decision: "approve",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
  });
});
