import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

type CreateDepositRequest = {
  amount: number | string;
  from_address: string;
  tx_hash?: string;
};

// Creates a deposit request entry (verification/settlement runs elsewhere).
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "gasbank-deposit", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "gasbank-deposit");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const bodyOrErr = await readJsonBody<CreateDepositRequest>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const fromAddress = String(body.from_address ?? "").trim();
  if (!/^N[A-HJ-NP-Za-km-z1-9]{33}$/.test(fromAddress)) {
    return error(400, "invalid Neo N3 address", "FROM_ADDRESS_INVALID", req);
  }
  if (fromAddress !== walletCheck.address) {
    return error(403, "from_address must match authenticated wallet", "ADDRESS_MISMATCH", req);
  }

  const txHash = String(body.tx_hash ?? "").trim().slice(0, 66) || null;
  if (txHash && !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return error(400, "invalid tx_hash format", "TX_HASH_INVALID", req);
  }

  const rawAmount = String(body.amount ?? "").trim();
  if (!/^\d+$/.test(rawAmount)) return error(400, "amount must be an integer string", "AMOUNT_INVALID", req);
  const amount = BigInt(rawAmount);
  if (amount <= 0n) return error(400, "amount must be > 0", "AMOUNT_INVALID", req);
  if (amount > 10_000_000_000n) return error(400, "amount exceeds maximum", "AMOUNT_TOO_LARGE", req);

  const ensured = await ensureUserRow(auth, {}, req);
  if (ensured instanceof Response) return ensured;

  const supabase = supabaseServiceClient();

  const { data: account, error: accErr } = await supabase
    .from("gasbank_accounts")
    .upsert({ user_id: auth.userId }, { onConflict: "user_id" })
    .select("id")
    .maybeSingle();
  if (accErr || !account?.id) {
    return error(500, "failed to ensure gasbank account", "DB_ERROR", req);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: inserted, error: depErr } = await supabase
    .from("deposit_requests")
    .insert({
      user_id: auth.userId,
      account_id: account.id,
      amount: amount.toString(),
      tx_hash: txHash,
      from_address: fromAddress,
      status: "pending",
      required_confirmations: 1,
      expires_at: expiresAt,
    })
    .select("id,user_id,account_id,amount,tx_hash,from_address,status,required_confirmations,expires_at,created_at")
    .maybeSingle();

  if (depErr) return error(500, "failed to create deposit request", "DB_ERROR", req);

  return json({ deposit: inserted }, { status: 201 }, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
