import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests for the demo-data + supabase-backed admin config routes:
// contracts, oracle-secrets, pricefeeds, settings, simulations, users.
//
// The four demo-data routes (contracts, oracle-secrets, pricefeeds, settings)
// serve read-only sample payloads flagged with the `X-Mock-Data: true` header
// (which drives the demo-data banner in the UI) and answer every mutation
// with an explicit 501 instead of pretending to persist.

const API_KEY = "test-admin-key-config";

function authedRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: {
      "x-admin-key": API_KEY,
      ...(init?.headers as Record<string, string>),
    },
  });
}

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
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// /api/contracts
// ---------------------------------------------------------------------------
describe("/api/contracts", () => {
  it("GET without auth → 401", async () => {
    const { GET } = await import("@/app/api/contracts/route");
    const res = await GET(new Request("http://t/api/contracts"));
    expect(res.status).toBe(401);
  });

  it("GET with auth → 200 array flagged as demo data", async () => {
    const { GET } = await import("@/app/api/contracts/route");
    const res = await GET(authedRequest("http://t/api/contracts"));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Mock-Data")).toBe("true");
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("POST → 501 not implemented; nothing is upserted", async () => {
    const { POST, GET } = await import("@/app/api/contracts/route");
    const res = await POST(authedRequest("http://t/api/contracts", {
      method: "POST",
      body: JSON.stringify({ id: "TestContract", name: "TestContract", hash: "0xabc" }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(String(body.error)).toContain("not implemented");
    const after = await (await GET(authedRequest("http://t/api/contracts"))).json();
    expect(after.find((c: { id: string }) => c.id === "TestContract")).toBeUndefined();
  });

  it("DELETE → 501 not implemented; nothing is removed", async () => {
    const { DELETE, GET } = await import("@/app/api/contracts/route");
    const res = await DELETE(
      authedRequest("http://t/api/contracts?id=AppRegistry", { method: "DELETE" }),
    );
    expect(res.status).toBe(501);
    const after = await (await GET(authedRequest("http://t/api/contracts"))).json();
    expect(after.find((c: { id: string }) => c.id === "AppRegistry")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// /api/oracle-secrets
// ---------------------------------------------------------------------------
describe("/api/oracle-secrets", () => {
  it("GET without auth → 401", async () => {
    const { GET } = await import("@/app/api/oracle-secrets/route");
    const res = await GET(new Request("http://t/api/oracle-secrets"));
    expect(res.status).toBe(401);
  });

  it("GET with auth → 200 metadata array (no values) flagged as demo data", async () => {
    const { GET } = await import("@/app/api/oracle-secrets/route");
    const res = await GET(authedRequest("http://t/api/oracle-secrets"));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Mock-Data")).toBe("true");
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const s of body) {
      expect(s).not.toHaveProperty("value");
    }
  });

  it("POST → 501 not implemented; never pretends to store the secret", async () => {
    const { POST, GET } = await import("@/app/api/oracle-secrets/route");
    const res = await POST(authedRequest("http://t/api/oracle-secrets", {
      method: "POST",
      body: JSON.stringify({ name: "fresh_key", description: "test", value: "secret-value" }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(String(body.error)).toContain("not implemented");
    // Regression: the old mock accepted the secret, dropped the value, and
    // reported success — an operator believed a key rotation happened.
    const after = await (await GET(authedRequest("http://t/api/oracle-secrets"))).json();
    expect(after.find((s: { name: string }) => s.name === "fresh_key")).toBeUndefined();
    expect(JSON.stringify(after)).not.toContain("secret-value");
  });

  it("DELETE → 501 not implemented; nothing is removed", async () => {
    const { DELETE, GET } = await import("@/app/api/oracle-secrets/route");
    const res = await DELETE(
      authedRequest("http://t/api/oracle-secrets?id=1", { method: "DELETE" }),
    );
    expect(res.status).toBe(501);
    const after = await (await GET(authedRequest("http://t/api/oracle-secrets"))).json();
    expect(after.find((s: { id: string }) => s.id === "1")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// /api/pricefeeds
// ---------------------------------------------------------------------------
describe("/api/pricefeeds", () => {
  it("GET without auth → 401", async () => {
    const { GET } = await import("@/app/api/pricefeeds/route");
    const res = await GET(new Request("http://t/api/pricefeeds"));
    expect(res.status).toBe(401);
  });

  it("GET with auth → 200 array flagged as demo data", async () => {
    const { GET } = await import("@/app/api/pricefeeds/route");
    const res = await GET(authedRequest("http://t/api/pricefeeds"));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Mock-Data")).toBe("true");
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("POST → 501 not implemented; nothing is upserted", async () => {
    const { POST, GET } = await import("@/app/api/pricefeeds/route");
    const res = await POST(authedRequest("http://t/api/pricefeeds", {
      method: "POST",
      body: JSON.stringify({ id: "DOGE-USD", symbol: "DOGE", pair: "DOGE/USD", enabled: true, source: "okx" }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(501);
    const after = await (await GET(authedRequest("http://t/api/pricefeeds"))).json();
    expect(after.find((p: { id: string }) => p.id === "DOGE-USD")).toBeUndefined();
  });

  it("DELETE → 501 not implemented; nothing is removed", async () => {
    const { DELETE, GET } = await import("@/app/api/pricefeeds/route");
    const res = await DELETE(
      authedRequest("http://t/api/pricefeeds?id=BTC-USD", { method: "DELETE" }),
    );
    expect(res.status).toBe(501);
    const after = await (await GET(authedRequest("http://t/api/pricefeeds"))).json();
    expect(after.find((p: { id: string }) => p.id === "BTC-USD")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// /api/settings
// ---------------------------------------------------------------------------
describe("/api/settings", () => {
  it("GET without auth → 401", async () => {
    const { GET } = await import("@/app/api/settings/route");
    const res = await GET(new Request("http://t/api/settings"));
    expect(res.status).toBe(401);
  });

  it("GET with auth → 200 config object flagged as demo data", async () => {
    const { GET } = await import("@/app/api/settings/route");
    const res = await GET(authedRequest("http://t/api/settings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Mock-Data")).toBe("true");
    const body = await res.json();
    expect(body).toBeTypeOf("object");
  });

  it("POST → 501 not implemented; config is not mutated", async () => {
    const { POST, GET } = await import("@/app/api/settings/route");
    const res = await POST(authedRequest("http://t/api/settings", {
      method: "POST",
      body: JSON.stringify({ maintenanceMode: true }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(String(body.error)).toContain("not implemented");
    const after = await (await GET(authedRequest("http://t/api/settings"))).json();
    expect(after.maintenanceMode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// /api/simulations
// ---------------------------------------------------------------------------
describe("/api/simulations", () => {
  it("GET without auth → 401", async () => {
    const { GET } = await import("@/app/api/simulations/route");
    const res = await GET(new Request("http://t/api/simulations"));
    expect(res.status).toBe(401);
  });

  it("GET with auth + configured edge URL → 200 status object", async () => {
    vi.stubEnv("NEXT_PUBLIC_EDGE_URL", "http://edge.test");
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ running: false }), { status: 200 }),
    );
    const { GET } = await import("@/app/api/simulations/route");
    const res = await GET(authedRequest("http://t/api/simulations"));
    expect(res.status).toBe(200);
    const firstCall = fetchSpy.mock.calls[0]?.[0] as string;
    expect(firstCall).toContain("http://edge.test/admin-simulations");
  });

  it("GET without NEXT_PUBLIC_EDGE_URL → 503 configuration error, no fetch", async () => {
    // Regression: the route used to fall back to a stale k8s cluster-local
    // URL, hang on the fetch timeout, and send the service-role key to it.
    const { GET } = await import("@/app/api/simulations/route");
    const res = await GET(authedRequest("http://t/api/simulations"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(String(body.error)).toContain("NEXT_PUBLIC_EDGE_URL is not configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST without NEXT_PUBLIC_EDGE_URL → 503 configuration error, no fetch", async () => {
    const { POST } = await import("@/app/api/simulations/route");
    const res = await POST(authedRequest("http://t/api/simulations", {
      method: "POST",
      body: JSON.stringify({ action: "start", config: {} }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(String(body.error)).toContain("NEXT_PUBLIC_EDGE_URL is not configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// /api/users
// ---------------------------------------------------------------------------
describe("/api/users", () => {
  it("GET without auth → 401", async () => {
    const { GET } = await import("@/app/api/users/route");
    const res = await GET(new Request("http://t/api/users"));
    expect(res.status).toBe(401);
  });

  it("GET with malformed user id → 400", async () => {
    const { GET } = await import("@/app/api/users/route");
    const res = await GET(authedRequest("http://t/api/users?id=not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("GET with auth + valid UUID forwards to Supabase", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const uuid = "11111111-2222-3333-4444-555555555555";
    const { GET } = await import("@/app/api/users/route");
    const res = await GET(authedRequest(`http://t/api/users?id=${uuid}`));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalled();
    const firstCall = fetchSpy.mock.calls[0]?.[0] as string;
    expect(firstCall).toContain("supabase.test");
    expect(firstCall).toContain(`id=eq.${uuid}`);
  });
});
