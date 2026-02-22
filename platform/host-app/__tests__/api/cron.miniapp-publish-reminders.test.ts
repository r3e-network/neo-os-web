import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/cron/miniapp-publish-reminders";

describe("/api/cron/miniapp-publish-reminders", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalHostBase = process.env.HOST_APP_BASE_URL;
  const originalAdminApiKey = process.env.MINIAPP_ADMIN_API_KEY;
  const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.HOST_APP_BASE_URL = "https://host-app.example.com";
    process.env.MINIAPP_ADMIN_API_KEY = "test-admin-api-key";
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    process.env.HOST_APP_BASE_URL = originalHostBase;
    process.env.MINIAPP_ADMIN_API_KEY = originalAdminApiKey;
    if (originalFetch) {
      (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch;
    }
  });

  it("rejects unauthorized cron requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: {
        authorization: "Bearer wrong",
      },
    });

    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("invokes publish reminder endpoint with cron auth", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, sent: 1 }),
    } as Response);
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: {
        authorization: "Bearer test-cron-secret",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://host-app.example.com/api/miniapps/admin/publish-reminders");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-cron-secret");
  });
});
