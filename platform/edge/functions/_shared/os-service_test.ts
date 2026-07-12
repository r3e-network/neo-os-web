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
// The handler delegates to handleCorsPreflight. Hardened behavior: until
// EDGE_CORS_ORIGINS is explicitly configured, preflight is rejected with 403
// in ALL environments. When the request Origin is in the configured
// allowlist, preflight succeeds with 204 and echoes that origin back.
// ---------------------------------------------------------------------------

Deno.test("handler returns CORS headers on OPTIONS preflight", async () => {
  const prev = Deno.env.get("EDGE_CORS_ORIGINS");
  try {
    Deno.env.set("EDGE_CORS_ORIGINS", "http://localhost:3000");

    const handler = createOSHandler(
      { scopeName: "test" },
      async () => ({ ok: true }),
    );

    const req = new Request("http://localhost/test", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    });
    const res = await handler(req);

    assertEquals(res.status, 204);
    assertEquals(
      res.headers.get("Access-Control-Allow-Origin"),
      "http://localhost:3000",
    );
    assertEquals(
      res.headers.get("Access-Control-Allow-Methods"),
      "GET,POST,OPTIONS",
    );
  } finally {
    if (prev === undefined) Deno.env.delete("EDGE_CORS_ORIGINS");
    else Deno.env.set("EDGE_CORS_ORIGINS", prev);
  }
});

Deno.test("handler rejects OPTIONS preflight when EDGE_CORS_ORIGINS is unset", async () => {
  const prev = Deno.env.get("EDGE_CORS_ORIGINS");
  try {
    Deno.env.delete("EDGE_CORS_ORIGINS");

    const handler = createOSHandler(
      { scopeName: "test" },
      async () => ({ ok: true }),
    );

    const res = await handler(
      new Request("http://localhost/test", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3000" },
      }),
    );

    assertEquals(res.status, 403);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), null);
  } finally {
    if (prev === undefined) Deno.env.delete("EDGE_CORS_ORIGINS");
    else Deno.env.set("EDGE_CORS_ORIGINS", prev);
  }
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

// ---------------------------------------------------------------------------
// createOSHandler — correlation id in error envelope
//
// Every error response must carry a correlation id so a user-reported failure
// can be matched to a server log line. The 405 path is reachable without auth
// mocking and exercises the same `error(...)` envelope used everywhere.
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.test("error responses carry a correlation id (requestId) in the envelope", async () => {
  Deno.env.delete("EDGE_ENV");
  Deno.env.delete("EDGE_CORS_ORIGINS");

  const handler = createOSHandler(
    { scopeName: "test" },
    async () => ({ ok: true }),
  );

  // Wrong method → 405 error envelope.
  const res = await handler(
    new Request("http://localhost/test", { method: "GET" }),
  );
  assertEquals(res.status, 405);

  const body = await res.json();
  // Additive top-level field + nested error.requestId, both the same id.
  assertEquals(typeof body.requestId, "string");
  assertEquals(UUID_RE.test(body.requestId), true);
  assertEquals(body.error.requestId, body.requestId);
  // Backward-compatible shape preserved.
  assertEquals(body.error.code, "METHOD_NOT_ALLOWED");
  assertEquals(typeof body.error.message, "string");
});

Deno.test("each request gets a distinct correlation id", async () => {
  Deno.env.delete("EDGE_ENV");
  Deno.env.delete("EDGE_CORS_ORIGINS");

  const handler = createOSHandler(
    { scopeName: "test" },
    async () => ({ ok: true }),
  );

  const a = await (await handler(
    new Request("http://localhost/test", { method: "GET" }),
  )).json();
  const b = await (await handler(
    new Request("http://localhost/test", { method: "GET" }),
  )).json();

  assertEquals(a.requestId !== b.requestId, true);
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
