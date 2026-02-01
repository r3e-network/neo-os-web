import { getChains } from "./chains.ts";

Deno.test("chains config is neo-only", () => {
  const ids = getChains().map((c) => c.id);
  if (ids.some((id) => !id.startsWith("neo-n3"))) {
    throw new Error("non-neo chain present");
  }
});
