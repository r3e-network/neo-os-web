import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseServiceClient, supabaseClient } from "../_shared/supabase.ts";
import { verifyNeoSignature } from "../_shared/neo.ts";
import { verifyEvmSignature } from "../_shared/evm.ts";

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

  // Atomically consume the nonce: the conditional update (id AND still-equals-nonce) means
  // only ONE concurrent request can null a given nonce, closing the check-then-clear race
  // that previously let two requests both authenticate on the same nonce. If the row no
  // longer carries this nonce, another request already consumed it -> reject (replay/race).
  const { data: consumed, error: consumeErr } = await supabase
    .from("users").update({ nonce: null }).eq("id", accountId).eq("nonce", nonce).select("id");
  if (consumeErr || !consumed || consumed.length === 0) {
    return error(401, "invalid or expired nonce", "AUTH_INVALID", req);
  }

  // Issue a REAL Supabase (GoTrue) session for the wallet. The previous path
  // self-signed an HS256 JWT, which the OS edge functions reject because
  // supabase.auth.getUser() validates against GoTrue/auth.users — and the
  // wallet account is not an auth.users row. Deterministically map the wallet
  // to a GoTrue user, then mint a session that getUser() accepts.
  const email = `wallet-${address.toLowerCase()}@wallet.neo`;
  const createdUser = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { wallet_address: address },
  });
  if (createdUser.error && !/already|exist|registered/i.test(createdUser.error.message)) {
    console.warn("[auth-wallet] createUser:", createdUser.error.message);
  }
  const link = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error || !link.data?.properties?.email_otp) {
    return error(500, "failed to mint wallet session link", "AUTH_SESSION", req);
  }
  const authUserId = createdUser.data?.user?.id || link.data.user?.id;
  if (!authUserId) {
    return error(500, "failed to resolve wallet session user", "AUTH_SESSION", req);
  }

  // Keep public.users.id == the GoTrue user id (user_wallets.user_id -> public.users.id),
  // removing any stale row that mapped this address to a different id.
  await supabase.from("users").delete().eq("address", address).neq("id", authUserId);
  await supabase.from("users").upsert(
    { id: authUserId, address, wallet_type: "external" },
    { onConflict: "id" },
  );
  // Bind the verified primary wallet (requirePrimaryWallet needs this for OS calls).
  await supabase.from("user_wallets").upsert(
    { user_id: authUserId, address, is_primary: true, verified: true, wallet_type: "external" },
    { onConflict: "address" },
  );

  // Exchange the magic-link OTP for a real session access_token.
  const anon = supabaseClient();
  const session = await anon.auth.verifyOtp({
    email,
    token: link.data.properties.email_otp,
    type: "email",
  });
  if (session.error || !session.data?.session?.access_token) {
    return error(500, "failed to mint wallet session", "AUTH_SESSION", req);
  }

  return json({
    access_token: session.data.session.access_token,
    refresh_token: session.data.session.refresh_token,
    expires_in: session.data.session.expires_in,
    user: { id: authUserId, address },
  }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
