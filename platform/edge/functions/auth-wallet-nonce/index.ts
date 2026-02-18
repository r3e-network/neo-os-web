import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const body = await req.json().catch(() => null);
  const address = (body?.address ?? "").trim();
  if (!address || !/^N[A-HJ-NP-Za-km-z1-9]{33}$/.test(address)) {
    return error(400, "valid Neo N3 address required", "INVALID_INPUT", req);
  }

  const supabase = supabaseServiceClient();
  const nonce = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `Sign this message to log in with your Neo N3 wallet.\n\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

  // Find or create account by wallet address
  const { data: wallet } = await supabase
    .from("linked_neo_accounts")
    .select("neohub_account_id")
    .eq("address", address)
    .maybeSingle();

  let accountId: string;
  if (wallet?.neohub_account_id) {
    accountId = wallet.neohub_account_id;
  } else {
    // Check users table by address
    const { data: byAddr } = await supabase
      .from("users")
      .select("id")
      .eq("address", address)
      .maybeSingle();

    if (byAddr?.id) {
      // User exists but no neohub_accounts yet - create one
      const { data: newAcct, error: acctErr } = await supabase
        .from("neohub_accounts")
        .insert({ password_hash: crypto.randomUUID(), password_salt: crypto.randomUUID() })
        .select("id")
        .single();
      if (acctErr || !newAcct) {
        return error(500, `create account: ${acctErr?.message}`, "DB_ERROR", req);
      }
      accountId = newAcct.id;
    } else {
      // Create both neohub_accounts and users
      const { data: newAcct, error: acctErr } = await supabase
        .from("neohub_accounts")
        .insert({ password_hash: crypto.randomUUID(), password_salt: crypto.randomUUID() })
        .select("id")
        .single();
      if (acctErr || !newAcct) {
        return error(500, `create account: ${acctErr?.message}`, "DB_ERROR", req);
      }
      accountId = newAcct.id;
      await supabase.from("users").upsert({ address, wallet_type: "external" }, { onConflict: "address" });
    }
  }

  // Store nonce - use upsert directly to avoid race condition
  const { error: nonceErr } = await supabase.from("users").upsert(
    { address, wallet_type: "external", nonce },
    { onConflict: "address" }
  );
  if (nonceErr) {
    return error(500, `store nonce: ${nonceErr.message}`, "DB_ERROR", req);
  }

  return json({ nonce, message, account_id: accountId }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
