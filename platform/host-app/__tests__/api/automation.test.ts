/** @jest-environment node */
import { createMocks } from "node-mocks-http";
import type { WalletAuthResult } from "@/lib/security/wallet-auth";

// ---------------------------------------------------------------------------
// Supabase thenable chain mock
// ---------------------------------------------------------------------------

const mockFromChain: Record<string, jest.Mock> = {};
const mockFrom = jest.fn(() => mockFromChain);
let mockResult: { data: unknown; error: unknown } = { data: null, error: null };

function resetChain() {
  const methods = ["select", "insert", "update", "delete", "upsert", "eq", "in", "single", "order", "limit", "range"];
  for (const m of methods) {
    mockFromChain[m] = jest.fn(() => mockFromChain);
  }
  (mockFromChain as any).then = (resolve: (v: unknown) => void) => resolve(mockResult);
}
resetChain();

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockSupabase = {
  supabaseAdmin: { from: mockFrom } as any,
  isSupabaseConfigured: true,
};

jest.mock("@/lib/supabase", () => mockSupabase);

const mockRequireWalletAuth = jest.fn<WalletAuthResult, [Record<string, string | string[] | undefined>]>(
  (_headers) => ({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  }),
);

jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: (headers: Record<string, string | string[] | undefined>) => mockRequireWalletAuth(headers),
}));

jest.mock("@/lib/security/ratelimit", () => ({
  writeRateLimiter: {},
  withRateLimit: (_limiter: unknown, handler: (...args: unknown[]) => unknown) => handler,
}));

// ---------------------------------------------------------------------------
// Handler imports (must come after jest.mock calls)
// ---------------------------------------------------------------------------

import enableHandler from "@/pages/api/automation/enable";
import disableHandler from "@/pages/api/automation/disable";
import registerHandler from "@/pages/api/automation/register";
import unregisterHandler from "@/pages/api/automation/unregister";
import listHandler from "@/pages/api/automation/list";
import statusHandler from "@/pages/api/automation/status";
import logsHandler from "@/pages/api/automation/logs";
import updateHandler from "@/pages/api/automation/update";

// ---------------------------------------------------------------------------
// Global setup
// ---------------------------------------------------------------------------

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

beforeEach(() => {
  jest.clearAllMocks();
  resetChain();
  mockResult = { data: null, error: null };
  mockSupabase.supabaseAdmin = { from: mockFrom };
  mockSupabase.isSupabaseConfigured = true;
  mockRequireWalletAuth.mockReturnValue({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  });
});

// ===========================================================================
// POST /api/automation/enable
// ===========================================================================

