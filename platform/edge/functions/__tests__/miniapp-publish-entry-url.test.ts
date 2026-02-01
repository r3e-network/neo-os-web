import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";

const source = Deno.readTextFileSync(
  new URL("../miniapp-publish/index.ts", import.meta.url),
);

describe("miniapp-publish entry_url", () => {
  it("writes entry_url to submissions", () => {
    assertStringIncludes(source, "entry_url");
  });
});
