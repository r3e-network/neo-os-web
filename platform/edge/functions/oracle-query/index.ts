import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireHostScope } from "../_shared/scopes.ts";
import { requireAuth } from "../_shared/supabase.ts";
import { postJSON } from "../_shared/tee.ts";
import { resolveOracleQueryUpstream } from "../_shared/morpheus.ts";

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
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "oracle-query", auth);
  if (rl) return rl;
  const scopeCheck = requireHostScope(req, auth, "oracle-query");
  if (scopeCheck) return scopeCheck;

  const bodyOrErr = await readJsonBody<OracleQueryRequest>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const url = String(body.url ?? "").trim();
  if (!url) return error(400, "url required", "URL_REQUIRED", req);

  // Validate URL protocol to prevent SSRF with non-HTTP schemes
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return error(400, "invalid url", "INVALID_URL", req);
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return error(400, "url must use http or https", "INVALID_URL_SCHEME", req);
  }
  const host = parsedUrl.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]" ||
      host === "0.0.0.0" || host.endsWith(".local") || host === "169.254.169.254" ||
      host.startsWith("10.") || host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return error(400, "private/internal URLs not allowed", "INVALID_URL_HOST", req);
  }

  const secretNameRe = /^[a-zA-Z0-9_-]{1,128}$/;
  if (body.secret_name && !secretNameRe.test(body.secret_name)) {
    return error(400, "invalid secret_name", "INVALID_SECRET_NAME", req);
  }
  if (body.secret_as_key && !secretNameRe.test(body.secret_as_key)) {
    return error(400, "invalid secret_as_key", "INVALID_SECRET_AS_KEY", req);
  }

  let upstream: { url: string; authToken?: string };
  try {
    upstream = resolveOracleQueryUpstream();
  } catch (e) {
    return error(500, e instanceof Error ? e.message : "upstream misconfigured", "UPSTREAM_ERROR", req);
  }
  const result = await postJSON(
    upstream.url,
    {
      url,
      method: body.method,
      headers: body.headers,
      secret_name: body.secret_name,
      secret_as_key: body.secret_as_key,
      body: body.body,
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
