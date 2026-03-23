/**
 * Registered-script compute execution for MiniApps.
 *
 * This is the preferred direct platform path when a script body is too large to
 * inline in `compute-execute`.
 *
 * Flow:
 * 1. Host/admin caller submits `{ app_id, script_name, input }`
 * 2. Edge loads script metadata from the MiniApp manifest / CDN
 * 3. Edge forwards the resolved source to external NeoCompute
 * 4. Caller receives the direct compute result / job envelope
 */
import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { getEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireHostScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { postJSON } from "../_shared/tee.ts";
import { resolveComputeExecuteUpstream } from "../_shared/morpheus.ts";

type AppExecuteRequest = {
  app_id: string;
  script_name: string;
  input?: Record<string, unknown>;
  secret_refs?: string[];
  timeout?: number;
};

type ScriptInfo = {
  file: string;
  entry_point: string;
  description?: string;
};

type Manifest = {
  app_id: string;
  tee_scripts?: Record<string, ScriptInfo>;
};

const SCRIPTS_BASE_URL = getEnv("MINIAPP_SCRIPTS_BASE_URL") || "https://cdn.miniapps.r3e.network";

async function loadAppScript(
  appId: string,
  scriptName: string,
): Promise<{ script: string; entryPoint: string } | null> {
  try {
    const manifestUrl = `${SCRIPTS_BASE_URL}/apps/${appId}/manifest.json`;
    const manifestRes = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
    if (!manifestRes.ok) return null;

    const manifest: Manifest = await manifestRes.json();
    const scriptInfo = manifest.tee_scripts?.[scriptName];
    if (!scriptInfo || !scriptInfo.file || !/^[a-zA-Z0-9_.-]+$/.test(scriptInfo.file)) return null;

    const scriptUrl = `${SCRIPTS_BASE_URL}/apps/${appId}/${scriptInfo.file}`;
    const scriptRes = await fetch(scriptUrl, { signal: AbortSignal.timeout(10000) });
    if (!scriptRes.ok) return null;

    return {
      script: await scriptRes.text(),
      entryPoint: scriptInfo.entry_point,
    };
  } catch (err) {
    console.error("[compute-app-execute] fetchScript error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const rl = await requireRateLimit(req, "compute-app-execute", auth);
  if (rl) return rl;

  const scopeCheck = requireHostScope(req, auth, "compute-app-execute");
  if (scopeCheck) return scopeCheck;

  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const bodyOrErr = await readJsonBody<AppExecuteRequest>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const appId = String(body.app_id ?? "").trim();
  const scriptName = String(body.script_name ?? "").trim();

  if (!appId || !/^[a-zA-Z0-9_-]+$/.test(appId)) {
    return error(400, "app_id required (alphanumeric, dash, underscore only)", "APP_ID_REQUIRED", req);
  }
  if (!scriptName || !/^[a-zA-Z0-9_-]+$/.test(scriptName)) {
    return error(400, "script_name required (alphanumeric, dash, underscore only)", "SCRIPT_NAME_REQUIRED", req);
  }

  const secretRefs = Array.isArray(body.secret_refs) ? body.secret_refs.slice(0, 20) : undefined;
  if (secretRefs && !secretRefs.every((r: unknown) => typeof r === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(r))) {
    return error(400, "invalid secret_refs", "INVALID_SECRET_REFS", req);
  }

  // Load script from app manifest
  const loaded = await loadAppScript(appId, scriptName);
  if (!loaded) {
    return error(404, "script not found", "SCRIPT_NOT_FOUND", req);
  }

  // Forward to NeoCompute service
  let upstream: { url: string; authToken?: string };
  try {
    upstream = resolveComputeExecuteUpstream();
  } catch (e) {
    return error(500, e instanceof Error ? e.message : "upstream misconfigured", "UPSTREAM_ERROR", req);
  }
  const result = await postJSON(
    upstream.url,
    {
      script: loaded.script,
      entry_point: loaded.entryPoint,
      input: body.input,
      secret_refs: secretRefs,
      timeout: body.timeout,
      app_id: appId,
      script_name: scriptName,
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
