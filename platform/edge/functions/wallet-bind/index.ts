// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { verifyNeoSignature } from "../_shared/neo.ts";
import { ensureUserRow, supabaseServiceClient } from "../_shared/supabase.ts";

// Nonce expires after 5 minutes (300 seconds)
const NONCE_TTL_SECONDS = 300;

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
export const handler = createHandler(
  { method: "POST", auth: "user_only", rateLimit: "wallet-bind" },
  async ({ req, auth }) => {
    let body: WalletBindRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_JSON", undefined, req);
    }

    const address = String(body.address ?? "").trim();
    const publicKey = String(body.public_key ?? "").trim();
    const signature = String(body.signature ?? "").trim();
    const message = String(body.message ?? "");
    const nonce = String(body.nonce ?? "").trim();
    const label = String(body.label ?? "")
      .trim()
      .slice(0, 64);

    if (!address) return validationError("address", "address required", req);
    if (!publicKey) return validationError("public_key", "public_key required", req);
    if (!signature) return validationError("signature", "signature required", req);
    if (!message) return validationError("message", "message required", req);
    if (!nonce) return validationError("nonce", "nonce required", req);

    if (!verifyNeoSignature(address, message, signature, publicKey)) {
      return errorResponse("AUTH_001", { message: "invalid signature" }, req);
    }

    const supabase = supabaseServiceClient();

    // Validate nonce using database function (includes expiration check)
    const { data: nonceResult, error: nonceErr } = await supabase.rpc("validate_wallet_nonce", {
      p_user_id: auth.userId,
      p_nonce: nonce,
      p_max_age_seconds: NONCE_TTL_SECONDS,
    });
    if (nonceErr) {
      // Fallback to legacy validation if RPC not available (migration not applied)
      const userRow = await ensureUserRow(auth, {}, req);
      if (userRow instanceof Response) return userRow;

      const storedNonce = String(userRow?.nonce ?? "").trim();
      if (!storedNonce) return validationError("nonce", "wallet nonce not issued (call wallet-nonce)", req);
      if (storedNonce !== nonce) return errorResponse("AUTH_001", { message: "nonce mismatch" }, req);
    } else {
      // Use RPC result for validation
      const valid = Boolean(nonceResult?.valid);
      const reason = String(nonceResult?.reason ?? "");
      if (!valid) {
        if (reason === "nonce_not_issued") {
          return validationError("nonce", "wallet nonce not issued (call wallet-nonce)", req);
        }
        if (reason === "nonce_expired") {
          return errorResponse("AUTH_001", { message: "nonce expired (request a new one)" }, req);
        }
        return errorResponse("AUTH_001", { message: "nonce mismatch" }, req);
      }
    }

    // Validate message content
    if (!message.includes(nonce))
      return errorResponse("AUTH_001", { message: "nonce not present in signed message" }, req);
    if (!message.includes(auth.userId))
      return errorResponse("AUTH_001", { message: "user id not present in signed message" }, req);

    // Determine whether this is the first wallet (primary by default).
    const { data: existingWallets, error: walletsErr } = await supabase
      .from("user_wallets")
      .select("id")
      .eq("user_id", auth.userId)
      .limit(1);
    if (walletsErr)
      return errorResponse("SERVER_002", { message: `failed to load wallets: ${walletsErr.message}` }, req);

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
      return errorResponse("SERVER_002", { message: `failed to bind wallet: ${insertErr.message}` }, req);
    }

    // Best-effort: mirror primary wallet into users.address (simplifies "must bind wallet" checks).
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
);

if (import.meta.main) {
  Deno.serve(handler);
}
