import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireHostScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { getJSON } from "../_shared/tee.ts";
import { resolveComputeExecuteUpstream } from "../_shared/morpheus.ts";

// Thin gateway to the NeoCompute service (/jobs).
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "compute-jobs", auth);
  if (rl) return rl;
  const scopeCheck = requireHostScope(req, auth, "compute-jobs");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const upstream = resolveComputeExecuteUpstream();
  const jobsUrl = upstream.url.replace(/\/execute$/, "/jobs");
  const result = await getJSON(
    jobsUrl,
    {
      "X-User-ID": auth.userId,
      ...(upstream.authToken ? { Authorization: `Bearer ${upstream.authToken}` } : {}),
      ...(upstream.authToken ? { "x-phala-token": upstream.authToken } : {}),
    },
    req,
  );
  if (result instanceof Response) return result;
  return json(result, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
