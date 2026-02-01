import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { requireScopes } from "./scopes.ts";

Deno.test("requireScopes blocks wildcard in production", () => {
  Deno.env.set("DENO_ENV", "production");
  Deno.env.set("EDGE_CORS_ORIGINS", "http://localhost");
  const res = requireScopes(
    new Request("http://localhost"),
    { userId: "u", authType: "api_key", scopes: ["*"] },
    ["foo"],
  );
  assertEquals(res?.status, 403);
});
