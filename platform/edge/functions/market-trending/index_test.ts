import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handler } from "./index.ts";

/**
 * Test suite for market-trending endpoint
 * Target: ≥90% coverage
 */

// Mock Supabase data store
let mockSupabaseData: {
  todayData?: any[];
  historicalData?: any[];
  appsData?: any[];
  statsData?: any[];
  todayError?: any;
  historicalError?: any;
  appsError?: any;
  statsError?: any;
} = {};

function resetMockData() {
  mockSupabaseData = {
    todayData: [],
    historicalData: [],
    appsData: [],
    statsData: [],
  };
}

// Create mock supabase client factory
function createMockSupabaseFactory() {
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
          if (table === "miniapp_stats_daily" && queries.eqValue) {
            // Today's data query
            result = {
              data: mockSupabaseData.todayData || [],
              error: mockSupabaseData.todayError || null,
            };
          } else if (table === "miniapp_stats_daily" && queries.gteValue) {
            // Historical data query
            result = {
              data: mockSupabaseData.historicalData || [],
              error: mockSupabaseData.historicalError || null,
            };
          } else if (table === "miniapps") {
            // Apps metadata query
            result = {
              data: mockSupabaseData.appsData || [],
              error: mockSupabaseData.appsError || null,
            };
          } else if (table === "miniapp_stats") {
            // Stats query
            result = {
              data: mockSupabaseData.statsData || [],
              error: mockSupabaseData.statsError || null,
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

// Mock environment variables
Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

Deno.test("market-trending - handles CORS preflight", async () => {
  const req = new Request("http://localhost/market-trending", {
    method: "OPTIONS",
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
  assertEquals(body.error.code, "METHOD_NOT_ALLOWED");
});

Deno.test("market-trending - returns empty array when no data for today", async () => {
  resetMockData();
  mockSupabaseData.todayData = [];

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, createMockSupabaseFactory());

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.trending, []);
  assertExists(body.updated_at);
});

Deno.test("market-trending - calculates growth rate correctly", async () => {
  resetMockData();

  // Today's data: app1 has 100 tx, app2 has 50 tx
  mockSupabaseData.todayData = [
    { app_id: "app1", tx_count: 100 },
    { app_id: "app2", tx_count: 50 },
  ];

  // Historical data: app1 avg = 50, app2 avg = 100
  mockSupabaseData.historicalData = [
    { app_id: "app1", tx_count: 50 },
    { app_id: "app1", tx_count: 50 },
    { app_id: "app2", tx_count: 100 },
    { app_id: "app2", tx_count: 100 },
  ];

  mockSupabaseData.appsData = [
    { app_id: "app1", manifest: { name: "App One", icon: "icon1.png" } },
    { app_id: "app2", manifest: { name: "App Two", icon: "icon2.png" } },
  ];

  mockSupabaseData.statsData = [
    { app_id: "app1", total_transactions: 1000 },
    { app_id: "app2", total_transactions: 2000 },
  ];

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, createMockSupabaseFactory());

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
  resetMockData();

  mockSupabaseData.todayData = [
    { app_id: "app1", tx_count: 100 },
    { app_id: "app2", tx_count: 90 },
    { app_id: "app3", tx_count: 80 },
  ];

  mockSupabaseData.historicalData = [
    { app_id: "app1", tx_count: 50 },
    { app_id: "app2", tx_count: 50 },
    { app_id: "app3", tx_count: 50 },
  ];

  mockSupabaseData.appsData = [
    { app_id: "app1", manifest: { name: "App 1", icon: "" } },
    { app_id: "app2", manifest: { name: "App 2", icon: "" } },
  ];

  mockSupabaseData.statsData = [
    { app_id: "app1", total_transactions: 1000 },
    { app_id: "app2", total_transactions: 1000 },
  ];

  const req = new Request("http://localhost/market-trending?limit=2");
  const res = await handler(req, createMockSupabaseFactory());

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.trending.length, 2);
});

Deno.test("market-trending - validates limit parameter bounds", async () => {
  resetMockData();
  mockSupabaseData.todayData = [{ app_id: "app1", tx_count: 100 }];
  mockSupabaseData.historicalData = [{ app_id: "app1", tx_count: 50 }];
  mockSupabaseData.appsData = [{ app_id: "app1", manifest: { name: "App 1", icon: "" } }];
  mockSupabaseData.statsData = [{ app_id: "app1", total_transactions: 1000 }];

  const factory = createMockSupabaseFactory();

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
  resetMockData();
  mockSupabaseData.todayData = [{ app_id: "app1", tx_count: 100 }];
  mockSupabaseData.historicalData = [{ app_id: "app1", tx_count: 50 }];
  mockSupabaseData.appsData = [{ app_id: "app1", manifest: { name: "App 1", icon: "" } }];
  mockSupabaseData.statsData = [{ app_id: "app1", total_transactions: 1000 }];

  const factory = createMockSupabaseFactory();

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
  resetMockData();

  mockSupabaseData.todayData = [{ app_id: "newapp", tx_count: 100 }];
  mockSupabaseData.historicalData = []; // No history
  mockSupabaseData.appsData = [{ app_id: "newapp", manifest: { name: "New App", icon: "" } }];
  mockSupabaseData.statsData = [{ app_id: "newapp", total_transactions: 100 }];

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, createMockSupabaseFactory());

  assertEquals(res.status, 200);
  const body = await res.json();

  // New app with no history should have capped growth rate of 10.0
  assertEquals(body.trending.length, 1);
  assertEquals(body.trending[0].growth_rate, 10.0);
});

