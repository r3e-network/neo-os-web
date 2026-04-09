import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handleCorsPreflight, withCors } from "./cors.ts";

Deno.test("cors: rejects preflight when EDGE_CORS_ORIGINS is unset", () => {
  Deno.env.delete("EDGE_CORS_ORIGINS");
  const res = handleCorsPreflight(
    new Request("http://localhost/test", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  assertEquals(res?.status, 403);
});

Deno.test("cors: does not set wildcard origin when EDGE_CORS_ORIGINS is unset", () => {
  Deno.env.delete("EDGE_CORS_ORIGINS");
  const headers = withCors(
    {},
    new Request("http://localhost/test", {
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  assertEquals(headers.get("Access-Control-Allow-Origin"), null);
});

Deno.test("cors: echoes explicitly allowed origin", () => {
  Deno.env.set("EDGE_CORS_ORIGINS", "http://localhost:3000");
  const headers = withCors(
    {},
    new Request("http://localhost/test", {
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  assertEquals(headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
  assertEquals(headers.get("Vary"), "Origin");
});

Deno.test("cors: does not echo disallowed origin", () => {
  Deno.env.set("EDGE_CORS_ORIGINS", "http://localhost:3000");
  const headers = withCors(
    {},
    new Request("http://localhost/test", {
      headers: { Origin: "http://evil.com" },
    }),
  );
  assertEquals(headers.get("Access-Control-Allow-Origin"), null);
});

Deno.test("cors: preflight succeeds for allowed origin", () => {
  Deno.env.set("EDGE_CORS_ORIGINS", "http://localhost:3000");
  const res = handleCorsPreflight(
    new Request("http://localhost/test", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  assertEquals(res?.status, 204);
  assertEquals(res?.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
});
