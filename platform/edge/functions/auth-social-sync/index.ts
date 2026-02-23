import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";
import { mustGetEnv } from "../_shared/env.ts";

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  // Service-to-service auth (timing-safe comparison)
  const serviceKey = req.headers.get("X-Service-Key")?.trim() ?? "";
  const expected = mustGetEnv("SERVICE_AUTH_KEY");
  const encoder = new TextEncoder();
  const a = encoder.encode(serviceKey);
  const b = encoder.encode(expected);
  if (!timingSafeEqualBytes(a, b)) {
    return error(401, "invalid service key", "AUTH_REQUIRED", req);
  }

  const bodyOrErr = await readJsonBody<Record<string, unknown>>(req);
  const body = bodyOrErr instanceof Response ? null : bodyOrErr;
  if (!body?.sub) return error(400, "sub required", "INVALID_INPUT", req);

  const { sub, email, name, avatar } = body as {
    sub: string; email?: string; name?: string; avatar?: string;
  };

  // Parse Auth0 sub: "google-oauth2|123" -> provider="google", id="123"
  const pipeIdx = sub.indexOf("|");
  if (pipeIdx < 0) return error(400, "invalid sub format", "INVALID_INPUT", req);
  const rawProvider = sub.slice(0, pipeIdx);
  const providerUserId = sub.slice(pipeIdx + 1);
  if (!providerUserId) return error(400, "invalid sub format", "INVALID_INPUT", req);
  const provider = rawProvider.replace(/-oauth2$/, "");

  const supabase = supabaseServiceClient();

  // Check existing linked_identities
  const { data: existing } = await supabase
    .from("linked_identities")
    .select("user_id")
    .eq("provider", provider)
    .eq("provider_user_id", providerUserId)
    .maybeSingle();

  if (existing?.user_id) {
    return json({ user_id: existing.user_id, is_new: false }, {}, req);
  }

  // Check if another identity with same email exists (merge case)
  let accountId: string | null = null;
  if (email) {
    const { data: byEmail } = await supabase
      .from("linked_identities")
      .select("user_id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (byEmail?.user_id) accountId = byEmail.user_id;
  }

  // Create new user entry if needed
  if (!accountId) {
    // Check main users table directly just in case
    if (email) {
      const { data: userByEmail } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
      if (userByEmail?.id) accountId = userByEmail.id;
    }

    if (!accountId) {
      const { data: newUser, error: createErr } = await supabase
        .from("users")
        .insert({ email, wallet_type: "custodial" })
        .select("id")
        .single();
        
      if (createErr || !newUser) {
        return error(500, "failed to create account", "DB_ERROR", req);
      }
      accountId = newUser.id;

      // Allocate custodial wallet via account pool service (best-effort)
      try {
        const poolUrl = mustGetEnv("ACCOUNT_POOL_URL");
        const poolResp = await fetch(`${poolUrl}/user-wallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Service-ID": "auth-social-sync" },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({ user_id: accountId }),
        });
        if (poolResp.ok) {
          const { address } = await poolResp.json();
          if (address) {
            await supabase.from("user_wallets").insert({
              user_id: accountId,
              address,
              is_primary: true,
              verified: true,
            });
            // Link to main users record
            await supabase.from("users").update({ address }).eq("id", accountId);
          }
        }
      } catch {
        // Pool service unreachable — wallet allocation deferred
      }
    }
  }

  // Insert linked_identities
  const { error: linkErr } = await supabase.from("linked_identities").upsert({
    user_id: accountId,
    provider,
    provider_user_id: providerUserId,
    auth0_sub: sub,
    email,
    name,
    avatar_url: avatar,
    last_login: new Date().toISOString(),
  }, { onConflict: "provider,provider_user_id" });

  if (linkErr) {
    return error(500, "failed to link identity", "DB_ERROR", req);
  }

  return json({ user_id: accountId, is_new: true }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
