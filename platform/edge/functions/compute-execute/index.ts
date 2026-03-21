import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireHostScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { postJSON } from "../_shared/tee.ts";
import { resolveComputeExecuteUpstream } from "../_shared/morpheus.ts";

type ComputeExecuteRequest = {
  script: string;
  entry_point?: string;
  input?: Record<string, unknown>;
  secret_refs?: string[];
  timeout?: number;
};

// Thin gateway to the NeoCompute service (/execute):
// - validates auth + wallet binding + basic shape
// - forwards to the TEE service over optional mTLS
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "compute-execute", auth);
  if (rl) return rl;
  const scopeCheck = requireHostScope(req, auth, "compute-execute");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const bodyOrErr = await readJsonBody<ComputeExecuteRequest>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const script = String(body.script ?? "").trim();
  if (!script) return error(400, "script required", "SCRIPT_REQUIRED", req);
  if (script.length > 1024 * 1024) return error(400, "script too large (max 1MB)", "SCRIPT_TOO_LARGE", req);
  const timeout = Math.min(Math.max(Number(body.timeout) || 30, 1), 60);

  const secretRefs = Array.isArray(body.secret_refs) ? body.secret_refs.slice(0, 20) : undefined;
  if (secretRefs && !secretRefs.every((r: unknown) => typeof r === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(r))) {
    return error(400, "invalid secret_refs", "INVALID_SECRET_REFS", req);
  }

  const entryPoint = String(body.entry_point ?? "").trim() || undefined;
  if (entryPoint && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(entryPoint)) {
    return error(400, "entry_point must be a valid identifier", "INVALID_ENTRY_POINT", req);
  }

  const upstream = resolveComputeExecuteUpstream();
  const result = await postJSON(
    upstream.url,
    {
      script,
      entry_point: entryPoint,
      input: body.input,
      secret_refs: secretRefs,
      timeout,
    },
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
