import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";

const buildSource = Deno.readTextFileSync(
  new URL("../miniapp-build/index.ts", import.meta.url),
);
const approveSource = Deno.readTextFileSync(
  new URL("../miniapp-approve/index.ts", import.meta.url),
);

describe("miniapp build/approve wiring", () => {
  it("checks build_mode in miniapp-build", () => {
    assertStringIncludes(buildSource, "build_mode");
  });

  it("writes miniapp_approval_audit", () => {
    assertStringIncludes(approveSource, "miniapp_approval_audit");
  });
});
