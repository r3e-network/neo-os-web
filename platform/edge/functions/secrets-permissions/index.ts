// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

type SetPermissionsRequest = {
  name: string;
  services: string[];
};

const MAX_SERVICES = 16;

// Replaces the allowed service list for a secret (per-user).
export const handler = createHandler(
  {
    method: "POST",
    auth: "user",
    rateLimit: "secrets-permissions",
    hostScope: "secrets-permissions",
    requireWallet: true,
    ensureUser: true,
  },
  async ({ req, auth }) => {
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
);

if (import.meta.main) {
  Deno.serve(handler);
}
