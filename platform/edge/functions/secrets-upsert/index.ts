// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { encryptSecretValue } from "../_shared/secrets.ts";
import { requireHostScope } from "../_shared/scopes.ts";
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

type UpsertSecretRequest = {
  name: string;
  value: string;
};

const MAX_NAME_LEN = 128;
const MAX_VALUE_BYTES = 64 * 1024;

// Creates or updates a secret for the authenticated user.
// Values are AES-GCM encrypted with `SECRETS_MASTER_KEY` before storage.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "secrets-upsert", auth);
  if (rl) return rl;
  const scopeCheck = requireHostScope(req, auth, "secrets-upsert");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth, {}, req);
  if (ensured instanceof Response) return ensured;

  let body: UpsertSecretRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const name = String(body.name ?? "").trim();
  const value = String(body.value ?? "");
  if (!name) return validationError("name", "name required", req);
  if (!value) return validationError("value", "value required", req);
  if (name.length > MAX_NAME_LEN) return validationError("name", "name too long", req);
  if (new TextEncoder().encode(value).length > MAX_VALUE_BYTES) {
    return validationError("value", "value too large", req);
  }

  const encryptedBase64 = await encryptSecretValue(value);

  const supabase = supabaseServiceClient();

  const { data: existing, error: getErr } = await supabase
    .from("secrets")
    .select("id,version")
    .eq("user_id", auth.userId)
    .eq("name", name)
    .limit(1);
  if (getErr) return errorResponse("SERVER_002", { message: `failed to load secret: ${getErr.message}` }, req);

  const isCreate = !existing || existing.length === 0;

  if (isCreate) {
    const { data: inserted, error: insertErr } = await supabase
      .from("secrets")
      .insert({
        user_id: auth.userId,
        name,
        encrypted_value: encryptedBase64,
        version: 1,
      })
      .select("id,name,version,created_at,updated_at")
      .maybeSingle();

    if (insertErr)
      return errorResponse("SERVER_002", { message: `failed to create secret: ${insertErr.message}` }, req);

    // Reset permissions on create (best-effort).
    await supabase.from("secret_policies").delete().eq("user_id", auth.userId).eq("secret_name", name);

    return json({ secret: inserted, created: true }, {}, req);
  }

  const currentVersion = Number(existing[0]?.version ?? 0);
  const nextVersion = Number.isFinite(currentVersion) && currentVersion > 0 ? currentVersion + 1 : 1;

  const { data: updated, error: updateErr } = await supabase
    .from("secrets")
    .update({ encrypted_value: encryptedBase64, version: nextVersion })
    .eq("user_id", auth.userId)
    .eq("name", name)
    .select("id,name,version,created_at,updated_at")
    .maybeSingle();

  if (updateErr) return errorResponse("SERVER_002", { message: `failed to update secret: ${updateErr.message}` }, req);

  return json({ secret: updated, created: false }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
