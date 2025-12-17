import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { ensureUserRow, requireUser, supabaseServiceClient } from "../_shared/supabase.ts";

type SetPermissionsRequest = {
  name: string;
  services: string[];
};

const MAX_SERVICES = 16;

// Replaces the allowed service list for a secret (per-user).
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const ensured = await ensureUserRow(auth);
  if (ensured instanceof Response) return ensured;

  let body: SetPermissionsRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON");
  }

  const name = String(body.name ?? "").trim();
  if (!name) return error(400, "name required", "NAME_REQUIRED");

  const rawServices = Array.isArray(body.services) ? body.services : [];
  const services = rawServices.map((s) => String(s ?? "").trim()).filter(Boolean);
  if (services.length > MAX_SERVICES) return error(400, "too many services", "SERVICES_INVALID");

  const supabase = supabaseServiceClient();

  // Ensure secret exists (prevents dangling permissions).
  const { data: secretRows, error: secretErr } = await supabase
    .from("secrets")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("name", name)
    .limit(1);
  if (secretErr) return error(500, `failed to load secret: ${secretErr.message}`, "DB_ERROR");
  if (!secretRows || secretRows.length === 0) return error(404, "secret not found", "NOT_FOUND");

  // Replace policies.
  const { error: delErr } = await supabase
    .from("secret_policies")
    .delete()
    .eq("user_id", auth.userId)
    .eq("secret_name", name);
  if (delErr) return error(500, `failed to delete policies: ${delErr.message}`, "DB_ERROR");

  if (services.length > 0) {
    const rows = services.map((svc) => ({
      user_id: auth.userId,
      secret_name: name,
      service_id: svc,
    }));

    const { error: insErr } = await supabase.from("secret_policies").insert(rows);
    if (insErr) return error(500, `failed to create policies: ${insErr.message}`, "DB_ERROR");
  }

  return json({ status: "ok", services });
});

