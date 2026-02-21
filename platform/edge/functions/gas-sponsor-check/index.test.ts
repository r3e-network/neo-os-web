import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handler } from "./index.ts";

// Mock dependencies
const mockSupabase = {
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  }),
};

Deno.test("gas-sponsor-check: rejects non-GET", async () => {
  const req = new Request("http://localhost/gas-sponsor-check", {
    method: "POST",
  });
  const res = await handler(req);
  assertEquals(res.status, 405);
});

Deno.test("gas-sponsor-check: handles CORS preflight", async () => {
  const req = new Request("http://localhost/gas-sponsor-check", {
    method: "OPTIONS",
  });
  const res = await handler(req);
  assertEquals(res.status, 204);
});

Deno.test("gas-sponsor-check: requires auth", async () => {
  const req = new Request("http://localhost/gas-sponsor-check", {
    method: "GET",
  });
  const res = await handler(req);
  // Should return 401 without auth header
  assertEquals(res.status, 401);
});
