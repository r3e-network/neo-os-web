import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handler } from "./index.ts";

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
