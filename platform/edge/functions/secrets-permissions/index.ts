// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireHostScope } from "../_shared/scopes.ts";
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

type SetPermissionsRequest = {
  name: string;
  services: string[];
};

const MAX_SERVICES = 16;

// Replaces the allowed service list for a secret (per-user).
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "secrets-permissions", auth);
  if (rl) return rl;
  const scopeCheck = requireHostScope(req, auth, "secrets-permissions");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth, {}, req);
  if (ensured instanceof Response) return ensured;

  let body: SetPermissionsRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const name = String(body.name ?? "").trim();
  if (!name) return validationError("name", "name required", req);

  const rawServices = Array.isArray(body.services) ? body.services : [];
  const services = rawServices.map((s) => String(s ?? "").trim()).filter(Boolean);
  if (services.length > MAX_SERVICES) return validationError("services", "too many services", req);

  const supabase = supabaseServiceClient();

  // Ensure secret exists (prevents dangling permissions).
  const { data: secretRows, error: secretErr } = await supabase
    .from("secrets")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("name", name)
    .limit(1);
  if (secretErr) return errorResponse("SERVER_002", { message: `failed to load secret: ${secretErr.message}` }, req);
  if (!secretRows || secretRows.length === 0) return notFoundError("secret", req);

  // Replace policies.
  const { error: delErr } = await supabase
    .from("secret_policies")
    .delete()
    .eq("user_id", auth.userId)
    .eq("secret_name", name);
  if (delErr) return errorResponse("SERVER_002", { message: `failed to delete policies: ${delErr.message}` }, req);

  if (services.length > 0) {
    const rows = services.map((svc) => ({
      user_id: auth.userId,
      secret_name: name,
      service_id: svc,
    }));

    const { error: insErr } = await supabase.from("secret_policies").insert(rows);
    if (insErr) return errorResponse("SERVER_002", { message: `failed to create policies: ${insErr.message}` }, req);
  }

  return json({ status: "ok", services }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
