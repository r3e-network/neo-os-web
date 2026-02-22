import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/versions";

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

jest.mock("@/lib/miniapp-versioning", () => ({
  listMiniAppVersions: jest.fn(),
}));

const { requireMiniAppAdmin } = jest.requireMock("@/lib/admin-auth") as {
  requireMiniAppAdmin: jest.Mock;
};

const { hasServiceRoleSupabase, getServerSupabaseClient } = jest.requireMock("@/lib/server-supabase") as {
  hasServiceRoleSupabase: jest.Mock;
  getServerSupabaseClient: jest.Mock;
};

const { listMiniAppVersions } = jest.requireMock("@/lib/miniapp-versioning") as {
  listMiniAppVersions: jest.Mock;
};

describe("/api/miniapps/admin/versions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    hasServiceRoleSupabase.mockReturnValue(true);
    getServerSupabaseClient.mockReturnValue({});
  });

  it("returns 405 for non-GET requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("rejects invalid app_id", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { app_id: "INVALID!!!" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(listMiniAppVersions).not.toHaveBeenCalled();
  });

  it("returns version history payload", async () => {
    listMiniAppVersions.mockResolvedValue({
      app_id: "miniapp-market",
      release_channel: "published",
      releases: {
        draft: "11111111-1111-4111-8111-111111111111",
        published: "22222222-2222-4222-8222-222222222222",
      },
      versions: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          app_id: "miniapp-market",
          version_no: 5,
          source_action: "publish",
          release_channel: "published",
          status: "active",
          manifest_hash: "abc",
          actor: "api_key",
          note: null,
          created_at: "2026-02-22T00:00:00.000Z",
          manifest: { app_id: "miniapp-market" },
          row_snapshot: { app_id: "miniapp-market", status: "active" },
        },
      ],
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { app_id: "miniapp-market", release_channel: "published", include_payload: "true" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.app_id).toBe("miniapp-market");
    expect(payload.versions).toHaveLength(1);
    expect(listMiniAppVersions).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ appId: "miniapp-market", releaseChannel: "published", includePayload: true }),
    );
  });
});
