/** @jest-environment node */

/**
 * MiniApp Stats Tests
 * Covers: collector, rollup, service
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockGte = jest.fn();
const mockLte = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockSingle = jest.fn();
const mockNeq = jest.fn();
const mockUpsert = jest.fn();
const mockHead = jest.fn();

function buildChain() {
  const chain: Record<string, jest.Mock> = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    upsert: mockUpsert,
    eq: mockEq,
    in: mockIn,
    gte: mockGte,
    lte: mockLte,
    order: mockOrder,
    limit: mockLimit,
    single: mockSingle,
    neq: mockNeq,
    head: mockHead,
  };
  // Every method returns the chain itself for fluent API
  for (const fn of Object.values(chain)) {
    fn.mockReturnValue(chain);
  }
  return chain;
}

jest.mock("@/lib/supabase", () => {
  const chain = buildChain();
  mockFrom.mockReturnValue(chain);
  return {
    supabase: { from: mockFrom, rpc: mockRpc },
    supabaseAdmin: { from: mockFrom, rpc: mockRpc },
    isSupabaseConfigured: true,
  };
});

jest.mock("@/lib/chains/rpc-functions", () => ({
  getChainRpcUrl: jest.fn(() => "https://rpc.neo.org"),
  getBlockCount: jest.fn(() => 5000),
  getTransactionLogMultiChain: jest.fn(),
  invokeRead: jest.fn(),
}));

jest.mock("@/lib/chains/contract-queries", () => ({
  getLotteryState: jest.fn(() => ({ prizePool: "1000", ticketsSold: 42 })),
  getContractStats: jest.fn(() => ({ totalValueLocked: "50000" })),
}));

// Suppress console.warn/error in tests
beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Collector Tests
// ---------------------------------------------------------------------------

describe("Collector", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { statsCache, CACHE_TTL } = require("@/lib/miniapp-stats/collector");

  afterEach(() => {
    statsCache.clear();
  });

  it("exports statsCache as a Map", () => {
    expect(statsCache).toBeInstanceOf(Map);
  });

  it("exports CACHE_TTL as 5 minutes", () => {
    expect(CACHE_TTL).toBe(5 * 60 * 1000);
  });

  it("statsCache supports get/set/clear", () => {
    const fakeStats = { appId: "test-app", totalTransactions: 10 };
    statsCache.set("test-app:neo-n3", { stats: fakeStats, timestamp: Date.now() });
    expect(statsCache.has("test-app:neo-n3")).toBe(true);
    expect(statsCache.get("test-app:neo-n3").stats.appId).toBe("test-app");
    statsCache.clear();
    expect(statsCache.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Service Tests
// ---------------------------------------------------------------------------

describe("Service", () => {
  const { statsCache } = require("@/lib/miniapp-stats/collector");

  beforeEach(() => {
    jest.clearAllMocks();
    statsCache.clear();
    // Re-wire the fluent chain after clearAllMocks
    const chain = buildChain();
    mockFrom.mockReturnValue(chain);
  });

  describe("ensureStatsExist", () => {
    it("calls supabase rpc and returns true on success", async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });
      const { ensureStatsExist } = require("@/lib/miniapp-stats/service");
      const result = await ensureStatsExist("app-1", "neo-n3");
      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("ensure_miniapp_stats_exist", {
        p_app_id: "app-1",
        p_chain_id: "neo-n3",
      });
    });

    it("returns false on rpc error", async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: "fail" } });
      const { ensureStatsExist } = require("@/lib/miniapp-stats/service");
      const result = await ensureStatsExist("app-1", "neo-n3");
      expect(result).toBe(false);
    });

    it("returns false on exception", async () => {
      mockRpc.mockRejectedValueOnce(new Error("network"));
      const { ensureStatsExist } = require("@/lib/miniapp-stats/service");
      const result = await ensureStatsExist("app-1", "neo-n3");
      expect(result).toBe(false);
    });
  });

  describe("getAggregatedMiniAppStats", () => {
    it("returns cached stats when fresh", async () => {
      const cached = {
        appId: "app-1",
        totalTransactions: 100,
        viewCount: 50,
      };
      statsCache.set("app-1:all-chains", { stats: cached, timestamp: Date.now() });

      const { getAggregatedMiniAppStats } = require("@/lib/miniapp-stats/service");
      const result = await getAggregatedMiniAppStats("app-1");
      expect(result).toEqual(cached);
      // Should NOT call supabase
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns null when no data in DB", async () => {
      mockSingle.mockResolvedValueOnce({ data: null });
      // Override eq to resolve with empty data
      mockEq.mockReturnValue({ data: [], error: null });

      const { getAggregatedMiniAppStats } = require("@/lib/miniapp-stats/service");
      const result = await getAggregatedMiniAppStats("app-missing");
      expect(result).toBeNull();
    });
  });

  describe("getBatchStats", () => {
    it("returns empty object when no appIds provided", async () => {
      const { getBatchStats } = require("@/lib/miniapp-stats/service");
      const result = await getBatchStats([], "neo-n3");
      expect(result).toEqual({});
    });
  });

  describe("getLiveStatus", () => {
    it("returns gaming live status", async () => {
      const { getLiveStatus } = require("@/lib/miniapp-stats/service");
      const result = await getLiveStatus("app-1", "0xcontract", "gaming", "neo-n3");
      expect(result.appId).toBe("app-1");
      expect(result.jackpot).toBe("1000");
      expect(result.playersOnline).toBe(42);
    });

    it("returns defi live status", async () => {
      const { getLiveStatus } = require("@/lib/miniapp-stats/service");
      const result = await getLiveStatus("app-2", "0xdefi", "defi", "neo-n3");
      expect(result.appId).toBe("app-2");
      expect(result.tvl).toBe("50000");
    });

    it("handles errors gracefully", async () => {
      const { getLotteryState } = require("@/lib/chains/contract-queries");
      getLotteryState.mockRejectedValueOnce(new Error("rpc fail"));
      const { getLiveStatus } = require("@/lib/miniapp-stats/service");
      const result = await getLiveStatus("app-1", "0xcontract", "gaming", "neo-n3");
      expect(result.appId).toBe("app-1");
      // No jackpot since it failed
      expect(result.jackpot).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Rollup Tests
// ---------------------------------------------------------------------------

describe("Rollup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const chain = buildChain();
    mockFrom.mockReturnValue(chain);
  });

  describe("exports", () => {
    it("exports configuration constants", () => {
      const rollup = require("@/lib/miniapp-stats/rollup");
      expect(rollup.ROLLUP_INTERVAL_MS).toBe(10 * 60 * 1000);
      expect(rollup.BLOCKS_PER_ROLLUP).toBe(1000);
      expect(rollup.DEFAULT_CHAIN_ID).toBe("neo-n3-testnet");
    });
  });

  describe("executeRollup", () => {
    it("returns error result when createRollupLog insert fails", async () => {
      // Reset single to pure mock, then set the one-time resolved value
      mockSingle.mockReset();
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "insert failed" },
      });

      const { executeRollup } = require("@/lib/miniapp-stats/rollup");
      // createRollupLog is outside try/catch, so it throws
      await expect(executeRollup()).rejects.toThrow("Failed to create rollup log");
    });

    it("processes empty event list successfully", async () => {
      // Reset single to pure mock so mockResolvedValueOnce works cleanly
      mockSingle.mockReset();
      // 1) createRollupLog: .insert().select("id").single()
      mockSingle.mockResolvedValueOnce({ data: { id: 99 }, error: null });
      // 2) getRollupContext: .select().eq().order().limit().single()
      mockSingle.mockResolvedValueOnce({ data: null, error: null });
      // 3) processRollup: .select("*").gte().lte() — terminal is lte
      mockLte.mockReset();
      mockLte.mockResolvedValueOnce({ data: [], error: null });

      const { executeRollup } = require("@/lib/miniapp-stats/rollup");
      const result = await executeRollup("neo-n3-testnet");

      expect(result.success).toBe(true);
      expect(result.eventsProcessed).toBe(0);
      expect(result.appsProcessed).toBe(0);
    });
  });

  describe("getRollupStatus", () => {
    it("returns status object with counts", async () => {
      // lastRollup query -> single
      mockSingle.mockResolvedValueOnce({
        data: { id: 5, status: "completed" },
      });
      // totalRollups count -> head (select with count:exact, head:true)
      mockSelect.mockImplementationOnce(() => ({
        ...buildChain(),
        then: (resolve: (v: { count: number }) => void) => resolve({ count: 10 }),
      }));
      // failedRollups count -> head
      mockSelect.mockImplementationOnce(() => ({
        ...buildChain(),
        then: (resolve: (v: { count: number }) => void) => resolve({ count: 2 }),
      }));

      const { getRollupStatus } = require("@/lib/miniapp-stats/rollup");
      const status = await getRollupStatus();

      expect(status).toHaveProperty("lastRollup");
      expect(status).toHaveProperty("totalRollups");
      expect(status).toHaveProperty("failedRollups");
    });
  });

  describe("resetRollup", () => {
    it("calls delete on stats_rollup_log", async () => {
      mockNeq.mockResolvedValueOnce({ data: null, error: null });

      const { resetRollup } = require("@/lib/miniapp-stats/rollup");
      await resetRollup();

      expect(mockFrom).toHaveBeenCalledWith("stats_rollup_log");
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
