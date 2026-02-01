import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";

const sql = Deno.readTextFileSync(
  new URL("../../../../supabase/migrations/20260125000001_add_manual_publish_fields.sql", import.meta.url),
);

describe("miniapp submissions manual publish migration", () => {
  it("adds manual publish columns", () => {
    assertStringIncludes(sql, "entry_url");
    assertStringIncludes(sql, "assets_selected");
    assertStringIncludes(sql, "build_started_at");
    assertStringIncludes(sql, "build_mode");
  });
});
