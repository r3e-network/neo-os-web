// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { getJSON } from "../_shared/tee.ts";

// Thin gateway to the NeoCompute service (/jobs).
export const handler = createHandler(
  { method: "GET", auth: "user", rateLimit: "compute-jobs", hostScope: "compute-jobs", requireWallet: true },
  async ({ req, auth }) => {
    const neocomputeURL = mustGetEnv("NEOCOMPUTE_URL").replace(/\/$/, "");
    const result = await getJSON(`${neocomputeURL}/jobs`, { "X-User-ID": auth.userId }, req);
    if (result instanceof Response) return result;
    return json(result, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
