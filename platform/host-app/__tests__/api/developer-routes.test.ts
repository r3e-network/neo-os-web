/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

// ---------------------------------------------------------------------------
// Supabase thenable chain mock
// ---------------------------------------------------------------------------

const mockFromChain: Record<string, jest.Mock> = {};
const mockFrom = jest.fn(() => mockFromChain);
const mockRpc = jest.fn().mockResolvedValue({ error: null });
let mockResult: { data: unknown; error: unknown; count?: number } = {
  data: null,
  error: null,
};

function resetChain() {
  const methods = ["select", "insert", "update", "delete", "upsert", "eq", "single", "order", "limit", "range"];
  for (const m of methods) {
    mockFromChain[m] = jest.fn(() => mockFromChain);
  }
  (mockFromChain as any).then = (resolve: (v: unknown) => void) => resolve(mockResult);
}
resetChain();

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom, rpc: mockRpc },
  isSupabaseConfigured: true,
}));

jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: jest.fn(() => ({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  })),
}));

jest.mock("@/lib/security/ratelimit", () => ({
  apiRateLimiter: { check: () => ({ allowed: true, remaining: 99 }), windowSec: 60 },
  writeRateLimiter: { check: () => ({ allowed: true, remaining: 99 }), windowSec: 60 },
  authRateLimiter: { check: () => ({ allowed: true, remaining: 99 }), windowSec: 60 },
  withRateLimit: (_limiter: unknown, handler: (...args: unknown[]) => unknown) => handler,
}));

jest.mock("@/lib/admin-auth", () => ({
  requireAdmin: jest.fn(() => ({ ok: true })),
}));

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function mockCreateHandler(config: any) {
  return async (req: any, res: any) => {
    const { supabaseAdmin } = require("@/lib/supabase");
    if (!supabaseAdmin) return res.status(503).json({ error: "Database not configured" });

    if (config.auth === "wallet") {
      const { requireWalletAuth } = require("@/lib/security/wallet-auth");
      const auth = requireWalletAuth(req.headers);
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
      (req as any).__ctx = { db: supabaseAdmin, address: auth.address };
    }

    const method = req.method as string;
    const methodConfig = config.methods?.[method];
    if (!methodConfig) return res.status(405).json({ error: "Method not allowed" });

    const handlerFn = typeof methodConfig === "function" ? methodConfig : methodConfig.handler;
    const schema = typeof methodConfig === "object" ? methodConfig.schema : undefined;
    const ctx = (req as any).__ctx || {
      db: supabaseAdmin,
      address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
    };

    // Zod validation (mirrors real createHandler)
    if (schema && typeof schema.safeParse === "function") {
      const input = WRITE_METHODS.has(method) ? req.body : (req as any).query;
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      ctx.parsedInput = parsed.data;
    }

    return handlerFn(req, res, ctx);
  };
}

jest.mock("@/lib/api", () => ({ createHandler: mockCreateHandler }));
jest.mock("@/lib/api/create-handler", () => ({ createHandler: mockCreateHandler }));

jest.mock("@/lib/contracts", () => ({
  normalizeContracts: jest.fn((v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return v;
  }),
}));

