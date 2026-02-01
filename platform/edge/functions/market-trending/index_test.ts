import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

/**
 * Test suite for market-trending endpoint
 * Target: ≥90% coverage
 */

type MockSupabaseData = {
  todayData?: any[];
  historicalData?: any[];
  appsData?: any[];
  statsData?: any[];
  todayError?: any;
  historicalError?: any;
  appsError?: any;
  statsError?: any;
};

// Create mock supabase client factory
function createMockSupabaseFactory(data: MockSupabaseData = {}) {
  const snapshot: Required<MockSupabaseData> = {
    todayData: data.todayData ?? [],
    historicalData: data.historicalData ?? [],
    appsData: data.appsData ?? [],
    statsData: data.statsData ?? [],
    todayError: data.todayError ?? null,
    historicalError: data.historicalError ?? null,
    appsError: data.appsError ?? null,
    statsError: data.statsError ?? null,
  };
  return () => ({
    from: (table: string) => {
      const queries: any = {
        eqValue: null,
        gteValue: null,
        ltValue: null,
        inValues: null,
      };

      const mockChain = {
        select: (_cols: string) => mockChain,
        eq: (_col: string, val: any) => {
          queries.eqValue = val;
          return mockChain;
        },
        gte: (_col: string, val: any) => {
          queries.gteValue = val;
          return mockChain;
        },
        lt: (_col: string, val: any) => {
          queries.ltValue = val;
          return mockChain;
        },
        in: (_col: string, vals: any[]) => {
          queries.inValues = vals;
          return mockChain;
        },
        order: (_col: string, _opts?: any) => mockChain,
        then: async (resolve: any) => {
          let result;
          if (table === "miniapp_stats_daily" && queries.gteValue) {
            // Historical data query
            result = {
              data: snapshot.historicalData,
              error: snapshot.historicalError,
            };
          } else if (table === "miniapp_stats_daily" && queries.eqValue) {
            // Today's data query
            result = {
              data: snapshot.todayData,
              error: snapshot.todayError,
            };
          } else if (table === "miniapps") {
            // Apps metadata query
            result = {
              data: snapshot.appsData,
              error: snapshot.appsError,
            };
          } else if (table === "miniapp_stats") {
            // Stats query
            result = {
              data: snapshot.statsData,
              error: snapshot.statsError,
            };
          } else {
            result = { data: [], error: null };
          }
          return resolve(result);
        },
      };

      return mockChain;
    },
  });
}

function setRequiredEnv(): void {
  Deno.env.set("DATABASE_URL", "postgresql://localhost/test");
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
  Deno.env.set("JWT_SECRET", "x".repeat(32));
  Deno.env.set("NEO_RPC_URL", "http://localhost:1234");
  Deno.env.set("SERVICE_LAYER_URL", "http://localhost:9000");
  Deno.env.set("TXPROXY_URL", "http://localhost:9001");
  Deno.env.set("EDGE_CORS_ORIGINS", "http://localhost:3000");
  Deno.env.set("DENO_ENV", "development");
}

setRequiredEnv();
const { handler } = await import("./index.ts");

Deno.test("market-trending - handles CORS preflight", async () => {
  const req = new Request("http://localhost/market-trending", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000" },
  });

  const res = await handler(req);
  assertEquals(res.status, 204);
});

Deno.test("market-trending - rejects non-GET methods", async () => {
  const req = new Request("http://localhost/market-trending", {
    method: "POST",
  });

  const res = await handler(req);
  assertEquals(res.status, 405);

  const body = await res.json();
  assertEquals(body.error.code, "VAL_405");
});

Deno.test("market-trending - returns empty array when no data for today", async () => {
  const factory = createMockSupabaseFactory({ todayData: [] });

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, factory);

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.trending, []);
  assertExists(body.updated_at);
});

