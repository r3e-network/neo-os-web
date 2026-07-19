import { assertEquals, assertInstanceOf } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { requireScopes } from "./scopes.ts";
import type { AuthContext } from "./supabase.ts";

// ---------------------------------------------------------------------------
// requireScopes — scope-less legacy API keys must not inherit full access in
// production (audit low): an endpoint declaring required scopes rejects them
// there; outside production they keep the legacy full-access default.
// ---------------------------------------------------------------------------

const ENV_VARS = ["EDGE_ENV", "DENO_ENV", "ENV", "NODE_ENV", "SUPABASE_ENV"];

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const saved = ENV_VARS.map((name) => [name, Deno.env.get(name)] as const);
  try {
    for (const name of ENV_VARS) Deno.env.delete(name);
    for (const [name, value] of Object.entries(values)) {
      if (value !== undefined) Deno.env.set(name, value);
    }
    fn();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
}

const req = new Request("http://localhost/x", { method: "POST" });
const keyAuth = (scopes: string[] | undefined): AuthContext =>
  ({ authType: "api_key", scopes } as unknown as AuthContext);

Deno.test("requireScopes: scoped key passes when it covers the requirement", () => {
  withEnv({ EDGE_ENV: "production" }, () => {
    assertEquals(requireScopes(req, keyAuth(["pay-gas"]), ["pay-gas"]), null);
    assertEquals(requireScopes(req, keyAuth(["*"]), ["pay-gas"]), null);
  });
});

Deno.test("requireScopes: scoped key is rejected when missing the requirement", () => {
  withEnv({ EDGE_ENV: "production" }, () => {
    const out = requireScopes(req, keyAuth(["other"]), ["pay-gas"]);
    assertInstanceOf(out, Response);
    assertEquals((out as Response).status, 403);
  });
});

Deno.test("requireScopes: scope-less legacy key is rejected in production", () => {
  withEnv({ EDGE_ENV: "production" }, () => {
    const out = requireScopes(req, keyAuth([]), ["pay-gas"]);
    assertInstanceOf(out, Response);
    assertEquals((out as Response).status, 403);
  });
});

Deno.test("requireScopes: scope-less legacy key keeps full access outside production", () => {
  withEnv({ EDGE_ENV: "development" }, () => {
    assertEquals(requireScopes(req, keyAuth([]), ["pay-gas"]), null);
  });
});

Deno.test("requireScopes: non-api_key auth is not gated here", () => {
  withEnv({ EDGE_ENV: "production" }, () => {
    const bearer = { authType: "bearer", scopes: [] } as unknown as AuthContext;
    assertEquals(requireScopes(req, bearer, ["pay-gas"]), null);
  });
});