describe("POST /api/automation/enable", () => {
  it("returns 405 for non-POST methods", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await enableHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 503 when DB not configured", async () => {
    mockSupabase.supabaseAdmin = null as any;
    const { req, res } = createMocks({ method: "POST", body: { taskId: "t1" } });
    await enableHandler(req, res);
    expect(res._getStatusCode()).toBe(503);
  });

  it("returns 401 when auth fails", async () => {
    mockRequireWalletAuth.mockReturnValue({ ok: false, status: 401, error: "Unauthorized" });
    const { req, res } = createMocks({ method: "POST", body: { taskId: "t1" } });
    await enableHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 400 when taskId is missing", async () => {
    const { req, res } = createMocks({ method: "POST", body: {} });
    await enableHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 403 when task is not owned by the wallet", async () => {
    mockResult = { data: null, error: null };
    const { req, res } = createMocks({ method: "POST", body: { taskId: "t1" } });
    await enableHandler(req, res);
    expect(res._getStatusCode()).toBe(403);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Task not found or access denied");
  });

  it("returns 200 on success with status active", async () => {
    mockResult = { data: { id: "t1" }, error: null };
    const { req, res } = createMocks({ method: "POST", body: { taskId: "t1" } });
    await enableHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
    expect(body.status).toBe("active");
  });

  it("returns 500 on DB error", async () => {
    mockResult = { data: { id: "t1" }, error: new Error("DB failure") };
    const { req, res } = createMocks({ method: "POST", body: { taskId: "t1" } });
    await enableHandler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});

// ===========================================================================
// POST /api/automation/disable
// ===========================================================================

describe("POST /api/automation/disable", () => {
  it("returns 405 for non-POST methods", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await disableHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 503 when DB not configured", async () => {
    mockSupabase.supabaseAdmin = null as any;
    const { req, res } = createMocks({ method: "POST", body: { taskId: "t1" } });
    await disableHandler(req, res);
    expect(res._getStatusCode()).toBe(503);
  });

  it("returns 401 when auth fails", async () => {
    mockRequireWalletAuth.mockReturnValue({ ok: false, status: 401, error: "Unauthorized" });
    const { req, res } = createMocks({ method: "POST", body: { taskId: "t1" } });
    await disableHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 400 when taskId is missing", async () => {
    const { req, res } = createMocks({ method: "POST", body: {} });
    await disableHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 403 when task is not owned by the wallet", async () => {
    mockResult = { data: null, error: null };
    const { req, res } = createMocks({ method: "POST", body: { taskId: "t1" } });
    await disableHandler(req, res);
    expect(res._getStatusCode()).toBe(403);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Task not found or access denied");
  });

  it("returns 200 on success with status paused", async () => {
    mockResult = { data: { id: "t1" }, error: null };
    const { req, res } = createMocks({ method: "POST", body: { taskId: "t1" } });
    await disableHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
    expect(body.status).toBe("paused");
  });

  it("returns 500 on DB error", async () => {
    mockResult = { data: { id: "t1" }, error: new Error("DB failure") };
    const { req, res } = createMocks({ method: "POST", body: { taskId: "t1" } });
    await disableHandler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});

// ===========================================================================
// POST /api/automation/register
// ===========================================================================

describe("POST /api/automation/register", () => {
  const validBody = { appId: "app1", taskName: "sync", taskType: "webhook" };

  it("returns 405 for non-POST methods", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await registerHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 503 when DB not configured", async () => {
    mockSupabase.supabaseAdmin = null as any;
    const { req, res } = createMocks({ method: "POST", body: validBody });
    await registerHandler(req, res);
    expect(res._getStatusCode()).toBe(503);
  });

  it("returns 401 when auth fails", async () => {
    mockRequireWalletAuth.mockReturnValue({ ok: false, status: 401, error: "Unauthorized" });
    const { req, res } = createMocks({ method: "POST", body: validBody });
    await registerHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const { req, res } = createMocks({ method: "POST", body: { appId: "app1" } });
    await registerHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(false);
  });

  it("returns 200 on success", async () => {
    mockResult = { data: { id: "t1", app_id: "app1", task_name: "sync" }, error: null };
    const { req, res } = createMocks({ method: "POST", body: validBody });
    await registerHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
    expect(body.taskId).toBe("t1");
  });

  it("returns 200 with schedule when schedule is provided", async () => {
    mockResult = { data: { id: "t1", app_id: "app1", task_name: "sync" }, error: null };
    const { req, res } = createMocks({
      method: "POST",
      body: { ...validBody, schedule: { intervalSeconds: 300 } },
    });
    await registerHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    // Verify the second from() call targeted automation_schedules
    expect(mockFrom).toHaveBeenCalledWith("automation_schedules");
  });

  it("returns 500 on DB error", async () => {
    mockResult = { data: null, error: new Error("DB failure") };
    const { req, res } = createMocks({ method: "POST", body: validBody });
    await registerHandler(req, res);
    expect(res._getStatusCode()).toBe(500);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(false);
  });
});

// ===========================================================================
// POST /api/automation/unregister
// ===========================================================================

describe("POST /api/automation/unregister", () => {
  const validBody = { appId: "app1", taskName: "sync" };

  it("returns 405 for non-POST methods", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await unregisterHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 503 when DB not configured", async () => {
    mockSupabase.supabaseAdmin = null as any;
    const { req, res } = createMocks({ method: "POST", body: validBody });
    await unregisterHandler(req, res);
    expect(res._getStatusCode()).toBe(503);
  });

  it("returns 401 when auth fails", async () => {
    mockRequireWalletAuth.mockReturnValue({ ok: false, status: 401, error: "Unauthorized" });
    const { req, res } = createMocks({ method: "POST", body: validBody });
    await unregisterHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const { req, res } = createMocks({ method: "POST", body: { appId: "app1" } });
    await unregisterHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(false);
  });

  it("returns 200 on success", async () => {
    mockResult = { data: null, error: null };
    const { req, res } = createMocks({ method: "POST", body: validBody });
    await unregisterHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
  });

  it("returns 500 on DB error", async () => {
    mockResult = { data: null, error: new Error("DB failure") };
    const { req, res } = createMocks({ method: "POST", body: validBody });
    await unregisterHandler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});

// ===========================================================================
// GET /api/automation/list
// ===========================================================================

describe("GET /api/automation/list", () => {
  it("returns 405 for non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await listHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 503 when DB not configured", async () => {
    mockSupabase.supabaseAdmin = null as any;
    const { req, res } = createMocks({ method: "GET" });
    await listHandler(req, res);
    expect(res._getStatusCode()).toBe(503);
  });

  it("returns 401 when auth fails", async () => {
    mockRequireWalletAuth.mockReturnValue({ ok: false, status: 401, error: "Unauthorized" });
    const { req, res } = createMocks({ method: "GET" });
    await listHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 200 with tasks array", async () => {
    const tasks = [{ id: "t1", app_id: "app1", task_name: "sync" }];
    mockResult = { data: tasks, error: null };
    const { req, res } = createMocks({ method: "GET" });
    await listHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.tasks).toEqual(tasks);
  });

  it("scopes query to authenticated wallet address", async () => {
    mockResult = { data: [], error: null };
    const { req, res } = createMocks({ method: "GET" });
    await listHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockFromChain.eq).toHaveBeenCalledWith("wallet_address", "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs");
  });

  it("applies appId filter when provided", async () => {
    mockResult = { data: [], error: null };
    const { req, res } = createMocks({ method: "GET", query: { appId: "app1" } });
    await listHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockFromChain.eq).toHaveBeenCalledWith("app_id", "app1");
  });

  it("returns 500 on DB error", async () => {
    mockResult = { data: null, error: new Error("DB failure") };
    const { req, res } = createMocks({ method: "GET" });
    await listHandler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});

// ===========================================================================
// GET /api/automation/status
// ===========================================================================

describe("GET /api/automation/status", () => {
  it("returns 405 for non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await statusHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 503 when DB not configured", async () => {
    mockSupabase.supabaseAdmin = null as any;
    const { req, res } = createMocks({ method: "GET", query: { appId: "app1", taskName: "sync" } });
    await statusHandler(req, res);
    expect(res._getStatusCode()).toBe(503);
  });

  it("returns 401 when auth fails", async () => {
    mockRequireWalletAuth.mockReturnValue({ ok: false, status: 401, error: "Unauthorized" });
    const { req, res } = createMocks({ method: "GET", query: { appId: "app1", taskName: "sync" } });
    await statusHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 400 when appId or taskName is missing", async () => {
    const { req, res } = createMocks({ method: "GET", query: { appId: "app1" } });
    await statusHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 404 when task is not found", async () => {
    mockResult = { data: null, error: null };
    const { req, res } = createMocks({ method: "GET", query: { appId: "app1", taskName: "sync" } });
    await statusHandler(req, res);
    expect(res._getStatusCode()).toBe(404);
  });

  it("returns 200 with task, schedule, and logs on success", async () => {
    const taskData = { id: "t1", app_id: "app1", task_name: "sync" };
    mockResult = { data: taskData, error: null };
    const { req, res } = createMocks({ method: "GET", query: { appId: "app1", taskName: "sync" } });
    await statusHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.task).toEqual(taskData);
    // schedule and recentLogs resolve from the same mockResult shape
    expect(body.schedule).toBeDefined();
    expect(body.recentLogs).toBeDefined();
  });
});

