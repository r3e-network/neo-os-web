// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { generateAPIKey, sha256Hex } from "../_shared/apikeys.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

type CreateAPIKeyRequest = {
  name: string;
  scopes?: string[];
  description?: string;
  expires_at?: string;
};

// Creates a user API key. The raw key is returned once and is never stored in plaintext.
export const handler = createHandler(
  { method: "POST", auth: "user_only", rateLimit: "api-keys-create", requireWallet: true, ensureUser: true },
  async ({ req, auth }) => {
    let body: CreateAPIKeyRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_JSON", undefined, req);
    }

    const name = String(body.name ?? "")
      .trim()
      .slice(0, 255);
    if (!name) return validationError("name", "name required", req);

    const scopes = Array.isArray(body.scopes)
      ? body.scopes
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 32)
      : [];
    const description =
      String(body.description ?? "")
        .trim()
        .slice(0, 1024) || null;

    let expiresAt: string | null = null;
    if (body.expires_at) {
      const raw = String(body.expires_at).trim();
      const parsed = Date.parse(raw);
      if (Number.isNaN(parsed)) return validationError("expires_at", "expires_at must be an ISO timestamp", req);
      expiresAt = new Date(parsed).toISOString();
    }

    const { rawKey, prefix } = generateAPIKey();
    const keyHash = await sha256Hex(rawKey);

    const supabase = supabaseServiceClient();
    const { data, error: insertErr } = await supabase
      .from("api_keys")
      .insert({
        user_id: auth.userId,
        name,
        key_hash: keyHash,
        prefix,
        scopes,
        description,
        expires_at: expiresAt,
        revoked: false,
      })
      .select("id,name,prefix,scopes,description,created_at,last_used,expires_at,revoked")
      .maybeSingle();

    if (insertErr)
      return errorResponse("SERVER_002", { message: `failed to create api key: ${insertErr.message}` }, req);

    return json(
      {
        api_key: {
          ...data,
          key: rawKey,
        },
      },
      { status: 201 },
      req
    );
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
