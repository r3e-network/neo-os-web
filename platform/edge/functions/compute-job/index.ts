// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { validationError } from "../_shared/error-codes.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { getJSON } from "../_shared/tee.ts";

// Thin gateway to the NeoCompute service (/jobs/{id}).
// Uses query param `?id=<job_id>` for portability across Edge deployments.
export const handler = createHandler(
  { method: "GET", auth: "user", rateLimit: "compute-job", hostScope: "compute-job", requireWallet: true },
  async ({ req, url, auth }) => {
    const jobId = (url.searchParams.get("id") ?? "").trim();
    if (!jobId) return validationError("id", "id required", req);

    const neocomputeURL = mustGetEnv("NEOCOMPUTE_URL").replace(/\/$/, "");
    const result = await getJSON(
      `${neocomputeURL}/jobs/${encodeURIComponent(jobId)}`,
      { "X-User-ID": auth.userId },
      req
    );
    if (result instanceof Response) return result;
    return json(result, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
