import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const API_KEY = "test-admin-key-123";

// admin-auth captures the key and limits at module evaluation time and keeps
// the rate-limit window in module state, so each test gets a fresh import.
async function loadAuth() {
  return (await import("@/lib/admin-auth")) as {
    requireAdminAuth: (req: Request) => Response | null;
  };
}

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/miniapps", { headers });
}

beforeEach(() => {
  vi.stubEnv("ADMIN_CONSOLE_API_KEY", API_KEY);
  vi.stubEnv("ADMIN_AUTH_MAX_REQUESTS", "3");
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAdminAuth", () => {
  it("accepts a valid key and rejects a missing/invalid key", async () => {
    const { requireAdminAuth } = await loadAuth();

    expect(requireAdminAuth(request({ "x-admin-key": API_KEY }))).toBeNull();
    expect(requireAdminAuth(request())?.status).toBe(401);
    expect(requireAdminAuth(request({ "x-admin-key": "wrong" }))?.status).toBe(401);
  });

  it("keys the limiter on the LAST x-forwarded-for hop so client-prepended hops cannot rotate identity", async () => {
    const { requireAdminAuth } = await loadAuth();

    // A brute-forcer rotates the (client-controlled) FIRST hop on every
    // attempt; the trusted proxy-appended LAST hop stays the same.
    for (let i = 0; i < 3; i++) {
      const res = requireAdminAuth(
        request({
          "x-admin-key": "wrong",
          "x-forwarded-for": `10.0.0.${i}, 203.0.113.7`,
        }),
      );
      expect(res?.status).toBe(401);
    }

    const blocked = requireAdminAuth(
      request({
        "x-admin-key": "wrong",
        "x-forwarded-for": "10.99.99.99, 203.0.113.7",
      }),
    );
    expect(blocked?.status).toBe(429);
  });

  it("never rate-limits successfully authenticated requests", async () => {
    const { requireAdminAuth } = await loadAuth();

    // Far more requests than ADMIN_AUTH_MAX_REQUESTS — the operator's normal
    // console traffic must not lock them out.
    for (let i = 0; i < 20; i++) {
      const res = requireAdminAuth(
        request({ "x-admin-key": API_KEY, "x-forwarded-for": "203.0.113.7" }),
      );
      expect(res).toBeNull();
    }
  });

  it("locks out only the failing client IP, not other clients", async () => {
    const { requireAdminAuth } = await loadAuth();

    for (let i = 0; i < 3; i++) {
      expect(
        requireAdminAuth(
          request({ "x-admin-key": "wrong", "x-forwarded-for": "198.51.100.5" }),
        )?.status,
      ).toBe(401);
    }
    expect(
      requireAdminAuth(
        request({ "x-admin-key": "wrong", "x-forwarded-for": "198.51.100.5" }),
      )?.status,
    ).toBe(429);

    // A different trusted hop is unaffected by the attacker's failures — and a
    // spoofed FIRST hop cannot impersonate (and lock out) the operator's IP.
    expect(
      requireAdminAuth(
        request({
          "x-admin-key": API_KEY,
          "x-forwarded-for": "198.51.100.5, 203.0.113.7",
        }),
      ),
    ).toBeNull();
  });

  it("fails closed with 500 when no admin key is configured", async () => {
    vi.stubEnv("ADMIN_CONSOLE_API_KEY", "");
    vi.stubEnv("ADMIN_API_KEY", "");
    vi.resetModules();
    const { requireAdminAuth } = await loadAuth();

    expect(requireAdminAuth(request({ "x-admin-key": API_KEY }))?.status).toBe(500);
  });
});
