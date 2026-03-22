import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";
import { verifyNeoSignature } from "../_shared/neo.ts";
import { verifyEvmSignature } from "../_shared/evm.ts";
import { signJwt } from "../_shared/jwt.ts";
import { getEnv } from "../_shared/env.ts";

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
  const { data: user } = await supabase
    .from("users")
    .select("id, nonce")
    .eq("address", address)
    .maybeSingle();

  if (!user?.id) {
    return error(404, "account not found", "NOT_FOUND", req);
  }

  // Very basic nonce verification (it must be part of the signed message)
  if (!user.nonce || !message.includes(user.nonce)) {
    return error(401, "invalid or expired nonce", "AUTH_INVALID", req);
  }

  // Clear nonce
  await supabase.from("users").update({ nonce: null }).eq("id", user.id);

  // Generate a standard Supabase-compatible JWT
  const payload = {
    role: "authenticated",
    aud: "authenticated",
    sub: user.id,
    address,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  };

  const jwtSecret = getEnv("SUPABASE_JWT_SECRET") || getEnv("NEXTAUTH_SECRET");
  if (!jwtSecret) {
    return error(500, "JWT signing not configured", "CONFIG_ERROR", req);
  }
  const token = await signJwt(payload, jwtSecret);

  return json({
    access_token: token,
    user: {
      id: user.id,
      address,
    }
  }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}