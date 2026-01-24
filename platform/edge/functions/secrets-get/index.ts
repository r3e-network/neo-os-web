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
import { decryptSecretValue } from "../_shared/secrets.ts";
import { requireHostScope } from "../_shared/scopes.ts";
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

// Returns the decrypted secret value for the authenticated user.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "secrets-get", auth);
  if (rl) return rl;
  const scopeCheck = requireHostScope(req, auth, "secrets-get");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth, {}, req);
  if (ensured instanceof Response) return ensured;

  const url = new URL(req.url);
  const name = (url.searchParams.get("name") ?? "").trim();
  if (!name) return validationError("name", "name required", req);

  const supabase = supabaseServiceClient();
  const { data, error: getErr } = await supabase
    .from("secrets")
    .select("name,encrypted_value,version")
    .eq("user_id", auth.userId)
    .eq("name", name)
    .limit(1);

  if (getErr) return errorResponse("SERVER_002", { message: `failed to load secret: ${getErr.message}` }, req);
  if (!data || data.length === 0) return notFoundError("secret", req);

  const encryptedBase64 = String(data[0]?.encrypted_value ?? "").trim();
  if (!encryptedBase64) return errorResponse("SERVER_002", { message: "secret stored without ciphertext" }, req);

  let value: string;
  try {
    value = await decryptSecretValue(encryptedBase64);
  } catch (e) {
    return errorResponse("SERVER_001", { message: `failed to decrypt secret: ${(e as Error).message}` }, req);
  }

  return json(
    {
      name: String(data[0]?.name ?? name),
      value,
      version: data[0]?.version ?? 0,
    },
    {},
    req
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
