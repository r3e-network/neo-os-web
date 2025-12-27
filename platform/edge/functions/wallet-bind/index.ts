import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { verifyNeoSignature } from "../_shared/neo.ts";
import { ensureUserRow, requireUser, supabaseServiceClient } from "../_shared/supabase.ts";

type WalletBindRequest = {
  address: string;
  public_key: string;
  signature: string;
  message: string;
  nonce: string;
  label?: string;
};

// Binds a Neo N3 address to the authenticated Supabase user.
// The binding is proven via a Neo N3 signature over the provided message.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "wallet-bind", auth);
  if (rl) return rl;

  let body: WalletBindRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON", req);
  }

  const address = String(body.address ?? "").trim();
  const publicKey = String(body.public_key ?? "").trim();
  const signature = String(body.signature ?? "").trim();
  const message = String(body.message ?? "");
  const nonce = String(body.nonce ?? "").trim();
  const label = String(body.label ?? "")
    .trim()
    .slice(0, 64);

  if (!address) return error(400, "address required", "ADDRESS_REQUIRED", req);
  if (!publicKey) return error(400, "public_key required", "PUBLIC_KEY_REQUIRED", req);
  if (!signature) return error(400, "signature required", "SIGNATURE_REQUIRED", req);
  if (!message) return error(400, "message required", "MESSAGE_REQUIRED", req);
  if (!nonce) return error(400, "nonce required", "NONCE_REQUIRED", req);

  if (!verifyNeoSignature(address, message, signature, publicKey)) {
    return error(401, "invalid signature", "SIGNATURE_INVALID", req);
  }

  const supabase = supabaseServiceClient();

  // Ensure the public.users row exists and fetch the currently issued nonce.
  const userRow = await ensureUserRow(auth, {}, req);
  if (userRow instanceof Response) return userRow;

  const storedNonce = String(userRow?.nonce ?? "").trim();
  if (!storedNonce) return error(400, "wallet nonce not issued (call wallet-nonce)", "NONCE_NOT_ISSUED", req);
  if (storedNonce !== nonce) return error(401, "nonce mismatch", "NONCE_INVALID", req);
  if (!message.includes(nonce)) return error(401, "nonce not present in signed message", "NONCE_INVALID", req);
  if (!message.includes(auth.userId)) return error(401, "user id not present in signed message", "NONCE_INVALID", req);

  // Determine whether this is the first wallet (primary by default).
  const { data: existingWallets, error: walletsErr } = await supabase
    .from("user_wallets")
    .select("id")
    .eq("user_id", auth.userId)
    .limit(1);
  if (walletsErr) return error(500, `failed to load wallets: ${walletsErr.message}`, "DB_ERROR", req);

  const isPrimary = (existingWallets ?? []).length === 0;

  // Insert binding. `address` is globally unique to prevent cross-user ambiguity.
  const { data: inserted, error: insertErr } = await supabase
    .from("user_wallets")
    .insert({
      user_id: auth.userId,
      address,
      label: label || null,
      is_primary: isPrimary,
      verified: true,
      verification_message: message,
      verification_signature: signature,
    })
    .select("id,address,label,is_primary,verified,created_at")
    .maybeSingle();
  if (insertErr) {
    // Unique violation is the most common case when the wallet is already bound.
    return error(409, `failed to bind wallet: ${insertErr.message}`, "WALLET_BIND_FAILED", req);
  }

  // Best-effort: mirror primary wallet into users.address (simplifies “must bind wallet” checks).
  if (isPrimary) {
    const { error: addrErr } = await supabase.from("users").update({ address }).eq("id", auth.userId);
    if (addrErr) {
      // Do not fail wallet binding on a derived/legacy field update.
    }
  }

  // Rotate nonce to prevent replay.
  const nextNonce = crypto.randomUUID();
  await supabase.from("users").update({ nonce: nextNonce }).eq("id", auth.userId);

  return json({ wallet: inserted }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
