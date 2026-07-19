import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { isProductionEnv } from "./env.ts";

// ---------------------------------------------------------------------------
// isProductionEnv — fail-closed semantics (audit): production is the default;
// non-production relaxes security gates and must be declared explicitly via
// one of EDGE_ENV/DENO_ENV/ENV/NODE_ENV/SUPABASE_ENV.
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

Deno.test("isProductionEnv defaults to production when nothing is set", () => {
  withEnv({}, () => assertEquals(isProductionEnv(), true));
});

Deno.test("isProductionEnv accepts prod/production markers", () => {
  withEnv({ EDGE_ENV: "production" }, () => assertEquals(isProductionEnv(), true));
  withEnv({ NODE_ENV: "prod" }, () => assertEquals(isProductionEnv(), true));
});

Deno.test("isProductionEnv treats unrecognized values as production (fail closed)", () => {
  withEnv({ EDGE_ENV: "staging" }, () => assertEquals(isProductionEnv(), true));
  withEnv({ EDGE_ENV: "prd" }, () => assertEquals(isProductionEnv(), true));
});

Deno.test("isProductionEnv honors explicit non-production markers", () => {
  for (const marker of ["dev", "development", "local", "test"]) {
    withEnv({ EDGE_ENV: marker }, () => assertEquals(isProductionEnv(), false));
  }
});

Deno.test("isProductionEnv: a dev marker anywhere wins over prod elsewhere", () => {
  // Deliberate: one explicit non-production declaration is enough, matching
  // the previous any-match ergonomics for mixed deployments.
  withEnv({ EDGE_ENV: "production", NODE_ENV: "development" }, () =>
    assertEquals(isProductionEnv(), false));
});
