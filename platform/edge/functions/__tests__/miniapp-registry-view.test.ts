import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assert, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";

const sql = Deno.readTextFileSync(
  new URL("../../../../supabase/migrations/20260125000002_update_miniapp_registry_view.sql", import.meta.url),
);

describe("miniapp registry view", () => {
  it("unions internal apps", () => {
    assert(sql.includes("miniapp_internal"));
  });

  it("prefers assets_selected", () => {
    assertStringIncludes(sql, "assets_selected");
  });

  it("uses entry_url for external apps", () => {
    assertStringIncludes(sql, "entry_url");
  });
});
