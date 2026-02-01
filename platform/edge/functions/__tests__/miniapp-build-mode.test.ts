import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { canTriggerBuild } from "../_shared/miniapps/build-mode.ts";

describe("build mode", () => {
  it("blocks manual submissions", () => {
    assertEquals(canTriggerBuild("manual"), false);
  });

  it("allows platform submissions", () => {
    assertEquals(canTriggerBuild("platform"), true);
  });
});
