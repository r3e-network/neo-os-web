import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createOSHandler, buildInvocationIntent, type OSRequest } from "./os-service.ts";

// ---------------------------------------------------------------------------
// buildInvocationIntent — pure function, no mocking needed
// ---------------------------------------------------------------------------

Deno.test("buildInvocationIntent returns correct structure", () => {
  const intent = buildInvocationIntent(
    "0xabc123",
    "transfer",
    [{ type: "Hash160", value: "deadbeef" }],
  );
  assertEquals(intent.contract, "0xabc123");
  assertEquals(intent.operation, "transfer");
  assertEquals(intent.args.length, 1);
  assertEquals(intent.args[0].type, "Hash160");
  assertEquals(intent.args[0].value, "deadbeef");
});

Deno.test("buildInvocationIntent handles empty args", () => {
  const intent = buildInvocationIntent("0xabc", "getBalance", []);
  assertEquals(intent.contract, "0xabc");
  assertEquals(intent.operation, "getBalance");
  assertEquals(intent.args, []);
});

Deno.test("buildInvocationIntent handles multiple args", () => {
  const args = [
    { type: "Hash160", value: "aaa" },
    { type: "Integer", value: 100 },
    { type: "String", value: "hello" },
  ];
  const intent = buildInvocationIntent("0x1", "invoke", args);
  assertEquals(intent.args.length, 3);
  assertEquals(intent.args[1].type, "Integer");
  assertEquals(intent.args[2].value, "hello");
});

// ---------------------------------------------------------------------------
// createOSHandler — factory shape
// ---------------------------------------------------------------------------

Deno.test("createOSHandler returns a function", () => {
  const handler = createOSHandler(
    { scopeName: "test-scope" },
    async () => ({ ok: true }),
  );
  assertEquals(typeof handler, "function");
});

// ---------------------------------------------------------------------------
// createOSHandler — CORS preflight
//
// The handler delegates to handleCorsPreflight which returns a Response for
// OPTIONS requests. In non-production without EDGE_CORS_ORIGINS, CORS sets
// Access-Control-Allow-Origin: *.
// ---------------------------------------------------------------------------

Deno.test("handler returns CORS headers on OPTIONS preflight", async () => {
  // Ensure non-production environment so CORS allows "*"
  Deno.env.delete("EDGE_ENV");
  Deno.env.delete("DENO_ENV");
  Deno.env.delete("ENV");
  Deno.env.delete("NODE_ENV");
  Deno.env.delete("SUPABASE_ENV");
  Deno.env.delete("EDGE_CORS_ORIGINS");

  const handler = createOSHandler(
    { scopeName: "test" },
    async () => ({ ok: true }),
  );

  const req = new Request("http://localhost/test", { method: "OPTIONS" });
  const res = await handler(req);

  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods"),
    "GET,POST,OPTIONS",
  );
});

// ---------------------------------------------------------------------------
// createOSHandler — method enforcement
// ---------------------------------------------------------------------------

Deno.test("handler returns 405 for wrong HTTP method (GET on POST handler)", async () => {
  Deno.env.delete("EDGE_ENV");
  Deno.env.delete("EDGE_CORS_ORIGINS");

  const handler = createOSHandler(
    { scopeName: "test" },
    async () => ({ ok: true }),
  );

  const req = new Request("http://localhost/test", { method: "GET" });
  const res = await handler(req);

  assertEquals(res.status, 405);
  const body = await res.json();
  assertEquals(body.error.code, "METHOD_NOT_ALLOWED");
});

Deno.test("handler accepts GET when method option is GET", async () => {
  Deno.env.delete("EDGE_ENV");
  Deno.env.delete("EDGE_CORS_ORIGINS");

  // This handler allows GET but will fail at auth (no bearer token).
  // The point is it should NOT return 405.
  const handler = createOSHandler(
    { scopeName: "test", method: "GET" },
    async () => ({ ok: true }),
  );

  const req = new Request("http://localhost/test", { method: "GET" });
  const res = await handler(req);

  // Should proceed past method check (will fail at auth, not 405)
  assertEquals(res.status !== 405, true);
});

Deno.test("handler returns 405 for POST when method option is GET", async () => {
  Deno.env.delete("EDGE_ENV");
  Deno.env.delete("EDGE_CORS_ORIGINS");

  const handler = createOSHandler(
    { scopeName: "test", method: "GET" },
    async () => ({ ok: true }),
  );

  const req = new Request("http://localhost/test", { method: "POST" });
  const res = await handler(req);

  assertEquals(res.status, 405);
});
