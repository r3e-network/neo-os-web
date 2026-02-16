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
  return Promise.resolve({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(body),
    headers: new Headers(contentRange ? { "content-range": contentRange } : {}),
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
});

// ==========================================================================
// 4. GET /api/services/health
// ==========================================================================

describe("GET /api/services/health", () => {
  it("returns health check array", async () => {
    fetchSpy.mockImplementation(() =>
      mockJsonResponse({ status: "healthy", version: "1.0.0" }),
    );

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/services/health/route");
    const res = await GET(authedRequest("http://localhost/api/services/health"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toMatchObject({ name: expect.any(String), status: "healthy" });
  });

  it("handles service timeout → unhealthy status, not crash", async () => {
    fetchSpy.mockRejectedValue(new Error("timeout"));

    const { GET } = await importRoute<{ GET: (r: Request) => Promise<Response> }>("@/app/api/services/health/route");
    const res = await GET(authedRequest("http://localhost/api/services/health"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data[0].status).toBe("unhealthy");
    expect(data[0].error).toBe("timeout");
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
    fetchSpy.mockReturnValue(mockJsonResponse([{ app_id: "my-app", status: "active" }]));
    const { POST } = await importRoute<{ POST: (r: Request) => Promise<Response> }>("@/app/api/miniapps/update-status/route");
    const res = await POST(postReq({ appId: "my-app", status: "active" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});
