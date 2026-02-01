// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { generateAPIKey, sha256Hex } from "../_shared/apikeys.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { ensureUserRow, requirePrimaryWallet, requireUser, supabaseServiceClient } from "../_shared/supabase.ts";

type CreateAPIKeyRequest = {
  name: string;
  scopes?: string[];
  description?: string;
  expires_at?: string;
};

// Creates a user API key. The raw key is returned once and is never stored in plaintext.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "api-keys-create", auth);
  if (rl) return rl;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

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

  const ensured = await ensureUserRow(auth, {}, req);
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

  if (insertErr) return errorResponse("SERVER_002", { message: `failed to create api key: ${insertErr.message}` }, req);

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

if (import.meta.main) {
  Deno.serve(handler);
}
