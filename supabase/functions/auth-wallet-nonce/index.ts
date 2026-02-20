import { handleCorsPreflight } from "../_shared/cors.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

export async function handler(req: Request): Promise<Response> {
  try {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const rl = await requireRateLimit(req, "auth-wallet-nonce");
  if (rl) return rl;

  const bodyOrErr = await readJsonBody(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const address = ((bodyOrErr as Record<string, unknown>)?.address as string ?? "").trim();
  if (!address || !/^N[A-HJ-NP-Za-km-z1-9]{33}$/.test(address)) {
    return error(400, "valid Neo N3 address required", "INVALID_INPUT", req);
  }

  const supabase = supabaseServiceClient();
  const nonce = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `Sign this message to log in with your Neo N3 wallet.\n\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

  // Find or create account by wallet address
  const { data: wallet, error: walletErr } = await supabase
    .from("linked_neo_accounts")
    .select("neohub_account_id")
    .eq("address", address)
    .maybeSingle();
  if (walletErr) return error(500, "failed to query wallet", "DB_ERROR", req);

  let accountId: string;
  if (wallet?.neohub_account_id) {
    accountId = wallet.neohub_account_id;
  } else {
    // Create account + link to minimize race window for duplicate accounts
    const { data: newAcct, error: acctErr } = await supabase
      .from("neohub_accounts")
      .insert({ password_hash: crypto.randomUUID(), password_salt: crypto.randomUUID() })
      .select("id")
      .single();
    if (acctErr || !newAcct) {
      return error(500, "failed to create account", "DB_ERROR", req);
    }

    // Link wallet to account (composite key: neohub_account_id,address)
    await supabase.from("linked_neo_accounts").upsert({
      neohub_account_id: newAcct.id, address,
      public_key: "", is_primary: true, linked_at: new Date().toISOString(),
    }, { onConflict: "neohub_account_id,address" });

    // Re-query to get the earliest linked account (handles concurrent creation)
    const { data: linked, error: linkErr } = await supabase
      .from("linked_neo_accounts")
      .select("neohub_account_id")
      .eq("address", address)
      .order("linked_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (linkErr || !linked) {
      return error(500, "failed to link wallet", "DB_ERROR", req);
    }
    accountId = linked.neohub_account_id;

    // Ensure users row exists
    await supabase.from("users").upsert({ address, wallet_type: "external" }, { onConflict: "address" });
  }

  // Store nonce - use upsert directly to avoid race condition
  const { error: nonceErr } = await supabase.from("users").upsert(
    { address, wallet_type: "external", nonce },
    { onConflict: "address" }
  );
  if (nonceErr) {
    return error(500, "failed to store nonce", "DB_ERROR", req);
  }

  return json({ nonce, message }, {}, req);
  } catch {
    return error(500, "internal error", "INTERNAL", req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
