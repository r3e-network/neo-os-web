// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { encryptSecretValue } from "../_shared/secrets.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

type UpsertSecretRequest = {
  name: string;
  value: string;
};

const MAX_NAME_LEN = 128;
const MAX_VALUE_BYTES = 64 * 1024;

// Creates or updates a secret for the authenticated user.
// Values are AES-GCM encrypted with `SECRETS_MASTER_KEY` before storage.
export const handler = createHandler(
  {
    method: "POST",
    auth: "user",
    rateLimit: "secrets-upsert",
    hostScope: "secrets-upsert",
    requireWallet: true,
    ensureUser: true,
  },
  async ({ req, auth }) => {
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

    if (updateErr)
      return errorResponse("SERVER_002", { message: `failed to update secret: ${updateErr.message}` }, req);

    return json({ secret: updated, created: false }, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
