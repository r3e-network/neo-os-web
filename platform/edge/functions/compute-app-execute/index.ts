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

// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { postJSON } from "../_shared/tee.ts";

type AppExecuteRequest = {
  app_id: string;
  script_name: string;
  input?: Record<string, unknown>;
  secret_refs?: string[];
  timeout?: number;
};

// SECURITY: Maximum limits to prevent DoS attacks
const MAX_SCRIPT_SIZE = 1024 * 1024; // 1MB max script size
const MAX_TIMEOUT_SECONDS = 30; // Maximum 30 seconds execution
const MIN_TIMEOUT_SECONDS = 1; // Minimum 1 second
const MAX_SECRET_REFS = 10; // Maximum 10 secrets per request

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
  scriptName: string
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

export const handler = createHandler(
  {
    method: "POST",
    auth: "user",
    rateLimit: "compute-app-execute",
    hostScope: "compute-app-execute",
    requireWallet: true,
  },
  async ({ req, auth }) => {
    let body: AppExecuteRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_JSON", undefined, req);
    }

    const appId = String(body.app_id ?? "").trim();
    const scriptName = String(body.script_name ?? "").trim();

    if (!appId) return validationError("app_id", "app_id required", req);
    if (!scriptName) return validationError("script_name", "script_name required", req);

    // Load script from app manifest
    const loaded = await loadAppScript(appId, scriptName);
    if (!loaded) return notFoundError("script", req);

    // SECURITY: Validate script size to prevent DoS
    const scriptSize = new TextEncoder().encode(loaded.script).length;
    if (scriptSize > MAX_SCRIPT_SIZE) {
      return validationError(
        "script",
        `script too large (${(scriptSize / 1024).toFixed(1)}KB / ${MAX_SCRIPT_SIZE / 1024}KB limit)`,
        req
      );
    }

    // SECURITY: Validate timeout to prevent long-running requests
    if (body.timeout !== undefined) {
      if (body.timeout < MIN_TIMEOUT_SECONDS || body.timeout > MAX_TIMEOUT_SECONDS) {
        return validationError("timeout", `timeout must be ${MIN_TIMEOUT_SECONDS}-${MAX_TIMEOUT_SECONDS} seconds`, req);
      }
    }

    // SECURITY: Validate secret_refs count to prevent excessive secret access
    if (body.secret_refs && body.secret_refs.length > MAX_SECRET_REFS) {
      return validationError("secret_refs", `maximum ${MAX_SECRET_REFS} secrets allowed`, req);
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
      req
    );

    if (result instanceof Response) return result;
    return json(result, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