jest.mock("@/lib/schemas", () => {
  const { z } = require("zod");
  return {
    createAppBody: {
      parse: (v: unknown) => v,
      safeParse: (v: unknown) => ({ success: true, data: v }),
    },
    createVersionBody: z.object({
      version: z.string().min(1, "Version is required"),
      entry_url: z.string().min(1, "Entry URL is required"),
      release_notes: z.string().optional(),
      supported_chains: z.array(z.string()).optional(),
      contracts: z.record(z.unknown()).optional(),
      build_url: z
        .string()
        .regex(/^https?:\/\//, "Build URL must be http(s)")
        .optional()
        .or(z.literal("")),
    }),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import appsHandler from "@/pages/api/developer/apps/index";
import appDetailHandler from "@/pages/api/developer/apps/[appId]/index";
import versionsHandler from "@/pages/api/developer/apps/[appId]/versions/index";
import publishHandler from "@/pages/api/developer/apps/[appId]/versions/[versionId]/publish";
import { requireWalletAuth } from "@/lib/security/wallet-auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

beforeEach(() => {
  resetChain();
  mockFrom.mockClear();
  mockRpc.mockClear();
  mockResult = { data: null, error: null };
  // Reset BOTH the original imported ref (used by raw handlers like publish)
  // AND the current require() instance (used by mockCreateHandler after resetModules)
  const defaultAuth = { ok: true, address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs" };
  (requireWalletAuth as jest.Mock).mockReturnValue(defaultAuth);
  try {
    const walletAuth = require("@/lib/security/wallet-auth");
    walletAuth.requireWalletAuth.mockReturnValue(defaultAuth);
  } catch {
    /* first run before resetModules — same instance, no-op */
  }
});

// ===========================================================================
// 1. developer/apps/index.ts  (createHandler factory route)
// ===========================================================================

describe("Developer Apps Index API (pages/api/developer/apps/index)", () => {
  it("returns 405 for unsupported method (DELETE)", async () => {
    const { req, res } = createMocks({ method: "DELETE" });
    await appsHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("GET returns app list on success", async () => {
    const apps = [
      { app_id: "app-1", name: "App One" },
      { app_id: "app-2", name: "App Two" },
    ];
    mockResult = { data: apps, error: null, count: 2 };

    const { req, res } = createMocks({ method: "GET" });
    await appsHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.apps).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it("POST returns 400 when missing required fields", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { name: "Test" },
    });
    await appsHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/missing required/i);
  });

  it("POST returns 201 on success", async () => {
    const created = {
      app_id: "dev-test-app-abc",
      name: "Test App",
      status: "draft",
    };
    mockResult = { data: created, error: null };

    const { req, res } = createMocks({
      method: "POST",
      body: {
        name: "Test App",
        name_zh: "测试应用",
        description: "A test app",
        description_zh: "一个测试应用",
        category: "tools",
      },
    });
    await appsHandler(req, res);

    expect(res._getStatusCode()).toBe(201);
    const body = JSON.parse(res._getData());
    expect(body.app).toBeDefined();
    expect(body.app.status).toBe("draft");
  });
});

// ===========================================================================
// 2. developer/apps/[appId]/index.ts  (direct handler)
// ===========================================================================

describe("Developer App Detail API (pages/api/developer/apps/[appId]/index)", () => {
  it("returns 405 for unsupported method (PATCH)", async () => {
    const { req, res } = createMocks({
      method: "PATCH",
      query: { appId: "test-app" },
    });
    await appDetailHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 401 when auth fails", async () => {
    const walletAuth = require("@/lib/security/wallet-auth");
    walletAuth.requireWalletAuth.mockReturnValue({
      ok: false,
      status: 401,
      error: "Missing wallet authentication headers",
    });

    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "test-app" },
    });
    await appDetailHandler(req, res);

    expect(res._getStatusCode()).toBe(401);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/wallet/i);
  });

  it("returns 400 when appId is missing", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await appDetailHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/app id/i);
  });

  it("GET returns 404 when app not found", async () => {
    mockResult = { data: null, error: null };

    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "nonexistent" },
    });
    await appDetailHandler(req, res);

    expect(res._getStatusCode()).toBe(404);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/not found/i);
  });

  it("GET returns 200 with app data", async () => {
    const appData = { app_id: "test-app", name: "Test App", status: "draft" };
    mockResult = { data: appData, error: null };

    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "test-app" },
    });
    await appDetailHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.app).toEqual(appData);
  });

  it("PUT returns 200 on success", async () => {
    const updated = { app_id: "test-app", name: "Updated", status: "draft" };
    mockResult = { data: updated, error: null };

    const { req, res } = createMocks({
      method: "PUT",
      query: { appId: "test-app" },
      body: { name: "Updated" },
    });
    await appDetailHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.app.name).toBe("Updated");
  });

  it("DELETE returns 200 on success", async () => {
    mockResult = { data: null, error: null };

    const { req, res } = createMocks({
      method: "DELETE",
      query: { appId: "test-app" },
    });
    await appDetailHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
  });

  it("returns 500 on DB error", async () => {
    mockResult = { data: null, error: { message: "DB failure" } };

    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "test-app" },
    });
    await appDetailHandler(req, res);

    expect(res._getStatusCode()).toBe(404);
  });
});

// ===========================================================================
// 3. developer/apps/[appId]/versions/index.ts
// ===========================================================================

