/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

// ---------------------------------------------------------------------------
// Thenable Supabase chain mock
// ---------------------------------------------------------------------------
const mockFromChain: Record<string, jest.Mock> = {};
const mockFrom = jest.fn(() => mockFromChain);
let mockResult: { data: unknown; error: unknown; count?: number } = {
  data: null,
  error: null,
};

function resetChain() {
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "single",
    "order",
    "limit",
    "range",
    "not",
    "in",
  ];
  for (const m of methods) {
    mockFromChain[m] = jest.fn(() => mockFromChain);
  }
  (mockFromChain as any).then = (resolve: (v: unknown) => void) => resolve(mockResult);
}
resetChain();

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom, rpc: jest.fn().mockResolvedValue({ error: null }) },
  isSupabaseConfigured: true,
}));

// createHandler passthrough: extracts POST handler, injects ctx.db from mock
jest.mock("@/lib/api", () => ({
  createHandler: (config: { methods: Record<string, unknown> }) => {
    const postEntry = config.methods.POST;
    const handler = typeof postEntry === "function" ? postEntry : (postEntry as { handler: Function }).handler;
    return async (req: unknown, res: unknown) => {
      const supabaseMod = require("@/lib/supabase");
      if (!supabaseMod.supabaseAdmin) {
        return (res as any).status(503).json({ error: "Database not configured" });
      }
      const ctx = { db: supabaseMod.supabaseAdmin };
      return handler(req, res, ctx);
    };
  },
}));

// Mock automation executor
const mockGetReadyTasks = jest.fn();
const mockExecuteTask = jest.fn();
jest.mock("@/lib/automation/executor", () => ({
  getReadyTasks: mockGetReadyTasks,
  executeTask: mockExecuteTask,
}));

// Mock chain registry
const mockGetChain = jest.fn();
const mockGetActiveChains = jest.fn(() => [
  { id: "neo-n3-mainnet", status: "active" },
  { id: "neo-n3-testnet", status: "active" },
]);
jest.mock("@/lib/chains/registry", () => ({
  getChainRegistry: () => ({
    getChain: mockGetChain,
    getActiveChains: mockGetActiveChains,
  }),
}));

// Mock contract queries
jest.mock("@/lib/chains/contract-queries", () => ({
  getContractStats: jest.fn().mockResolvedValue({
    uniqueUsers: 100,
    totalTransactions: 500,
    totalValueLocked: "1000.00",
  }),
  getContractAddress: jest.fn((name: string, _chainId: string) => {
    if (name === "lottery") return "0xabc";
    return null;
  }),
}));

// ---------------------------------------------------------------------------
// Import handlers (createHandler is passthrough, so these are the raw handlers)
// ---------------------------------------------------------------------------
import automationExecutor from "@/pages/api/cron/automation-executor";
import collectMiniappStats from "@/pages/api/cron/collect-miniapp-stats";
import initStats from "@/pages/api/cron/init-stats";
import growStats from "@/pages/api/cron/grow-stats";
import rollupStats from "@/pages/api/cron/rollup-stats";
import syncPlatformStats from "@/pages/api/cron/sync-platform-stats";

// ---------------------------------------------------------------------------
// Suppress noisy console output during tests
// ---------------------------------------------------------------------------
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());

beforeEach(() => {
  jest.clearAllMocks();
  resetChain();
  mockResult = { data: null, error: null };
  mockGetChain.mockImplementation((id: string) => {
    if (id === "neo-n3-mainnet") return { id: "neo-n3-mainnet", status: "active" };
    if (id === "neo-n3-testnet") return { id: "neo-n3-testnet", status: "active" };
    return undefined;
  });
});

