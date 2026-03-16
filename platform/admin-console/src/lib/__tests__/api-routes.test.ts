import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_KEY = "test-admin-key-123";

function authedRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: { "x-admin-key": API_KEY, ...(init?.headers as Record<string, string>) },
  });
}

/** Minimal mock Response with optional content-range header. */
function mockJsonResponse(body: unknown, { ok = true, status = 200, contentRange }: { ok?: boolean; status?: number; contentRange?: string } = {}) {
  const headersInit: Record<string, string> = { "content-type": "application/json" };
  if (contentRange) {
    headersInit["content-range"] = contentRange;
  }

  return Promise.resolve({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    headers: new Headers(headersInit),
  } as Response);
}

// ---------------------------------------------------------------------------
// Environment & module-level setup
// ---------------------------------------------------------------------------

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("ADMIN_CONSOLE_API_KEY", API_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "srk");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("MINIAPP_HOST_APP_BASE_URL", "http://host-app.test");
  vi.stubEnv("CONTRACT_APPREGISTRY_HASH", "0x1111111111111111111111111111111111111111");
  vi.stubEnv("MINIAPP_PUBLISH_APPROVAL_REQUIRED", "true");
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Dynamic import helper – must be called AFTER env vars are set so
// admin-auth picks up the key at module evaluation time.
async function importRoute<T>(path: string): Promise<T> {
  return await import(path) as T;
}

function routeParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

// ==========================================================================
// 1. Auth tests (shared pattern – tested via /api/analytics)
// ==========================================================================

