import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { error, json } from "./response.ts";

// ---------------------------------------------------------------------------
// error() — backward-compatible shape without a correlation id
// ---------------------------------------------------------------------------

Deno.test("error without correlationId keeps the legacy { error: { code, message } } shape", async () => {
  const res = error(400, "bad input", "BAD_INPUT");
  assertEquals(res.status, 400);

  const body = await res.json();
  assertEquals(body.error.code, "BAD_INPUT");
  assertEquals(body.error.message, "bad input");
  // No correlation id => no additive fields.
  assertEquals("requestId" in body, false);
  assertEquals("requestId" in body.error, false);
});

Deno.test("error defaults code to ERROR", async () => {
  const res = error(500, "boom");
  const body = await res.json();
  assertEquals(body.error.code, "ERROR");
  assertEquals(body.error.message, "boom");
});

// ---------------------------------------------------------------------------
// error() — additive correlation id
// ---------------------------------------------------------------------------

Deno.test("error with correlationId echoes it at top level and inside error", async () => {
  const cid = "11111111-2222-3333-4444-555555555555";
  const res = error(502, "rpc failed", "RPC_ERROR", undefined, cid);
  assertEquals(res.status, 502);

  const body = await res.json();
  assertEquals(body.requestId, cid);
  assertEquals(body.error.requestId, cid);
  // Legacy fields still present and unchanged.
  assertEquals(body.error.code, "RPC_ERROR");
  assertEquals(body.error.message, "rpc failed");
});

Deno.test("error with empty-string correlationId is treated as absent (no additive fields)", async () => {
  const res = error(404, "missing", "NOT_FOUND", undefined, "");
  const body = await res.json();
  assertEquals("requestId" in body, false);
  assertEquals("requestId" in body.error, false);
});

// ---------------------------------------------------------------------------
// json() — security headers preserved (regression guard)
// ---------------------------------------------------------------------------

Deno.test("json sets content-type and hardening headers", () => {
  const res = json({ ok: true });
  assertEquals(res.headers.get("Content-Type"), "application/json; charset=utf-8");
  assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
  assertEquals(res.headers.get("X-Frame-Options"), "DENY");
});
