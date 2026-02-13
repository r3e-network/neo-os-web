// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireHostScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { getJSON } from "../_shared/tee.ts";

// Thin gateway to the NeoCompute service (/jobs/{id}).
// Uses query param `?id=<job_id>` for portability across Edge deployments.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "compute-job", auth);
  if (rl) return rl;
  const scopeCheck = requireHostScope(req, auth, "compute-job");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const url = new URL(req.url);
  const jobId = (url.searchParams.get("id") ?? "").trim();
  if (!jobId) return validationError("id", "id required", req);

  try {
    const neocomputeURL = mustGetEnv("NEOCOMPUTE_URL").replace(/\/$/, "");
    const result = await getJSON(
      `${neocomputeURL}/jobs/${encodeURIComponent(jobId)}`,
      {
        "X-User-ID": auth.userId,
      },
      req
    );
    if (result instanceof Response) return result;
    return json(result, {}, req);
  } catch (err) {
    console.error("Compute job error:", err);
    return errorResponse("SERVER_001", { message: (err as Error).message }, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
