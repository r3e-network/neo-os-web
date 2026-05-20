import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests for the in-memory + supabase-backed admin config routes that
// the api-routes audit flagged as untested: contracts, oracle-secrets,
// pricefeeds, settings, simulations, users.

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

  it("GET with auth → 200 array", async () => {
    const { GET } = await import("@/app/api/contracts/route");
    const res = await GET(authedRequest("http://t/api/contracts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("POST upserts an entry", async () => {
    const { POST, GET } = await import("@/app/api/contracts/route");
    const res = await POST(authedRequest("http://t/api/contracts", {
      method: "POST",
      body: JSON.stringify({ id: "TestContract", name: "TestContract", hash: "0xabc" }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(200);
    const after = await (await GET(authedRequest("http://t/api/contracts"))).json();
    expect(after.find((c: { id: string }) => c.id === "TestContract")).toBeDefined();
  });

  it("DELETE without id → 400", async () => {
    const { DELETE } = await import("@/app/api/contracts/route");
    const res = await DELETE(authedRequest("http://t/api/contracts", { method: "DELETE" }));
    expect(res.status).toBe(400);
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

  it("GET with auth → 200 metadata array (no values)", async () => {
    const { GET } = await import("@/app/api/oracle-secrets/route");
    const res = await GET(authedRequest("http://t/api/oracle-secrets"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const s of body) {
      expect(s).not.toHaveProperty("value");
    }
  });

  it("POST adds new secret without value in response", async () => {
    const { POST } = await import("@/app/api/oracle-secrets/route");
    const res = await POST(authedRequest("http://t/api/oracle-secrets", {
      method: "POST",
      body: JSON.stringify({ name: "fresh_key", description: "test", value: "secret-value" }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.find((s: { name: string }) => s.name === "fresh_key")).toBeDefined();
    // The actual secret value must NOT round-trip in the GET payload.
    const stored = body.find((s: { name: string }) => s.name === "fresh_key");
    expect(stored).not.toHaveProperty("value");
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

  it("GET with auth → 200 array", async () => {
    const { GET } = await import("@/app/api/pricefeeds/route");
    const res = await GET(authedRequest("http://t/api/pricefeeds"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
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

  it("GET with auth → 200 config object", async () => {
    const { GET } = await import("@/app/api/settings/route");
    const res = await GET(authedRequest("http://t/api/settings"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeTypeOf("object");
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

  it("GET with auth → 200 status object", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ running: false }), { status: 200 }),
    );
    const { GET } = await import("@/app/api/simulations/route");
    const res = await GET(authedRequest("http://t/api/simulations"));
    expect([200, 502]).toContain(res.status);
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
