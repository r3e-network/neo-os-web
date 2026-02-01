import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

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

Deno.test("gas-sponsor-request: rejects non-POST", async () => {
  const req = new Request("http://localhost/gas-sponsor-request", {
    method: "GET",
  });
  const res = await handler(req);
  assertEquals(res.status, 405);
});

Deno.test("gas-sponsor-request: handles CORS preflight", async () => {
  const req = new Request("http://localhost/gas-sponsor-request", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000" },
  });
  const res = await handler(req);
  assertEquals(res.status, 204);
});

Deno.test("gas-sponsor-request: requires auth", async () => {
  const req = new Request("http://localhost/gas-sponsor-request", {
    method: "POST",
    body: JSON.stringify({ amount: "0.01" }),
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
});