describe("Developer Versions API (pages/api/developer/apps/[appId]/versions/index)", () => {
  it("returns 503 when DB not configured", async () => {
    jest.resetModules();

    jest.doMock("@/lib/supabase", () => ({
      supabaseAdmin: null,
      isSupabaseConfigured: false,
    }));

    const mod = await import("@/pages/api/developer/apps/[appId]/versions/index");
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "test-app" },
    });
    await mod.default(req, res);
    expect(res._getStatusCode()).toBe(503);

    // Restore original mock
    jest.resetModules();
    jest.doMock("@/lib/supabase", () => ({
      supabaseAdmin: { from: mockFrom, rpc: mockRpc },
      isSupabaseConfigured: true,
    }));
  });

  it("returns 401 when auth fails", async () => {
    // Use require() to get the current mock instance (may be fresh after resetModules)
    const walletAuth = require("@/lib/security/wallet-auth");
    walletAuth.requireWalletAuth.mockReturnValue({
      ok: false,
      status: 401,
      error: "Missing wallet authentication headers",
    });

    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "test-app" },
    });
    await versionsHandler(req, res);

    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 400 when appId is missing", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await versionsHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/app id/i);
  });

  it("returns 404 when app not found (ownership check)", async () => {
    mockResult = { data: null, error: null };

    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "nonexistent" },
    });
    await versionsHandler(req, res);

    expect(res._getStatusCode()).toBe(404);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/not found/i);
  });

  it("GET returns versions list", async () => {
    const versions = [
      { id: "v1", version: "1.0.0", version_code: 1 },
      { id: "v2", version: "1.1.0", version_code: 2 },
    ];
    mockResult = { data: versions, error: null };

    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "test-app" },
    });
    await versionsHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.versions).toHaveLength(2);
  });

  it("POST returns 400 when version/entry_url missing", async () => {
    // First call resolves ownership check
    mockResult = { data: { app_id: "test-app" }, error: null };

    const { req, res } = createMocks({
      method: "POST",
      query: { appId: "test-app" },
      body: { version: "1.0.0" },
    });
    await versionsHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Validation failed");
    expect(body.details.entry_url).toBeDefined();
  });

  it("POST returns 400 for invalid build_url (not http)", async () => {
    mockResult = { data: { app_id: "test-app" }, error: null };

    const { req, res } = createMocks({
      method: "POST",
      query: { appId: "test-app" },
      body: {
        version: "1.0.0",
        entry_url: "/index.html",
        build_url: "ftp://bad-url.com/build.zip",
      },
    });
    await versionsHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Validation failed");
    expect(body.details.build_url).toBeDefined();
  });

  it("POST returns 201 on success", async () => {
    mockResult = {
      data: { id: "v1", app_id: "test-app", version_code: 1 },
      error: null,
    };

    const { req, res } = createMocks({
      method: "POST",
      query: { appId: "test-app" },
      body: {
        version: "1.0.0",
        entry_url: "/index.html",
        release_notes: "Initial release",
      },
    });
    await versionsHandler(req, res);

    expect(res._getStatusCode()).toBe(201);
    const body = JSON.parse(res._getData());
    expect(body.version).toBeDefined();
    expect(body.version.app_id).toBe("test-app");
  });
});

// ===========================================================================
// 4. developer/apps/[appId]/versions/[versionId]/publish.ts
// ===========================================================================

describe("Publish Version API (pages/api/developer/apps/[appId]/versions/[versionId]/publish)", () => {
  it("returns 405 for non-POST", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "test-app", versionId: "v1" },
    });
    await publishHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 500 when DB not configured", async () => {
    jest.resetModules();

    jest.doMock("@/lib/supabase", () => ({
      supabaseAdmin: null,
      isSupabaseConfigured: false,
    }));

    const mod = await import("@/pages/api/developer/apps/[appId]/versions/[versionId]/publish");
    const { req, res } = createMocks({
      method: "POST",
      query: { appId: "test-app", versionId: "v1" },
    });
    await mod.default(req, res);
    expect(res._getStatusCode()).toBe(500);

    jest.resetModules();
    jest.doMock("@/lib/supabase", () => ({
      supabaseAdmin: { from: mockFrom, rpc: mockRpc },
      isSupabaseConfigured: true,
    }));
  });

  it("returns 401 when auth fails", async () => {
    (requireWalletAuth as jest.Mock).mockReturnValue({
      ok: false,
      status: 401,
      error: "Missing wallet authentication headers",
    });

    const { req, res } = createMocks({
      method: "POST",
      query: { appId: "test-app", versionId: "v1" },
    });
    await publishHandler(req, res);

    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 404 when app not found", async () => {
    mockResult = { data: null, error: null };

    const { req, res } = createMocks({
      method: "POST",
      query: { appId: "nonexistent", versionId: "v1" },
    });
    await publishHandler(req, res);

    expect(res._getStatusCode()).toBe(404);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 200 on success", async () => {
    const versionData = {
      id: "v1",
      app_id: "test-app",
      status: "pending_review",
      supported_chains: ["neo3"],
      contracts: { neo3: { address: "0xabc" } },
    };
    mockResult = { data: versionData, error: null };

    const { req, res } = createMocks({
      method: "POST",
      query: { appId: "test-app", versionId: "v1" },
    });
    await publishHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.version).toBeDefined();
    expect(body.message).toMatch(/review/i);
  });
});
