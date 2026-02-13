// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
import "../_shared/deno.d.ts";

import { mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { postJSON } from "../_shared/tee.ts";
import { createHandler } from "../_shared/handler.ts";

type OracleQueryRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  secret_name?: string;
  secret_as_key?: string;
  body?: string;
};

// Thin gateway to the NeoOracle service (/query):
// - validates auth + basic shape
// - forwards to the TEE service over optional mTLS
export const handler = createHandler(
  { method: "POST", rateLimit: "oracle-query", hostScope: "oracle-query" },
  async ({ req, auth }) => {
    let body: OracleQueryRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_JSON", undefined, req);
    }

    const url = String(body.url ?? "").trim();
    if (!url) return validationError("url", "url required", req);

    const neooracleURL = mustGetEnv("NEOORACLE_URL").replace(/\/$/, "");
    const result = await postJSON(
      `${neooracleURL}/query`,
      {
        url,
        method: body.method,
        headers: body.headers,
        secret_name: body.secret_name,
        secret_as_key: body.secret_as_key,
        body: body.body,
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
