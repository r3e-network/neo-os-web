import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/publish-reminders";

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
    ageMinutes: 200,
    isSlaBreached: true,
    isEscalated: true,
  })),
  listPublishRequests: jest.fn(),
}));

jest.mock("@/lib/publish-reminder", () => ({
  sendPublishReminders: jest.fn(),
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

const { listPublishRequests } = jest.requireMock("@/lib/miniapp-publish-approval") as {
  listPublishRequests: jest.Mock;
};

const { sendPublishReminders } = jest.requireMock("@/lib/publish-reminder") as {
  sendPublishReminders: jest.Mock;
};

const { appendPublishApprovalAuditEvent } = jest.requireMock("@/lib/publish-approval-audit") as {
  appendPublishApprovalAuditEvent: jest.Mock;
};

describe("/api/miniapps/admin/publish-reminders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    hasServiceRoleSupabase.mockReturnValue(true);
    getServerSupabaseClient.mockReturnValue({});
  });

  it("triggers reminder dry-run", async () => {
    listPublishRequests.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        app_id: "miniapp-market",
        status: "pending",
        requested_at: "2026-02-22T00:00:00.000Z",
      },
    ]);

    sendPublishReminders.mockResolvedValue({
      success: true,
      sent: 0,
      dry_run: true,
      channel: "webhook",
      reminders: [
        {
          request_id: "11111111-1111-4111-8111-111111111111",
          app_id: "miniapp-market",
          status: "escalated",
          age_minutes: 200,
          message: "test",
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
    expect(payload.success).toBe(true);
    expect(payload.dry_run).toBe(true);
    expect(sendPublishReminders).toHaveBeenCalled();
  });

  it("appends audit events when reminders sent", async () => {
    listPublishRequests.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        app_id: "miniapp-market",
        status: "pending",
        requested_at: "2026-02-22T00:00:00.000Z",
      },
    ]);

    sendPublishReminders.mockResolvedValue({
      success: true,
      sent: 1,
      dry_run: false,
      channel: "webhook",
      reminders: [
        {
          request_id: "11111111-1111-4111-8111-111111111111",
          app_id: "miniapp-market",
          status: "escalated",
          age_minutes: 200,
          message: "test",
        },
      ],
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { dry_run: false },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(appendPublishApprovalAuditEvent).toHaveBeenCalledTimes(1);
  });
});
