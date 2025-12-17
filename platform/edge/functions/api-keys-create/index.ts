import { handleCorsPreflight } from "../_shared/cors.ts";
import { generateAPIKey, sha256Hex } from "../_shared/apikeys.ts";
import { error, json } from "../_shared/response.ts";
import { ensureUserRow, requirePrimaryWallet, requireUser, supabaseServiceClient } from "../_shared/supabase.ts";

type CreateAPIKeyRequest = {
  name: string;
  scopes?: string[];
  description?: string;
  expires_at?: string;
};

// Creates a user API key. The raw key is returned once and is never stored in plaintext.
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const walletCheck = await requirePrimaryWallet(auth.userId);
  if (walletCheck instanceof Response) return walletCheck;

  let body: CreateAPIKeyRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON");
  }

  const name = String(body.name ?? "").trim().slice(0, 255);
  if (!name) return error(400, "name required", "NAME_REQUIRED");

  const scopes = Array.isArray(body.scopes) ? body.scopes.map((s) => String(s).trim()).filter(Boolean).slice(0, 32) : [];
  const description = String(body.description ?? "").trim().slice(0, 1024) || null;

  let expiresAt: string | null = null;
  if (body.expires_at) {
    const raw = String(body.expires_at).trim();
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) return error(400, "expires_at must be an ISO timestamp", "EXPIRES_AT_INVALID");
    expiresAt = new Date(parsed).toISOString();
  }

  const ensured = await ensureUserRow(auth);
  if (ensured instanceof Response) return ensured;

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

  if (insertErr) return error(500, `failed to create api key: ${insertErr.message}`, "DB_ERROR");

  return json({
    api_key: {
      ...(data as any),
      key: rawKey,
    },
  }, { status: 201 });
});

