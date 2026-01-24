// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { ensureUserRow, requireUser } from "../_shared/supabase.ts";

// Nonce expires after 5 minutes (300 seconds)
const NONCE_TTL_SECONDS = 300;

// Returns a nonce + canonical message for Neo N3 wallet signature binding.
// The nonce includes a timestamp for expiration validation.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "wallet-nonce", auth);
  if (rl) return rl;

  const nonce = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + NONCE_TTL_SECONDS;
  const message =
    `Sign this message to bind your Neo N3 wallet to your account.\n\nUser: ${auth.userId}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

  // Store nonce with creation timestamp for expiration validation
  const ensured = await ensureUserRow(auth, {
    nonce,
    nonce_created_at: new Date().toISOString(),
  }, req);
  if (ensured instanceof Response) return ensured;

  return json({ nonce, message, expires_at: expiresAt, ttl_seconds: NONCE_TTL_SECONDS }, {}, req);
}

if (import.meta.main) {
  if (import.meta.main) {
  Deno.serve(handler);
}
}
