import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { isAutoApprovedInternalRepo } from "../miniapp-submit/internal-approval.ts";

describe("internal auto approve", () => {
  it("auto-approves r3e-network/miniapps", () => {
    assertEquals(isAutoApprovedInternalRepo("https://github.com/r3e-network/miniapps"), true);
  });

  it("does not auto-approve other repos", () => {
    assertEquals(isAutoApprovedInternalRepo("https://github.com/unknown/repo"), false);
  });
});