describe("Admin auth (shared)", () => {
  it("missing auth header → 401", async () => {
    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/analytics/route");
    const res = await GET(new Request("http://localhost/api/analytics"));
    expect(res.status).toBe(401);
  });

  it("invalid auth header → 401", async () => {
    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/analytics/route");
    const req = new Request("http://localhost/api/analytics", {
      headers: { "x-admin-key": "wrong-key" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("valid auth header → not 401", async () => {
    fetchSpy.mockImplementation(() => mockJsonResponse([], { contentRange: "0-0/0" }));
    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/analytics/route");
    const res = await GET(authedRequest("http://localhost/api/analytics"));
    expect(res.status).not.toBe(401);
  });
});

// ==========================================================================
// 2. GET /api/analytics
// ==========================================================================

describe("GET /api/analytics", () => {
  it("returns analytics data with correct shape", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("rpc/get_usage_by_app")) {
        return mockJsonResponse([{ app_id: "a", total_gas: 10, user_count: 1 }]);
      }
      if (url.includes("miniapp_usage") && url.includes("gte.")) {
        return mockJsonResponse([{ usage_date: "2026-02-15", gas_used: 5 }]);
      }
      if (url.includes("miniapp_usage")) {
        return mockJsonResponse([{ gas_used: 42 }]);
      }
      // count endpoints
      return mockJsonResponse([], { contentRange: "0-0/7" });
    });

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/analytics/route");
    const res = await GET(authedRequest("http://localhost/api/analytics"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      totalUsers: expect.any(Number),
      totalMiniApps: expect.any(Number),
      totalTransactions: expect.any(Number),
      gasUsageToday: 42,
      usageByApp: expect.any(Array),
      usageOverTime: expect.any(Array),
    });
  });

  it("handles Supabase timeout gracefully → 500", async () => {
    fetchSpy.mockRejectedValue(new Error("timeout"));
    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/analytics/route");
    const res = await GET(authedRequest("http://localhost/api/analytics"));
    expect(res.status).toBe(500);
  });

  it("fails fast when Supabase env is missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_CONSOLE_API_KEY", API_KEY);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.resetModules();

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/analytics/route");
    const res = await GET(authedRequest("http://localhost/api/analytics"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("environment");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// 3. GET /api/analytics/by-app
// ==========================================================================

describe("GET /api/analytics/by-app", () => {
  it("returns usage data array", async () => {
    const payload = [{ app_id: "x", gas_used: 50, tx_count: 3 }];
    fetchSpy.mockReturnValue(mockJsonResponse(payload));

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/analytics/by-app/route");
    const res = await GET(authedRequest("http://localhost/api/analytics/by-app"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(payload);
  });

  it("handles Supabase error → 500", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ error: "db" }, { ok: false, status: 502 }));

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/analytics/by-app/route");
    const res = await GET(authedRequest("http://localhost/api/analytics/by-app"));
    expect(res.status).toBe(500);
  });

  it("fails fast when Supabase env is missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_CONSOLE_API_KEY", API_KEY);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.resetModules();

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/analytics/by-app/route");
    const res = await GET(authedRequest("http://localhost/api/analytics/by-app"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("environment");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// 4. GET /api/services/health
// ==========================================================================

describe("GET /api/services/health", () => {
  it("returns health check array", async () => {
    fetchSpy.mockImplementation(() =>
      mockJsonResponse([{ name: "service-a", status: "healthy", version: "1.0.0" }]),
    );

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/services/health/route");
    const res = await GET(authedRequest("http://localhost/api/services/health"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toMatchObject({ name: expect.any(String), status: "healthy" });
  });

  it("handles service timeout -> unhealthy status, not crash", async () => {
    fetchSpy.mockRejectedValue(new Error("timeout"));

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/services/health/route");
    const res = await GET(authedRequest("http://localhost/api/services/health"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("timeout");
  });
});

// ==========================================================================
// 5. POST /api/miniapps/update-status
// ==========================================================================

describe("POST /api/miniapps/update-status", () => {
  const url = "http://localhost/api/miniapps/update-status";

  function postReq(body: unknown) {
    return authedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("missing body → 400", async () => {
    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/update-status/route");
    // Send request with no body – req.json() will throw
    const req = authedRequest(url, { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("invalid appId format → 400", async () => {
    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/update-status/route");
    const res = await POST(postReq({ appId: "INVALID!!!", status: "active" }));
    expect(res.status).toBe(400);
  });

  it("invalid status value → 400", async () => {
    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/update-status/route");
    const res = await POST(postReq({ appId: "my-app", status: "deleted" }));
    expect(res.status).toBe(400);
  });

  it("valid request → 200", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ success: true }));
    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/update-status/route");
    const res = await POST(postReq({ appId: "my-app", status: "active" }));
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toMatchObject({
      success: true,
    });

    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/miniapps/admin/status");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body).toEqual({ app_id: "my-app", status: "active" });
  });

  it("forwards host-admin errors", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ error: "Host denied status change" }, { ok: false, status: 403 }));

    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/update-status/route");
    const res = await POST(postReq({ appId: "my-app", status: "active" }));

    expect(res.status).toBe(403);
    const payload = await res.json();
    expect(payload.error).toBe("Host denied status change");
  });
});

// ==========================================================================
// 6. POST /api/miniapps/create
// ==========================================================================

describe("POST /api/miniapps/create", () => {
  const url = "http://localhost/api/miniapps/create";

  function postReq(body: unknown) {
    return authedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("proxies create to host admin upsert", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ success: true }));

    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/create/route");
    const res = await POST(postReq({
      app_id: "miniapp-create-test",
      name: "Create Test",
      entry_url: "https://example.com/create",
      template_type: "default",
    }));

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/miniapps/admin/upsert");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.app_id).toBe("miniapp-create-test");
    expect(body.action).toBe("save_draft");
  });

  it("preserves explicit action when provided", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ success: true }));

    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/create/route");
    const res = await POST(postReq({
      app_id: "miniapp-create-test",
      name: "Create Test",
      entry_url: "https://example.com/create",
      template_type: "default",
      action: "publish",
    }));

    expect(res.status).toBe(200);
    const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.action).toBe("publish");
  });

  it("rejects invalid create payload", async () => {
    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/create/route");
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes through publish-request response status", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ success: true, action: "publish_requested" }, { status: 202 }));

    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/create/route");
    const res = await POST(postReq({
      app_id: "miniapp-create-test",
      name: "Create Test",
      entry_url: "https://example.com/create",
      template_type: "default",
      action: "publish",
    }));

    expect(res.status).toBe(202);
    const payload = await res.json();
    expect(payload.action).toBe("publish_requested");
  });
});