// ===========================================================================
// 1. automation-executor
// ===========================================================================
describe("POST /api/cron/automation-executor", () => {
  it("returns 200 with empty results when no tasks ready", async () => {
    mockGetReadyTasks.mockResolvedValue([]);
    const { req, res } = createMocks({ method: "GET" });
    await automationExecutor(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
    expect(body.executed).toBe(0);
    expect(body.results).toEqual([]);
  });

  it("returns 200 with executed results", async () => {
    const task = { id: "t1", name: "test-task" };
    const schedule = { id: "s1", cron: "* * * * *" };
    mockGetReadyTasks.mockResolvedValue([{ task, schedule }]);
    mockExecuteTask.mockResolvedValue({ taskId: "t1", success: true });

    const { req, res } = createMocks({ method: "GET" });
    await automationExecutor(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
    expect(body.executed).toBe(1);
    expect(body.results).toEqual([{ taskId: "t1", success: true }]);
    expect(mockExecuteTask).toHaveBeenCalledWith(task, schedule);
  });

  it("returns 500 when getReadyTasks throws", async () => {
    mockGetReadyTasks.mockRejectedValue(new Error("DB down"));
    const { req, res } = createMocks({ method: "GET" });
    await automationExecutor(req, res);
    expect(res._getStatusCode()).toBe(500);
    const body = JSON.parse(res._getData());
    expect(body.error).toContain("DB down");
  });
});

// ===========================================================================
// 2. collect-miniapp-stats
// ===========================================================================
describe("POST /api/cron/collect-miniapp-stats", () => {
  it("returns 503 when DB not configured", async () => {
    // Temporarily null out supabaseAdmin
    const supabaseMod = require("@/lib/supabase");
    const origAdmin = supabaseMod.supabaseAdmin;
    supabaseMod.supabaseAdmin = null;

    const { req, res } = createMocks({ method: "GET" });
    await collectMiniappStats(req, res);
    expect(res._getStatusCode()).toBe(503);

    supabaseMod.supabaseAdmin = origAdmin;
  });

  it("returns 200 with 'No apps to process' when no apps", async () => {
    mockResult = { data: [], error: null };
    const { req, res } = createMocks({ method: "GET" });
    await collectMiniappStats(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.message).toBe("No apps to process");
  });

  it("returns 200 processing apps successfully", async () => {
    mockResult = {
      data: [
        {
          app_id: "miniapp-lottery",
          supported_chains: ["neo-n3-mainnet"],
          contracts: {},
        },
      ],
      error: null,
    };
    const { req, res } = createMocks({ method: "GET" });
    await collectMiniappStats(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBeGreaterThanOrEqual(0);
    expect(body.chainsProcessed).toBeDefined();
  });
});

// ===========================================================================
// 3. init-stats
// ===========================================================================
describe("POST /api/cron/init-stats", () => {
  it("returns 403 in production", async () => {
    const origEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const { req, res } = createMocks({ method: "GET" });
    await initStats(req, res);
    expect(res._getStatusCode()).toBe(403);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Disabled in production");

    (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
  });

  it("returns 503 when DB not configured", async () => {
    const supabaseMod = require("@/lib/supabase");
    const origAdmin = supabaseMod.supabaseAdmin;
    supabaseMod.supabaseAdmin = null;

    const { req, res } = createMocks({ method: "GET" });
    await initStats(req, res);
    expect(res._getStatusCode()).toBe(503);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Database not configured");

    supabaseMod.supabaseAdmin = origAdmin;
  });

  it("returns 404 when no miniapps found", async () => {
    mockResult = { data: [], error: null };
    const { req, res } = createMocks({ method: "GET" });
    await initStats(req, res);
    expect(res._getStatusCode()).toBe(404);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("No miniapps found");
  });

  it("returns 200 on success", async () => {
    mockResult = {
      data: [
        { id: 1, app_id: "miniapp-lottery" },
        { id: 2, app_id: "miniapp-coinflip" },
      ],
      error: null,
    };
    const { req, res } = createMocks({ method: "GET" });
    await initStats(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
    expect(body.total).toBe(2);
    expect(body.platformStats).toBeDefined();
  });
});

// ===========================================================================
// 4. grow-stats
// ===========================================================================
describe("POST /api/cron/grow-stats", () => {
  it("returns 403 in production", async () => {
    const origEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const { req, res } = createMocks({ method: "GET" });
    await growStats(req, res);
    expect(res._getStatusCode()).toBe(403);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Disabled in production");

    (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
  });

  it("returns 503 when DB not configured", async () => {
    const supabaseMod = require("@/lib/supabase");
    const origAdmin = supabaseMod.supabaseAdmin;
    supabaseMod.supabaseAdmin = null;

    const { req, res } = createMocks({ method: "GET" });
    await growStats(req, res);
    expect(res._getStatusCode()).toBe(503);
    const body = JSON.parse(res._getData());
    expect(body.error).toBe("Database not configured");

    supabaseMod.supabaseAdmin = origAdmin;
  });

  it("returns 200 on success", async () => {
    mockResult = {
      data: [
        {
          id: 1,
          total_unique_users: 100,
          total_transactions: 500,
          total_gas_used: "10.0000",
          active_users_daily: 10,
          active_users_weekly: 50,
          transactions_daily: 100,
          transactions_weekly: 400,
        },
      ],
      error: null,
    };
    const { req, res } = createMocks({ method: "GET" });
    await growStats(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
    expect(body.increments).toBeDefined();
    expect(body.increments.users).toBeGreaterThanOrEqual(1);
    expect(body.increments.transactions).toBeGreaterThanOrEqual(10);
  });
});

// ===========================================================================
// 5. rollup-stats
// ===========================================================================
describe("POST /api/cron/rollup-stats", () => {
  it("returns 503 when DB not configured", async () => {
    const supabaseMod = require("@/lib/supabase");
    const origAdmin = supabaseMod.supabaseAdmin;
    supabaseMod.supabaseAdmin = null;

    const { req, res } = createMocks({ method: "GET" });
    await rollupStats(req, res);
    expect(res._getStatusCode()).toBe(503);

    supabaseMod.supabaseAdmin = origAdmin;
  });

  it("returns 200 with rollup results", async () => {
    mockResult = { data: null, error: null };
    const { req, res } = createMocks({ method: "GET" });
    await rollupStats(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.message).toMatch(/Rollup complete/);
    expect(body.chainsProcessed).toBeDefined();
    expect(body.results).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });
});

// ===========================================================================
// 6. sync-platform-stats
// ===========================================================================
describe("POST /api/cron/sync-platform-stats", () => {
  it("returns 503 when DB not configured", async () => {
    const supabaseMod = require("@/lib/supabase");
    const origAdmin = supabaseMod.supabaseAdmin;
    supabaseMod.supabaseAdmin = null;

    const { req, res } = createMocks({ method: "GET" });
    await syncPlatformStats(req, res);
    expect(res._getStatusCode()).toBe(503);

    supabaseMod.supabaseAdmin = origAdmin;
  });

  it("returns 200 with sync results", async () => {
    mockResult = { data: [], error: null, count: 42 };
    const { req, res } = createMocks({ method: "GET" });
    await syncPlatformStats(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.timestamp).toBeDefined();
    expect(body.chains).toBeDefined();
    expect(body.tables).toBeDefined();
    expect(typeof body.total_transactions).toBe("number");
    expect(typeof body.unique_users).toBe("number");
  });
});
