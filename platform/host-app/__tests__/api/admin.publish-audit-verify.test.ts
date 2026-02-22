import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/publish-audit-verify";

jest.mock("@/lib/csrf", () => ({
  withCsrfProtection: (wrapped: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void) => wrapped,
}));

jest.mock("@/lib/admin-auth", () => ({
  requireMiniAppAdmin: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  standardLimit: jest.fn(() => false),
}));

jest.mock("@/lib/server-supabase", () => ({
  hasServiceRoleSupabase: jest.fn(),
  getServerSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/publish-approval-audit-verify", () => ({
  verifyPublishApprovalAuditChain: jest.fn(),
}));

const { requireMiniAppAdmin } = jest.requireMock("@/lib/admin-auth") as {
  requireMiniAppAdmin: jest.Mock;
};

const { hasServiceRoleSupabase, getServerSupabaseClient } = jest.requireMock("@/lib/server-supabase") as {
  hasServiceRoleSupabase: jest.Mock;
  getServerSupabaseClient: jest.Mock;
};

const { verifyPublishApprovalAuditChain } = jest.requireMock("@/lib/publish-approval-audit-verify") as {
  verifyPublishApprovalAuditChain: jest.Mock;
};

describe("/api/miniapps/admin/publish-audit-verify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    hasServiceRoleSupabase.mockReturnValue(true);
    getServerSupabaseClient.mockReturnValue({});
  });

  it("returns verification summary", async () => {
    verifyPublishApprovalAuditChain.mockResolvedValue({
      ok: true,
      scanned: 10,
      requests: 3,
      total_events: 10,
      invalid_hash_events: 0,
      chain_break_events: 0,
      table_missing: false,
      generated_at: "2026-02-22T00:00:00.000Z",
      issues: [],
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {
        app_id: "miniapp-market",
        limit: "100",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.ok).toBe(true);
    expect(payload.total_events).toBe(10);
  });

  it("returns 409 when verification fails", async () => {
    verifyPublishApprovalAuditChain.mockResolvedValue({
      ok: false,
      scanned: 8,
      requests: 2,
      total_events: 8,
      invalid_hash_events: 1,
      chain_break_events: 1,
      table_missing: false,
      generated_at: "2026-02-22T00:00:00.000Z",
      issues: [
        {
          request_id: "11111111-1111-4111-8111-111111111111",
          id: "aaaa",
          type: "chain_hash_mismatch",
        },
      ],
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {
        app_id: "miniapp-market",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(409);
    const payload = JSON.parse(res._getData());
    expect(payload.ok).toBe(false);
  });

  it("rejects invalid app_id", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {
        app_id: "INVALID!!!",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
  });
});