// ==========================================================================
// 6.5. GET /api/miniapps/versions
// ==========================================================================

describe("GET /api/miniapps/versions", () => {
  it("rejects invalid app_id", async () => {
    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/versions/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps/versions?app_id=INVALID!!!"));
    expect(res.status).toBe(400);
  });

  it("proxies version list request to host admin endpoint", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ app_id: "my-app", versions: [] }));

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/versions/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps/versions?app_id=my-app&release_channel=published"));

    expect(res.status).toBe(200);
    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("/api/miniapps/admin/versions");
    expect(calledUrl).toContain("app_id=my-app");
    expect(calledUrl).toContain("release_channel=published");
    expect(calledUrl).toContain("include_payload=true");
  });

  it("rejects invalid release_channel", async () => {
    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/versions/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps/versions?app_id=my-app&release_channel=invalid"));
    expect(res.status).toBe(400);
  });
});

// ==========================================================================
// 6.6. POST /api/miniapps/rollback
// ==========================================================================

describe("POST /api/miniapps/rollback", () => {
  const url = "http://localhost/api/miniapps/rollback";

  function postReq(body: unknown) {
    return authedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("rejects rollback payload without version selector", async () => {
    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/rollback/route");
    const res = await POST(postReq({ app_id: "my-app" }));
    expect(res.status).toBe(400);
  });

  it("proxies rollback request to host admin endpoint", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ success: true }));

    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/rollback/route");
    const res = await POST(postReq({
      app_id: "my-app",
      version_id: "a1b2c3d4-e5f6-4711-8222-aabbccddeeff",
      release_channel: "published",
    }));

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/miniapps/admin/rollback");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.app_id).toBe("my-app");
    expect(body.version_id).toBe("a1b2c3d4-e5f6-4711-8222-aabbccddeeff");
    expect(body.release_channel).toBe("published");
  });
});

// ==========================================================================
// 6.7. /api/miniapps/publish-requests
// ==========================================================================

describe("/api/miniapps/publish-requests", () => {
  it("GET proxies publish request list", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({
      status: "pending",
      requests: [],
      sla: {
        minutes: 60,
        escalation_minutes: 180,
        pending: 0,
        sla_breached: 0,
        escalated: 0,
      },
    }));

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/publish-requests/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps/publish-requests?app_id=my-app&status=pending"));

    expect(res.status).toBe(200);
    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("/api/miniapps/admin/publish-requests");
    expect(calledUrl).toContain("app_id=my-app");
    expect(calledUrl).toContain("status=pending");
  });

  it("POST proxies publish request review decision", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ success: true }));

    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/publish-requests/route");
    const req = authedRequest("http://localhost/api/miniapps/publish-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: "11111111-1111-4111-8111-111111111111",
        decision: "approve",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/miniapps/admin/publish-requests");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.request_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.decision).toBe("approve");
  });

  it("POST validates publish request review payload", async () => {
    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/publish-requests/route");
    const req = authedRequest("http://localhost/api/miniapps/publish-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: "bad-id",
        decision: "approve",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/miniapps/publish-requests/remind", () => {
  it("proxies reminder trigger to host admin endpoint", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ success: true, reminders: [] }));

    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/publish-requests/remind/route");
    const req = authedRequest("http://localhost/api/miniapps/publish-requests/remind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dry_run: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/miniapps/admin/publish-reminders");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.dry_run).toBe(true);
  });
});