Deno.test("market-trending - calculates growth rate correctly", async () => {
  const factory = createMockSupabaseFactory({
    // Today's data: app1 has 100 tx, app2 has 50 tx
    todayData: [
      { app_id: "app1", tx_count: 100 },
      { app_id: "app2", tx_count: 50 },
    ],
    // Historical data: app1 avg = 50, app2 avg = 100
    historicalData: [
      { app_id: "app1", tx_count: 50 },
      { app_id: "app1", tx_count: 50 },
      { app_id: "app2", tx_count: 100 },
      { app_id: "app2", tx_count: 100 },
    ],
    appsData: [
      { app_id: "app1", manifest: { name: "App One", icon: "icon1.png" } },
      { app_id: "app2", manifest: { name: "App Two", icon: "icon2.png" } },
    ],
    statsData: [
      { app_id: "app1", total_transactions: 1000 },
      { app_id: "app2", total_transactions: 2000 },
    ],
  });

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, factory);

  assertEquals(res.status, 200);
  const body = await res.json();

  // app1 growth: (100 - 50) / 50 = 1.0 (100% growth)
  // app2 growth: (50 - 100) / 100 = -0.5 (-50% decline)
  // Sorted by growth: app1 first, app2 second

  assertEquals(body.trending.length, 2);
  assertEquals(body.trending[0].app_id, "app1");
  assertEquals(body.trending[0].growth_rate, 1.0);
  assertEquals(body.trending[0].rank, 1);

  assertEquals(body.trending[1].app_id, "app2");
  assertEquals(body.trending[1].growth_rate, -0.5);
  assertEquals(body.trending[1].rank, 2);
});

Deno.test("market-trending - respects limit parameter", async () => {
  const factory = createMockSupabaseFactory({
    todayData: [
      { app_id: "app1", tx_count: 100 },
      { app_id: "app2", tx_count: 90 },
      { app_id: "app3", tx_count: 80 },
    ],
    historicalData: [
      { app_id: "app1", tx_count: 50 },
      { app_id: "app2", tx_count: 50 },
      { app_id: "app3", tx_count: 50 },
    ],
    appsData: [
      { app_id: "app1", manifest: { name: "App 1", icon: "" } },
      { app_id: "app2", manifest: { name: "App 2", icon: "" } },
    ],
    statsData: [
      { app_id: "app1", total_transactions: 1000 },
      { app_id: "app2", total_transactions: 1000 },
    ],
  });

  const req = new Request("http://localhost/market-trending?limit=2");
  const res = await handler(req, factory);

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.trending.length, 2);
});

Deno.test("market-trending - validates limit parameter bounds", async () => {
  const factory = createMockSupabaseFactory({
    todayData: [{ app_id: "app1", tx_count: 100 }],
    historicalData: [{ app_id: "app1", tx_count: 50 }],
    appsData: [{ app_id: "app1", manifest: { name: "App 1", icon: "" } }],
    statsData: [{ app_id: "app1", total_transactions: 1000 }],
  });

  // Test limit > 50 (should cap at 50)
  const req1 = new Request("http://localhost/market-trending?limit=100");
  const res1 = await handler(req1, factory);
  assertEquals(res1.status, 200);

  // Test limit < 1 (should use default 20)
  const req2 = new Request("http://localhost/market-trending?limit=0");
  const res2 = await handler(req2, factory);
  assertEquals(res2.status, 200);

  // Test invalid limit (should use default 20)
  const req3 = new Request("http://localhost/market-trending?limit=abc");
  const res3 = await handler(req3, factory);
  assertEquals(res3.status, 200);
});

Deno.test("market-trending - respects period parameter", async () => {
  const factory = createMockSupabaseFactory({
    todayData: [{ app_id: "app1", tx_count: 100 }],
    historicalData: [{ app_id: "app1", tx_count: 50 }],
    appsData: [{ app_id: "app1", manifest: { name: "App 1", icon: "" } }],
    statsData: [{ app_id: "app1", total_transactions: 1000 }],
  });

  // Test 1d period
  const req1 = new Request("http://localhost/market-trending?period=1d");
  const res1 = await handler(req1, factory);
  assertEquals(res1.status, 200);

  // Test 30d period
  const req2 = new Request("http://localhost/market-trending?period=30d");
  const res2 = await handler(req2, factory);
  assertEquals(res2.status, 200);

  // Test invalid period (should default to 7d)
  const req3 = new Request("http://localhost/market-trending?period=invalid");
  const res3 = await handler(req3, factory);
  assertEquals(res3.status, 200);
});

