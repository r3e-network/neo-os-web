import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";
import { verifyNeoSignature } from "../_shared/neo.ts";
import { verifyEvmSignature } from "../_shared/evm.ts";
import { signJwt } from "../_shared/jwt.ts";
import { getEnv } from "../_shared/env.ts";

function stringField(row: unknown, key: string): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const bodyOrErr = await readJsonBody(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const { address, public_key, signature, message } = body as {
    address: string; public_key: string; signature: string; message: string;
  };

  if (!address || !signature || !message) {
    return error(400, "address, signature, message required", "INVALID_INPUT", req);
  }

  // Verify signature based on address type
  let isValid = false;
  if (address.startsWith("0x")) {
    isValid = verifyEvmSignature(address, message, signature);
  } else {
    if (!public_key) {
      return error(400, "public_key required for N3 wallets", "INVALID_INPUT", req);
    }
    isValid = verifyNeoSignature(address, message, signature, public_key);
  }

  if (!isValid) {
    return error(401, "invalid signature", "AUTH_INVALID", req);
  }

  const supabase = supabaseServiceClient();

  // Find account by wallet
  const { data: user, error: userQueryError } = await supabase
    .from("users")
    .select("id, nonce")
    .eq("address", address)
    .maybeSingle();

  if (userQueryError) {
    console.warn("[auth-wallet] user lookup failed:", userQueryError.message);
  }
  const accountId = stringField(user, "id");
  const nonce = stringField(user, "nonce");
  if (!accountId) {
    return error(404, "account not found", "NOT_FOUND", req);
  }

  // Very basic nonce verification (it must be part of the signed message)
  if (!nonce || !message.includes(nonce)) {
    return error(401, "invalid or expired nonce", "AUTH_INVALID", req);
  }

  // Audit fix C-4 / H-4: bind the signed message to the address it claims to
  // authenticate. Without this check the message-nonce binding alone was
  // structurally fragile (a victim's `users.nonce` could be overwritten via
  // unauthenticated calls to auth-wallet-nonce, and only the nonce — not the
  // address — was required to be part of the signed payload).
  if (!message.includes(address)) {
    return error(401, "address not present in signed message", "AUTH_INVALID", req);
  }

  // Clear nonce
  const { error: nonceClearError } = await supabase.from("users").update({ nonce: null }).eq("id", accountId);
  if (nonceClearError) {
    console.warn("[auth-wallet] failed to clear nonce for user", accountId, nonceClearError.message);
  }

  // Generate a standard Supabase-compatible JWT
  const payload = {
    role: "authenticated",
    aud: "authenticated",
    sub: accountId,
    address,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  };

  // Audit fix H-5: drop the NEXTAUTH_SECRET fallback. The Supabase JWT secret
  // and the NextAuth signing secret have different rotation policies and
  // different blast radii; sharing material between them widens the
  // forgery surface for no real benefit. If SUPABASE_JWT_SECRET is missing
  // we fail closed.
  const jwtSecret = getEnv("SUPABASE_JWT_SECRET");
  if (!jwtSecret) {
    return error(500, "JWT signing not configured", "CONFIG_ERROR", req);
  }
  const token = await signJwt(payload, jwtSecret);

  return json({
    access_token: token,
    user: {
      id: accountId,
      address,
    }
  }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