describe("GET /api/miniapps/publish-requests/verify-audit", () => {
  it("proxies audit verification request", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ ok: true, issues: [] }));

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/publish-requests/verify-audit/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps/publish-requests/verify-audit?app_id=my-app&limit=100"));

    expect(res.status).toBe(200);
    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("/api/miniapps/admin/publish-audit-verify");
    expect(calledUrl).toContain("app_id=my-app");
    expect(calledUrl).toContain("limit=100");
  });

  it("rejects invalid request_id format", async () => {
    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/publish-requests/verify-audit/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps/publish-requests/verify-audit?request_id=bad"));
    expect(res.status).toBe(400);
  });

  it("forwards audit verification non-200 errors", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ error: "audit chain mismatch" }, { ok: false, status: 409 }));

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/publish-requests/verify-audit/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps/publish-requests/verify-audit?app_id=my-app"));
    expect(res.status).toBe(409);
    const payload = await res.json();
    expect(payload.error).toBe("audit chain mismatch");
  });
});

describe("GET /api/miniapps/publish-requests/export", () => {
  it("returns csv export payload", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({
      requests: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          app_id: "my-app",
          status: "pending",
          requested_version_no: 2,
          requested_by: "api_key",
          requested_at: "2026-02-22T00:00:00.000Z",
          timing: { ageMinutes: 30, isSlaBreached: false, isEscalated: false },
        },
      ],
    }));

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/publish-requests/export/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps/publish-requests/export?app_id=my-app&status=pending"));

    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("text/csv");
    const csv = await res.text();
    expect(csv).toContain("id,app_id,status");
    expect(csv).toContain("my-app");
  });

  it("validates export status filter", async () => {
    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/publish-requests/export/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps/publish-requests/export?status=invalid"));
    expect(res.status).toBe(400);
  });
});

// ==========================================================================
// 7. GET /api/miniapps
// ==========================================================================

describe("GET /api/miniapps", () => {
  it("rejects invalid app_id filter → 400", async () => {
    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps?app_id=INVALID!!!"));
    expect(res.status).toBe(400);
  });

  it("rejects invalid status filter → 400", async () => {
    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps?status=deleted"));
    expect(res.status).toBe(400);
  });

  it("proxies list request to host catalog endpoint", async () => {
    fetchSpy.mockReturnValue(
      mockJsonResponse({
        apps: [{ app_id: "miniapp-a" }, { app_id: "miniapp-b" }],
      }),
    );

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps?status=active&search=miniapp"));

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toEqual([{ app_id: "miniapp-a" }, { app_id: "miniapp-b" }]);

    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("/api/miniapps/catalog");
    expect(calledUrl).toContain("status=active");
    expect(calledUrl).toContain("search=miniapp");
  });
});

// ==========================================================================
// 8. PATCH /api/miniapps/[id]
// ==========================================================================

