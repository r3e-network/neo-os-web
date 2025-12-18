import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireScope } from "../_shared/scopes.ts";
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

type CreateDepositRequest = {
  amount: number | string;
  from_address: string;
  tx_hash?: string;
};

// Creates a deposit request entry (verification/settlement runs elsewhere).
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const scopeCheck = requireScope(auth, "gasbank-deposit");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId);
  if (walletCheck instanceof Response) return walletCheck;

  let body: CreateDepositRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON");
  }

  const fromAddress = String(body.from_address ?? "").trim();
  if (!fromAddress) return error(400, "from_address required", "FROM_ADDRESS_REQUIRED");

  const rawAmount = String(body.amount ?? "").trim();
  if (!/^\d+$/.test(rawAmount)) return error(400, "amount must be an integer string", "AMOUNT_INVALID");
  const amount = BigInt(rawAmount);
  if (amount <= 0n) return error(400, "amount must be > 0", "AMOUNT_INVALID");

  const txHash = String(body.tx_hash ?? "").trim() || null;

  const ensured = await ensureUserRow(auth);
  if (ensured instanceof Response) return ensured;

  const supabase = supabaseServiceClient();

  const { data: account, error: accErr } = await supabase
    .from("gasbank_accounts")
    .upsert({ user_id: auth.userId }, { onConflict: "user_id" })
    .select("id")
    .maybeSingle();
  if (accErr || !(account as any)?.id) {
    return error(500, `failed to ensure gasbank account: ${accErr?.message ?? "unknown error"}`, "DB_ERROR");
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: inserted, error: depErr } = await supabase
    .from("deposit_requests")
    .insert({
      user_id: auth.userId,
      account_id: (account as any).id,
      amount: amount.toString(),
      tx_hash: txHash,
      from_address: fromAddress,
      status: "pending",
      required_confirmations: 1,
      expires_at: expiresAt,
    })
    .select("*")
    .maybeSingle();

  if (depErr) return error(500, `failed to create deposit request: ${depErr.message}`, "DB_ERROR");

  return json({ deposit: inserted }, { status: 201 });
});