Deno.test("market-trending - handles new apps with no history", async () => {
  const factory = createMockSupabaseFactory({
    todayData: [{ app_id: "newapp", tx_count: 100 }],
    historicalData: [], // No history
    appsData: [{ app_id: "newapp", manifest: { name: "New App", icon: "" } }],
    statsData: [{ app_id: "newapp", total_transactions: 100 }],
  });

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, factory);

  assertEquals(res.status, 200);
  const body = await res.json();

  // New app with no history should have capped growth rate of 10.0
  assertEquals(body.trending.length, 1);
  assertEquals(body.trending[0].growth_rate, 10.0);
});

Deno.test("market-trending - handles database errors gracefully", async () => {
  const factory = createMockSupabaseFactory({
    todayError: { message: "Database connection failed" },
  });

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, factory);

  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.error.code, "SERVER_002");
});

Deno.test("market-trending - handles historical data error", async () => {
  const factory = createMockSupabaseFactory({
    todayData: [{ app_id: "app1", tx_count: 100 }],
    historicalError: { message: "Failed to fetch historical data" },
  });

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, factory);

  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.error.code, "SERVER_002");
});

Deno.test("market-trending - handles apps metadata error", async () => {
  const factory = createMockSupabaseFactory({
    todayData: [{ app_id: "app1", tx_count: 100 }],
    historicalData: [{ app_id: "app1", tx_count: 50 }],
    appsError: { message: "Failed to fetch apps" },
  });

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, factory);

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.trending[0].name, "app1");
  assertEquals(body.trending[0].icon, "");
});

Deno.test("market-trending - handles stats error", async () => {
  const factory = createMockSupabaseFactory({
    todayData: [{ app_id: "app1", tx_count: 100 }],
    historicalData: [{ app_id: "app1", tx_count: 50 }],
    appsData: [{ app_id: "app1", manifest: { name: "App 1", icon: "" } }],
    statsError: { message: "Failed to fetch stats" },
  });

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, factory);

  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.error.code, "SERVER_002");
});

Deno.test("market-trending - includes all required response fields", async () => {
  const factory = createMockSupabaseFactory({
    todayData: [{ app_id: "app1", tx_count: 100 }],
    historicalData: [{ app_id: "app1", tx_count: 50 }],
    appsData: [{ app_id: "app1", manifest: { name: "App 1", icon: "icon.png" } }],
    statsData: [{ app_id: "app1", total_transactions: 1000 }],
  });

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, factory);

  assertEquals(res.status, 200);
  const body = await res.json();

  assertExists(body.trending);
  assertExists(body.updated_at);

  const app = body.trending[0];
  assertExists(app.app_id);
  assertExists(app.name);
  assertExists(app.icon);
  assertExists(app.growth_rate);
  assertExists(app.total_transactions);
  assertExists(app.daily_transactions);
  assertExists(app.rank);
});

Deno.test("market-trending - handles zero average gracefully", async () => {
  const factory = createMockSupabaseFactory({
    todayData: [{ app_id: "app1", tx_count: 100 }],
    historicalData: [
      { app_id: "app1", tx_count: 0 },
      { app_id: "app1", tx_count: 0 },
    ],
    appsData: [{ app_id: "app1", manifest: { name: "App 1", icon: "" } }],
    statsData: [{ app_id: "app1", total_transactions: 100 }],
  });

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, factory);

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.trending[0].growth_rate, 10.0); // Capped at 10.0
});

Deno.test("market-trending - rounds growth rate to 4 decimals", async () => {
  const factory = createMockSupabaseFactory({
    todayData: [{ app_id: "app1", tx_count: 333 }],
    historicalData: [{ app_id: "app1", tx_count: 100 }],
    appsData: [{ app_id: "app1", manifest: { name: "App 1", icon: "" } }],
    statsData: [{ app_id: "app1", total_transactions: 1000 }],
  });

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, factory);

  assertEquals(res.status, 200);
  const body = await res.json();

  // (333 - 100) / 100 = 2.33
  assertEquals(body.trending[0].growth_rate, 2.33);
});

Deno.test("market-trending - handles unexpected errors", async () => {
  // Create a mock that throws during query execution
  const errorFactory = () => ({
    from: () => {
      throw new Error("Unexpected database error");
    },
  });

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, errorFactory);

  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error.code, "SERVER_001");
});