// ===========================================================================
// GET /api/automation/logs
// ===========================================================================

describe("GET /api/automation/logs", () => {
  it("returns 405 for non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await logsHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 503 when DB not configured", async () => {
    mockSupabase.supabaseAdmin = null as any;
    const { req, res } = createMocks({ method: "GET" });
    await logsHandler(req, res);
    expect(res._getStatusCode()).toBe(503);
  });

  it("returns 401 when auth fails", async () => {
    mockRequireWalletAuth.mockReturnValue({ ok: false, status: 401, error: "Unauthorized" });
    const { req, res } = createMocks({ method: "GET" });
    await logsHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 200 with logs array", async () => {
    const logs = [{ id: "l1", task_id: "t1", executed_at: "2026-01-01" }];
    // First from() call returns owned tasks, second returns logs - both resolve from mockResult
    mockResult = { data: logs, error: null };
    const { req, res } = createMocks({ method: "GET" });
    await logsHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.logs).toEqual(logs);
  });

  it("applies taskId filter when provided", async () => {
    const ownedTasks = [{ id: "t1" }];
    mockResult = { data: ownedTasks, error: null };
    const { req, res } = createMocks({ method: "GET", query: { taskId: "t1" } });
    await logsHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockFromChain.eq).toHaveBeenCalledWith("task_id", "t1");
  });

  it("applies appId filter when provided", async () => {
    const ownedTasks = [{ id: "t1" }];
    mockResult = { data: ownedTasks, error: null };
    const { req, res } = createMocks({ method: "GET", query: { appId: "app1" } });
    await logsHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockFromChain.eq).toHaveBeenCalledWith("app_id", "app1");
  });

  it("returns 403 when taskId is not owned by the wallet", async () => {
    mockResult = { data: null, error: null };
    const { req, res } = createMocks({ method: "GET", query: { taskId: "t1" } });
    await logsHandler(req, res);
    expect(res._getStatusCode()).toBe(403);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Task not found or access denied");
  });

  it("returns empty logs when wallet owns no tasks", async () => {
    mockResult = { data: [], error: null };
    const { req, res } = createMocks({ method: "GET" });
    await logsHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.logs).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    // data must be non-empty so the owned-tasks query passes; error triggers throw on the logs query
    mockResult = { data: [{ id: "t1" }], error: new Error("DB failure") };
    const { req, res } = createMocks({ method: "GET" });
    await logsHandler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});

