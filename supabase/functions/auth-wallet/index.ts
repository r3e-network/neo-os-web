import { handleCorsPreflight } from "../_shared/cors.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";
import { verifyNeoSignature } from "../_shared/neo.ts";

export async function handler(req: Request): Promise<Response> {
  try {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const rl = await requireRateLimit(req, "auth-wallet");
  if (rl) return rl;

  const bodyOrErr = await readJsonBody(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const { address, public_key, signature, message } = body as {
    address: string; public_key: string; signature: string; message: string;
  };

  if (!address || !public_key || !signature || !message) {
    return error(400, "address, public_key, signature, message required", "INVALID_INPUT", req);
  }

  // Verify signature
  if (!verifyNeoSignature(address, message, signature, public_key)) {
    return error(401, "invalid signature", "AUTH_INVALID", req);
  }

  const supabase = supabaseServiceClient();

  // Find account by wallet
  let accountId: string | null = null;
  const { data: wallet, error: walletErr } = await supabase
    .from("linked_neo_accounts")
    .select("neohub_account_id")
    .eq("address", address)
    .maybeSingle();
  if (walletErr) return error(500, "failed to query wallet", "DB_ERROR", req);

  if (wallet?.neohub_account_id) {
    accountId = wallet.neohub_account_id;
  }

  // Verify nonce from users table (by address)
  const { data: userRow, error: userRowErr } = await supabase
    .from("users")
    .select("id,nonce")
    .eq("address", address)
    .maybeSingle();
  if (userRowErr) return error(500, "failed to query user", "DB_ERROR", req);

  const nonceMatch = message.match(/Nonce: ([a-f0-9-]+)/);
  const encoder = new TextEncoder();
  const nonceA = encoder.encode(nonceMatch?.[1] ?? "");
  const nonceB = encoder.encode(userRow?.nonce ?? "");
  if (!userRow?.nonce || !nonceMatch || nonceA.byteLength !== nonceB.byteLength || !crypto.subtle.timingSafeEqual(nonceA, nonceB)) {
    return error(401, "nonce mismatch or wallet not registered", "AUTH_INVALID", req);
  }

  // Enforce 5-minute TTL on the signed message timestamp
  const tsMatch = message.match(/Timestamp: (\d+)/);
  const msgTimestamp = tsMatch ? Number(tsMatch[1]) : 0;
  const now = Math.floor(Date.now() / 1000);
  if (!msgTimestamp || Math.abs(now - msgTimestamp) > 300) {
    return error(401, "nonce expired", "AUTH_INVALID", req);
  }

  // Clear nonce immediately (single-use, prevent replay on verification failure)
  await supabase.from("users").update({ nonce: null }).eq("address", address);
  // Note: nonce cleared before any further processing to prevent retry attacks

  // Create neohub_accounts if needed
  if (!accountId) {
    const { data: newAcct, error: acctErr } = await supabase
      .from("neohub_accounts")
      .insert({ password_hash: crypto.randomUUID(), password_salt: crypto.randomUUID() })
      .select("id")
      .single();
    if (acctErr || !newAcct) {
      return error(500, "failed to create account", "AUTH_ERROR", req);
    }
    accountId = newAcct.id;
  }

  // Always upsert linked_neo_accounts to handle race conditions
  const { error: linkAcctErr } = await supabase.from("linked_neo_accounts").upsert({
    neohub_account_id: accountId,
    address,
    public_key,
    is_primary: true,
    linked_at: new Date().toISOString(),
  }, { onConflict: "neohub_account_id,address" });
  if (linkAcctErr) {
    return error(500, "failed to link wallet", "AUTH_ERROR", req);
  }

  // Create or get Supabase Auth user
  const email = `${address}@wallet.neo`;

  // Ensure Supabase Auth user exists
  const { data: listData } = await supabase.auth.admin.listUsers({ filter: email, perPage: 1 });
  if (!listData?.users?.length) {
    const { error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { address, wallet_type: "external" },
    });
    if (createErr && !createErr.message.includes("already been registered")) {
      return error(500, "failed to create auth user", "AUTH_ERROR", req);
    }
  }

  // Generate access token via magic link
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    return error(500, "session creation failed", "AUTH_ERROR", req);
  }

  // Verify the token to get a session
  const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
    email,
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyErr || !verifyData?.session?.access_token) {
    return error(500, "token verification failed", "AUTH_ERROR", req);
  }

  const accessToken = verifyData.session.access_token;

  return json({ access_token: accessToken, user: { id: accountId, address } }, {}, req);
  } catch {
    return error(500, "internal error", "INTERNAL", req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
