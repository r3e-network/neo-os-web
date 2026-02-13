// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { postJSON } from "../_shared/tee.ts";

type ComputeExecuteRequest = {
  script: string;
  entry_point?: string;
  input?: Record<string, unknown>;
  secret_refs?: string[];
  timeout?: number;
};

// SECURITY: Maximum limits to prevent DoS attacks
const MAX_SCRIPT_SIZE = 1024 * 1024; // 1MB max script size
const MAX_TIMEOUT_SECONDS = 30; // Maximum 30 seconds execution
const MIN_TIMEOUT_SECONDS = 1; // Minimum 1 second
const MAX_SECRET_REFS = 10; // Maximum 10 secrets per request

// Thin gateway to the NeoCompute service (/execute):
// - validates auth + wallet binding + basic shape
// - forwards to the TEE service over optional mTLS
export const handler = createHandler(
  { method: "POST", auth: "user", rateLimit: "compute-execute", hostScope: "compute-execute", requireWallet: true },
  async ({ req, auth }) => {
    let body: ComputeExecuteRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_JSON", undefined, req);
    }

    const script = String(body.script ?? "").trim();
    if (!script) return validationError("script", "script required", req);

    // SECURITY: Validate script size to prevent DoS
    const scriptSize = new TextEncoder().encode(script).length;
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

    const neocomputeURL = mustGetEnv("NEOCOMPUTE_URL").replace(/\/$/, "");
    const result = await postJSON(
      `${neocomputeURL}/execute`,
      {
        script,
        entry_point: body.entry_point,
        input: body.input,
        secret_refs: body.secret_refs,
        timeout: body.timeout,
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
