import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireUser, supabaseServiceClient } from "../_shared/supabase.ts";

// Returns a nonce + canonical message for Neo N3 wallet signature binding.
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const nonce = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const message =
    `Sign this message to bind your Neo N3 wallet to your account.\n\nUser: ${auth.userId}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

  const supabase = supabaseServiceClient();

  // Ensure a corresponding public.users row exists (legacy schema used by this repo).
  const { error: upsertErr } = await supabase
    .from("users")
    .upsert({ id: auth.userId, email: auth.email ?? null, nonce }, { onConflict: "id" });
  if (upsertErr) return error(500, `failed to persist nonce: ${upsertErr.message}`, "DB_ERROR");

  return json({ nonce, message });
});

