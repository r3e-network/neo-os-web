import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handler } from "./index.ts";

Deno.test("credits-ledger: rejects unsupported methods", async () => {
  const res = await handler(new Request("http://localhost/credits-ledger", { method: "PUT" }));
  assertEquals(res.status, 405);
});

Deno.test("credits-ledger: handles CORS preflight for configured origins", async () => {
  const prev = Deno.env.get("EDGE_CORS_ORIGINS");
  try {
    Deno.env.set("EDGE_CORS_ORIGINS", "http://localhost:3000");
    const res = await handler(
      new Request("http://localhost/credits-ledger", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3000" },
      }),
    );
    assertEquals(res.status, 204);
  } finally {
    if (prev === undefined) Deno.env.delete("EDGE_CORS_ORIGINS");
    else Deno.env.set("EDGE_CORS_ORIGINS", prev);
  }
});

Deno.test("credits-ledger: GET requires auth", async () => {
  const res = await handler(
    new Request("http://localhost/credits-ledger?network=testnet", { method: "GET" }),
  );
  assertEquals(res.status, 401);
});

Deno.test("credits-ledger: POST spend requires auth", async () => {
  const res = await handler(
    new Request("http://localhost/credits-ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        network: "testnet",
        app_id: "example-app",
        amount: "5",
        idempotency_key: "spend-test-0001",
      }),
    }),
  );
  assertEquals(res.status, 401);
});