describe("PATCH /api/miniapps/[id]", () => {
  const url = "http://localhost/api/miniapps/my-app";

  function patchReq(body: unknown) {
    return authedRequest(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("rejects invalid path app_id → 400", async () => {
    const { PATCH } = await importRoute<{
      PATCH: (r: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const res = await PATCH(patchReq({ name: "ok-name" }), { params: routeParams("INVALID!!!") });
    expect(res.status).toBe(400);
  });

  it("allows updating empty arrays/objects in patch payload", async () => {
    fetchSpy.mockImplementation(() => mockJsonResponse({ success: true }));

    const { PATCH } = await importRoute<{
      PATCH: (r: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const res = await PATCH(
      patchReq({
        assets_allowed: [],
        permissions: {},
        limits: {},
      }),
      { params: routeParams("my-app") },
    );

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/miniapps/admin/upsert");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.app_id).toBe("my-app");
    expect(body.action).toBe("save_draft");
    expect(body.assets_allowed).toEqual([]);
    expect(body.permissions).toEqual({});
    expect(body.limits).toEqual({});
  });

  it("passes explicit publish action to host upsert", async () => {
    fetchSpy.mockImplementation(() => mockJsonResponse({ success: true }));

    const { PATCH } = await importRoute<{
      PATCH: (r: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const res = await PATCH(
      patchReq({ action: "publish", name: "Publish Name", entry_url: "https://example.com/publish" }),
      { params: routeParams("my-app") },
    );

    expect(res.status).toBe(200);
    const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.action).toBe("publish");
    expect(body.app_id).toBe("my-app");
  });
});

// ==========================================================================
// 10. GET /api/miniapps/[id]
// ==========================================================================

describe("GET /api/miniapps/[id]", () => {
  it("proxies detail request to host catalog", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ app: { app_id: "my-app", name: "My App" } }));

    const { GET } = await importRoute<{
      GET: (r: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const req = authedRequest("http://localhost/api/miniapps/my-app");
    const res = await GET(req, { params: Promise.resolve({ id: "my-app" }) });

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toEqual({ app_id: "my-app", name: "My App" });

    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("/api/miniapps/catalog");
    expect(calledUrl).toContain("app_id=my-app");
  });

  it("rejects invalid app id format", async () => {
    const { GET } = await importRoute<{
      GET: (r: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const req = authedRequest("http://localhost/api/miniapps/bad");
    const res = await GET(req, { params: Promise.resolve({ id: "INVALID!!!" }) });
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// 9. DELETE /api/miniapps/[id]
// ==========================================================================

describe("DELETE /api/miniapps/[id]", () => {
  it("proxies delete to disabled status update", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ success: true }));

    const { DELETE } = await importRoute<{
      DELETE: (r: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const req = authedRequest("http://localhost/api/miniapps/my-app", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "my-app" }) });

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/miniapps/admin/status");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body).toEqual({ app_id: "my-app", status: "disabled" });
  });

  it("rejects invalid app id for delete", async () => {
    const { DELETE } = await importRoute<{
      DELETE: (r: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    }>("@/app/api/miniapps/[id]/route");

    const req = authedRequest("http://localhost/api/miniapps/invalid", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "INVALID!!!" }) });

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// 11. POST /api/miniapps/import-batch
// ==========================================================================

describe("POST /api/miniapps/import-batch", () => {
  const url = "http://localhost/api/miniapps/import-batch";

  function postReq(body: unknown) {
    return authedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("validates request payload", async () => {
    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/import-batch/route");
    const res = await POST(postReq({ definitions: [] }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proxies batch import request to host admin endpoint", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({
      success: true,
      dry_run: true,
      stop_on_error: false,
      summary: { total: 1, failed: 0, validated: 1, imported: 0 },
      results: [],
      rollback_plan: null,
    }));

    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/import-batch/route");
    const res = await POST(postReq({
      dry_run: true,
      stop_on_error: false,
      definitions: [{ file_name: "miniapp-a.yaml", content: "app_id: miniapp-a" }],
    }));

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/miniapps/admin/import-batch");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.definitions).toHaveLength(1);
    expect(body.dry_run).toBe(true);
  });
});

// ==========================================================================
// 12. POST /api/miniapps/import-batch/rollback
// ==========================================================================

describe("POST /api/miniapps/import-batch/rollback", () => {
  const url = "http://localhost/api/miniapps/import-batch/rollback";

  function postReq(body: unknown) {
    return authedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("validates rollback payload", async () => {
    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/import-batch/rollback/route");
    const res = await POST(postReq({ targets: [{ app_id: "INVALID!!!" }] }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proxies rollback request to host admin endpoint", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({
      success: true,
      summary: { total: 1, failed: 0, rolled_back: 1, disabled_created_app: 0, noop: 0 },
      results: [{ app_id: "miniapp-a", status: "rolled_back" }],
    }));

    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/import-batch/rollback/route");
    const res = await POST(postReq({
      targets: [
        {
          app_id: "miniapp-a",
          mode: "update",
          rollback_version_id: "11111111-1111-4111-8111-111111111111",
          rollback_release_channel: "draft",
        },
      ],
    }));

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/miniapps/admin/import-batch-rollback");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.targets).toHaveLength(1);
    expect(body.targets[0].app_id).toBe("miniapp-a");
  });
});

// ==========================================================================
// 13. /api/miniapps/template-market
// ==========================================================================

describe("/api/miniapps/template-market", () => {
  it("GET validates query filters", async () => {
    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/template-market/route");
    const res = await GET(authedRequest("http://localhost/api/miniapps/template-market?mode=invalid"));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("GET proxies templates mode and applies local source/search filtering", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({
      templates: [
        { template_id: "prediction.alpha", name: "Prediction Alpha", source_type: "community", category: "defi", tags: ["prediction"] },
        { template_id: "prediction.beta", name: "Prediction Beta", source_type: "verified", category: "defi", tags: ["prediction"] },
      ],
      approval_required: true,
    }));

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/template-market/route");
    const res = await GET(
      authedRequest("http://localhost/api/miniapps/template-market?mode=templates&kind=frontend&source=community&search=alpha&limit=50"),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.mode).toBe("templates");
    expect(payload.templates).toHaveLength(1);
    expect(payload.templates[0].template_id).toBe("prediction.alpha");

    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("/api/miniapps/admin/template-market");
    expect(calledUrl).toContain("mode=templates");
    expect(calledUrl).toContain("kind=frontend");
    expect(calledUrl).toContain("limit=50");
  });

  it("GET proxies requests mode", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({
      requests: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          template_kind: "frontend",
          template_row_id: "22222222-2222-4222-8222-222222222222",
          status: "pending",
          requested_by: "api_key",
          reviewed_by: null,
          review_note: null,
          created_at: "2026-02-22T00:00:00.000Z",
          reviewed_at: null,
        },
      ],
    }));

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/miniapps/template-market/route");
    const res = await GET(
      authedRequest("http://localhost/api/miniapps/template-market?mode=requests&kind=frontend&status=pending"),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.mode).toBe("requests");
    expect(payload.requests).toHaveLength(1);
    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("mode=requests");
    expect(calledUrl).toContain("status=pending");
  });

  it("POST proxies upsert template payload to host admin endpoint", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({ success: true, approval_required: true }, { status: 201 }));

    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/template-market/route");
    const req = authedRequest("http://localhost/api/miniapps/template-market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_template",
        kind: "contract",
        template_id: "contract.prediction.v2",
        version: "1.0.0",
        name: "Prediction Contract v2",
        manifest: { template: { id: "contract.prediction.v2" } },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/miniapps/admin/template-market");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.action).toBe("upsert_template");
    expect(body.template_id).toBe("contract.prediction.v2");
  });
});

// ==========================================================================
// 14. POST /api/miniapps/admin/media/upload-url
// ==========================================================================

describe("POST /api/miniapps/admin/media/upload-url", () => {
  const url = "http://localhost/api/miniapps/admin/media/upload-url";

  function postReq(body: unknown) {
    return authedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("validates media upload payload", async () => {
    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/admin/media/upload-url/route");
    const res = await POST(postReq({
      app_id: "INVALID!!!",
      asset_type: "logo",
      content_type: "image/png",
    }));

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proxies upload-url request to host admin endpoint", async () => {
    fetchSpy.mockReturnValue(mockJsonResponse({
      success: true,
      upload_url: "https://signed.example/upload",
      public_url: "https://meshmini.app/miniapp-assets/miniapp-a/logo.dark.png",
      key: "miniapp-assets/miniapp-a/logo.dark.png",
      expires_in: 900,
    }));

    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/admin/media/upload-url/route");
    const res = await POST(postReq({
      app_id: "miniapp-a",
      asset_type: "logo",
      content_type: "image/png",
      file_name: "logo.png",
      variant: { theme: "dark", density: "2x" },
    }));

    expect(res.status).toBe(200);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/miniapps/admin/media/upload-url");
    const body = JSON.parse(String(calledInit.body || "{}"));
    expect(body.app_id).toBe("miniapp-a");
    expect(body.asset_type).toBe("logo");
  });
});
