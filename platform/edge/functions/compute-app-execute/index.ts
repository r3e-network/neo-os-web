/**
 * @deprecated This endpoint is deprecated for MiniApp use.
 *
 * MiniApps should NOT call this endpoint directly from the frontend.
 * Instead, use the on-chain service request flow:
 *
 * 1. MiniApp contract calls ServiceLayerGateway.RequestService()
 *    - appId: your app ID
 *    - serviceType: "compute"
 *    - payload: JSON with { "script_name": "your-script", "input": {...} }
 *    - callbackContract: your contract address
 *    - callbackMethod: "onComputeCallback"
 *
 * 2. Off-chain service listener detects the ServiceRequested event
 * 3. Service loads script from manifest by appId and script_name
 * 4. Script executes in TEE (Trusted Execution Environment)
 * 5. ServiceLayerGateway.FulfillRequest() calls back to your contract
 *
 * This endpoint remains available for:
 * - Internal testing and debugging
 * - Admin tools that need direct compute access
 * - Legacy integrations (will be removed in future versions)
 */
import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireHostScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { postJSON } from "../_shared/tee.ts";

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

const SCRIPTS_BASE_URL = Deno.env.get("MINIAPP_SCRIPTS_BASE_URL") || "https://cdn.miniapps.neo.org";

async function loadAppScript(
  appId: string,
  scriptName: string,
): Promise<{ script: string; entryPoint: string } | null> {
  try {
    const manifestUrl = `${SCRIPTS_BASE_URL}/apps/${appId}/manifest.json`;
    const manifestRes = await fetch(manifestUrl);
    if (!manifestRes.ok) return null;

    const manifest: Manifest = await manifestRes.json();
    const scriptInfo = manifest.tee_scripts?.[scriptName];
    if (!scriptInfo) return null;

    const scriptUrl = `${SCRIPTS_BASE_URL}/apps/${appId}/${scriptInfo.file}`;
    const scriptRes = await fetch(scriptUrl);
    if (!scriptRes.ok) return null;

    return {
      script: await scriptRes.text(),
      entryPoint: scriptInfo.entry_point,
    };
  } catch {
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

  let body: AppExecuteRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON", req);
  }

  const appId = String(body.app_id ?? "").trim();
  const scriptName = String(body.script_name ?? "").trim();

  if (!appId) {
    return error(400, "app_id required", "APP_ID_REQUIRED", req);
  }
  if (!scriptName) {
    return error(400, "script_name required", "SCRIPT_NAME_REQUIRED", req);
  }

  // Load script from app manifest
  const loaded = await loadAppScript(appId, scriptName);
  if (!loaded) {
    return error(404, "script not found", "SCRIPT_NOT_FOUND", req);
  }

  // Forward to NeoCompute service
  const neocomputeURL = mustGetEnv("NEOCOMPUTE_URL").replace(/\/$/, "");
  const result = await postJSON(
    `${neocomputeURL}/execute`,
    {
      script: loaded.script,
      entry_point: loaded.entryPoint,
      input: body.input,
      secret_refs: body.secret_refs,
      timeout: body.timeout,
      app_id: appId,
      script_name: scriptName,
    },
    { "X-User-ID": auth.userId },
    req,
  );

  if (result instanceof Response) return result;
  return json(result, {}, req);
}