// ===========================================================================
// PUT /api/automation/update
// ===========================================================================

describe("PUT /api/automation/update", () => {
  it("returns 405 for non-PUT methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await updateHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 503 when DB not configured", async () => {
    mockSupabase.supabaseAdmin = null as any;
    const { req, res } = createMocks({ method: "PUT", body: { taskId: "t1" } });
    await updateHandler(req, res);
    expect(res._getStatusCode()).toBe(503);
  });

  it("returns 401 when auth fails", async () => {
    mockRequireWalletAuth.mockReturnValue({ ok: false, status: 401, error: "Unauthorized" });
    const { req, res } = createMocks({ method: "PUT", body: { taskId: "t1" } });
    await updateHandler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("returns 400 when taskId is missing", async () => {
    const { req, res } = createMocks({ method: "PUT", body: {} });
    await updateHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 403 when task is not owned by the wallet", async () => {
    mockResult = { data: null, error: null };
    const { req, res } = createMocks({
      method: "PUT",
      body: { taskId: "t1", payload: { url: "https://example.com" } },
    });
    await updateHandler(req, res);
    expect(res._getStatusCode()).toBe(403);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Task not found or access denied");
  });

  it("returns 200 on success with payload update", async () => {
    mockResult = { data: { id: "t1" }, error: null };
    const { req, res } = createMocks({
      method: "PUT",
      body: { taskId: "t1", payload: { url: "https://example.com" } },
    });
    await updateHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
  });

  it("updates schedule when schedule is provided", async () => {
    mockResult = { data: { id: "t1" }, error: null };
    const { req, res } = createMocks({
      method: "PUT",
      body: { taskId: "t1", schedule: { intervalSeconds: 600 } },
    });
    await updateHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith("automation_schedules");
  });

  it("returns 500 on DB error", async () => {
    mockResult = { data: { id: "t1" }, error: new Error("DB failure") };
    const { req, res } = createMocks({
      method: "PUT",
      body: { taskId: "t1", payload: {} },
    });
    await updateHandler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});
