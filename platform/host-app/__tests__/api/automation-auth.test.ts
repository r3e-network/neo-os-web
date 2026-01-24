import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/automation/register";

jest.mock("@auth0/nextjs-auth0", () => ({
  getSession: jest.fn(),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (table: string) => {
      if (table === "miniapps") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { developer_user_id: "auth0|owner" }, error: null }),
            }),
          }),
        };
      }
      if (table === "admin_emails") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "automation_tasks") {
        return {
          upsert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "task-1" }, error: null }),
            }),
          }),
        };
      }
      return {};
    },
  })),
}));

import { getSession } from "@auth0/nextjs-auth0";

const mockGetSession = getSession as jest.Mock;

describe("/api/automation/register auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockGetSession.mockResolvedValue(null);
    const { req, res } = createMocks({
      method: "POST",
      body: { appId: "app-1", taskName: "task", taskType: "cron" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 403 for non-owner", async () => {
    mockGetSession.mockResolvedValue({ user: { sub: "auth0|outsider" } });
    const { req, res } = createMocks({
      method: "POST",
      body: { appId: "app-1", taskName: "task", taskType: "cron" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
  });
});
