import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handler } from "./index.ts";

Deno.test("gas-sponsor-request: rejects non-POST", async () => {
  const req = new Request("http://localhost/gas-sponsor-request", {
    method: "GET",
  });
  const res = await handler(req);
  assertEquals(res.status, 405);
});

Deno.test("gas-sponsor-request: handles CORS preflight for configured origins", async () => {
  const prev = Deno.env.get("EDGE_CORS_ORIGINS");
  try {
    Deno.env.set("EDGE_CORS_ORIGINS", "http://localhost:3000");
    const res = await handler(
      new Request("http://localhost/gas-sponsor-request", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3000" },
      }),
    );
    assertEquals(res.status, 204);
    assertEquals(
      res.headers.get("Access-Control-Allow-Origin"),
      "http://localhost:3000",
    );
  } finally {
    if (prev === undefined) Deno.env.delete("EDGE_CORS_ORIGINS");
    else Deno.env.set("EDGE_CORS_ORIGINS", prev);
  }
});

Deno.test("gas-sponsor-request: rejects CORS preflight when EDGE_CORS_ORIGINS is unset", async () => {
  const prev = Deno.env.get("EDGE_CORS_ORIGINS");
  try {
    Deno.env.delete("EDGE_CORS_ORIGINS");
    const res = await handler(
      new Request("http://localhost/gas-sponsor-request", { method: "OPTIONS" }),
    );
    assertEquals(res.status, 403);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), null);
  } finally {
    if (prev === undefined) Deno.env.delete("EDGE_CORS_ORIGINS");
    else Deno.env.set("EDGE_CORS_ORIGINS", prev);
  }
});

Deno.test("gas-sponsor-request: requires auth", async () => {
  const req = new Request("http://localhost/gas-sponsor-request", {
    method: "POST",
    body: JSON.stringify({ amount: "0.01" }),
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
});