Deno.test("market-trending - handles database errors gracefully", async () => {
  resetMockData();
  mockSupabaseData.todayError = { message: "Database connection failed" };

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, createMockSupabaseFactory());

  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error.code, "DB_ERROR");
});

Deno.test("market-trending - handles historical data error", async () => {
  resetMockData();
  mockSupabaseData.todayData = [{ app_id: "app1", tx_count: 100 }];
  mockSupabaseData.historicalError = { message: "Failed to fetch historical data" };

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, createMockSupabaseFactory());

  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error.code, "DB_ERROR");
});

Deno.test("market-trending - handles apps metadata error", async () => {
  resetMockData();
  mockSupabaseData.todayData = [{ app_id: "app1", tx_count: 100 }];
  mockSupabaseData.historicalData = [{ app_id: "app1", tx_count: 50 }];
  mockSupabaseData.appsError = { message: "Failed to fetch apps" };

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, createMockSupabaseFactory());

  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error.code, "DB_ERROR");
});

Deno.test("market-trending - handles stats error", async () => {
  resetMockData();
  mockSupabaseData.todayData = [{ app_id: "app1", tx_count: 100 }];
  mockSupabaseData.historicalData = [{ app_id: "app1", tx_count: 50 }];
  mockSupabaseData.appsData = [{ app_id: "app1", manifest: { name: "App 1", icon: "" } }];
  mockSupabaseData.statsError = { message: "Failed to fetch stats" };

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, createMockSupabaseFactory());

  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error.code, "DB_ERROR");
});

Deno.test("market-trending - includes all required response fields", async () => {
  resetMockData();
  mockSupabaseData.todayData = [{ app_id: "app1", tx_count: 100 }];
  mockSupabaseData.historicalData = [{ app_id: "app1", tx_count: 50 }];
  mockSupabaseData.appsData = [{ app_id: "app1", manifest: { name: "App 1", icon: "icon.png" } }];
  mockSupabaseData.statsData = [{ app_id: "app1", total_transactions: 1000 }];

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, createMockSupabaseFactory());

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
  resetMockData();
  mockSupabaseData.todayData = [{ app_id: "app1", tx_count: 100 }];
  mockSupabaseData.historicalData = [
    { app_id: "app1", tx_count: 0 },
    { app_id: "app1", tx_count: 0 },
  ];
  mockSupabaseData.appsData = [{ app_id: "app1", manifest: { name: "App 1", icon: "" } }];
  mockSupabaseData.statsData = [{ app_id: "app1", total_transactions: 100 }];

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, createMockSupabaseFactory());

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.trending[0].growth_rate, 10.0); // Capped at 10.0
});

Deno.test("market-trending - rounds growth rate to 4 decimals", async () => {
  resetMockData();
  mockSupabaseData.todayData = [{ app_id: "app1", tx_count: 333 }];
  mockSupabaseData.historicalData = [{ app_id: "app1", tx_count: 100 }];
  mockSupabaseData.appsData = [{ app_id: "app1", manifest: { name: "App 1", icon: "" } }];
  mockSupabaseData.statsData = [{ app_id: "app1", total_transactions: 1000 }];

  const req = new Request("http://localhost/market-trending");
  const res = await handler(req, createMockSupabaseFactory());

  assertEquals(res.status, 200);
  const body = await res.json();

  // (333 - 100) / 100 = 2.33
  assertEquals(body.trending[0].growth_rate, 2.33);
});

Deno.test("market-trending - handles unexpected errors", async () => {
  resetMockData();
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
  assertEquals(body.error.code, "INTERNAL_ERROR");
});
