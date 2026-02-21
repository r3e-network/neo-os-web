import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { ensureUserRow, requireUser } from "../_shared/supabase.ts";

// Returns a nonce + canonical message for Neo N3 wallet signature binding.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "wallet-nonce", auth);
  if (rl) return rl;

  const nonce = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const message =
    `Sign this message to bind your Neo N3 wallet to your account.\n\nUser: ${auth.userId}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
  const ensured = await ensureUserRow(auth, { nonce }, req);
  if (ensured instanceof Response) return ensured;

  return json({ nonce, message }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
