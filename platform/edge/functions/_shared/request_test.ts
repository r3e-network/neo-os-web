import { assertEquals, assertInstanceOf } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { readJsonBody } from "./request.ts";

// ---------------------------------------------------------------------------
// readJsonBody — the byte cap is enforced on the STREAM, not just the
// Content-Length header (audit low: header-only caps are trivially bypassed
// by omitting or lying about the length).
// ---------------------------------------------------------------------------

function jsonRequest(body: BodyInit, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

Deno.test("readJsonBody parses a small JSON body", async () => {
  const out = await readJsonBody(jsonRequest('{"a":1}'));
  assertEquals(out, { a: 1 });
});

Deno.test("readJsonBody rejects non-JSON content type", async () => {
  const out = await readJsonBody(jsonRequest('{"a":1}', { "content-type": "text/plain" }));
  assertInstanceOf(out, Response);
  assertEquals((out as Response).status, 415);
});

Deno.test("readJsonBody rejects over-cap declared Content-Length without reading", async () => {
  const out = await readJsonBody(jsonRequest("{}", { "content-length": "999999" }), 1024);
  assertInstanceOf(out, Response);
  assertEquals((out as Response).status, 413);
});

Deno.test("readJsonBody enforces the cap on a streamed body with NO Content-Length", async () => {
  const big = "x".repeat(4096);
  const stream = new ReadableStream({
    start(controller) {
      // Chunked delivery: no content-length header is attached by the runtime.
      controller.enqueue(new TextEncoder().encode('{"pad":"'));
      controller.enqueue(new TextEncoder().encode(big));
      controller.enqueue(new TextEncoder().encode('"}'));
      controller.close();
    },
  });
  const req = new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
  });
  const out = await readJsonBody(req, 1024);
  assertInstanceOf(out, Response);
  assertEquals((out as Response).status, 413);
});

Deno.test("readJsonBody accepts a body exactly at the cap", async () => {
  const pad = "x".repeat(1024 - 11); // {"pad":"…"} == 9 + pad + 2
  const out = await readJsonBody(jsonRequest(`{"pad":"${pad}"}`), 1024);
  assertEquals(out, { pad });
});

Deno.test("readJsonBody rejects invalid JSON with 400", async () => {
  const out = await readJsonBody(jsonRequest("{nope"));
  assertInstanceOf(out, Response);
  assertEquals((out as Response).status, 400);
});
