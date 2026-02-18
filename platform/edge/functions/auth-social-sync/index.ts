import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";
import { mustGetEnv } from "../_shared/env.ts";

export async function handler(req: Request): Promise<Response> {
  try {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  // Service-to-service auth (timing-safe comparison)
  const serviceKey = req.headers.get("X-Service-Key")?.trim() ?? "";
  const expected = mustGetEnv("SERVICE_AUTH_KEY");
  const encoder = new TextEncoder();
  const a = encoder.encode(serviceKey);
  const b = encoder.encode(expected);
  if (a.byteLength !== b.byteLength || !crypto.subtle.timingSafeEqual(a, b)) {
    return error(401, "invalid service key", "AUTH_REQUIRED", req);
  }

  const body = await req.json().catch(() => null);
  if (!body?.sub) return error(400, "sub required", "INVALID_INPUT", req);

  const { sub, email, name, avatar } = body as {
    sub: string; email?: string; name?: string; avatar?: string;
  };

  // Parse Auth0 sub: "google-oauth2|123" -> provider="google", id="123"
  const pipeIdx = sub.indexOf("|");
  if (pipeIdx < 0) return error(400, "invalid sub format", "INVALID_INPUT", req);
  const rawProvider = sub.slice(0, pipeIdx);
  const providerUserId = sub.slice(pipeIdx + 1);
  const provider = rawProvider.replace(/-oauth2$/, "");

  const supabase = supabaseServiceClient();

  // Check existing linked_identities
  const { data: existing } = await supabase
    .from("linked_identities")
    .select("neohub_account_id")
    .eq("provider", provider)
    .eq("provider_user_id", providerUserId)
    .maybeSingle();

  if (existing?.neohub_account_id) {
    return json({ user_id: existing.neohub_account_id, is_new: false }, {}, req);
  }

  // Check if another identity with same email exists (merge case)
  let accountId: string | null = null;
  if (email) {
    const { data: byEmail } = await supabase
      .from("linked_identities")
      .select("neohub_account_id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (byEmail?.neohub_account_id) accountId = byEmail.neohub_account_id;
  }

  // Create new neohub_accounts entry if needed
  if (!accountId) {
    const { data: newAcct, error: createErr } = await supabase
      .from("neohub_accounts")
      .insert({
        password_hash: crypto.randomUUID(),
        password_salt: crypto.randomUUID(),
        display_name: name,
        avatar_url: avatar,
      })
      .select("id")
      .single();
    if (createErr || !newAcct) {
      return error(500, `create account failed: ${createErr?.message}`, "DB_ERROR", req);
    }
    accountId = newAcct.id;

    // Also create users row for metadata
    const { error: userErr } = await supabase.from("users").insert({ email, wallet_type: "custodial" }).select("id").maybeSingle();
    if (userErr && !userErr.message.includes("duplicate")) {
      return error(500, `create user: ${userErr.message}`, "DB_ERROR", req);
    }

    // Allocate custodial wallet via account pool service (best-effort)
    try {
      const poolUrl = mustGetEnv("ACCOUNT_POOL_URL");
      const poolResp = await fetch(`${poolUrl}/user-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Service-ID": "auth-social-sync" },
        body: JSON.stringify({ user_id: accountId }),
      });
      if (poolResp.ok) {
        const { address } = await poolResp.json();
        if (address) {
          await supabase.from("linked_neo_accounts").insert({
            neohub_account_id: accountId,
            address,
            public_key: "custodial",
            is_primary: true,
            linked_at: new Date().toISOString(),
          });
        }
      }
    } catch {
      // Pool service unreachable — wallet allocation deferred
    }
  }

  // Insert linked_identities
  const { error: linkErr } = await supabase.from("linked_identities").upsert({
    neohub_account_id: accountId,
    provider,
    provider_user_id: providerUserId,
    auth0_sub: sub,
    email,
    name: name,
    avatar: avatar,
    linked_at: new Date().toISOString(),
  }, { onConflict: "provider,provider_user_id" });
  if (linkErr) {
    return error(500, `link identity: ${linkErr.message}`, "DB_ERROR", req);
  }

  return json({ user_id: accountId, is_new: true }, {}, req);
  } catch (e) {
    return error(500, `unhandled: ${e instanceof Error ? e.message : String(e)}`, "INTERNAL", req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
