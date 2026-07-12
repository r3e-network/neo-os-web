/**
 * credits-ledger — interactive credit balance + spend endpoint (DB-first).
 *
 * GET  ?network=testnet[&limit=20]
 *   Returns the authenticated wallet's credit balance and recent ledger
 *   events. Fast DB read; no chain round-trip.
 *
 * POST { network, app_id, action?, amount, idempotency_key [, wallet] }
 *   Instant, feeless spend: atomic conditional debit (balance >= amount) via
 *   the credits_spend RPC plus an append-only credit_events row. Retries with
 *   the same idempotency_key dedupe to the original outcome. Insufficient
 *   balance returns the typed 402 INSUFFICIENT_CREDITS error.
 *
 * AUTH (repo idiom): Supabase session JWT or API key (requireAuth) resolved
 * to the caller's signature-verified primary wallet binding
 * (requirePrimaryWallet — the wallet signature was verified at bind time by
 * wallet-bind/auth-wallet). A `wallet` field, when present, must match the
 * bound wallet. Guest mode has no session, so buy/spend is unreachable.
 * Spends are off-chain, so the S11 payments manifest permission is NOT
 * required here (it gates on-chain buys only).
 *
 * Reconciliation rule: settled chain state + unsettled DB spend deltas =
 * current truth (see docs/MINIAPP_CREDITS_LEDGER.md).
 */

import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { getEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";
import { parseCreditsNetwork } from "../_shared/credits.ts";

const APP_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const ACTION_RE = /^[\w.:-]{1,64}$/;
const IDEMPOTENCY_KEY_RE = /^[-_a-zA-Z0-9:.]{8,128}$/;
const HISTORY_LIMIT_DEFAULT = 20;
const HISTORY_LIMIT_MAX = 100;

function maxSpendPerCall(): bigint {
  const raw = getEnv("CREDITS_MAX_SPEND_PER_CALL") ?? "1000000";
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : 1_000_000n;
  } catch {
    return 1_000_000n;
  }
}

type SpendBody = {
  network?: string;
  app_id?: string;
  appId?: string;
  action?: string;
  amount?: string | number;
  idempotency_key?: string;
  idempotencyKey?: string;
  wallet?: string;
};

async function handleBalance(req: Request, wallet: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return error(400, "invalid request url", "INVALID_URL", req);
  }
  const network = parseCreditsNetwork(url.searchParams.get("network"));
  if (!network) return error(400, "network must be mainnet or testnet", "INVALID_NETWORK", req);

  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, HISTORY_LIMIT_MAX)
    : HISTORY_LIMIT_DEFAULT;

  const supabase = supabaseServiceClient();

  const { data: balanceRow, error: balanceErr } = await supabase
    .from("credit_balances")
    .select("balance,total_purchased,total_spent,total_exited,updated_at")
    .eq("network", network)
    .eq("wallet_address", wallet)
    .maybeSingle();
  if (balanceErr) return error(500, "failed to load balance", "DB_ERROR", req);

  const { data: events, error: eventsErr } = await supabase
    .from("credit_events")
    .select("id,event_type,amount,balance_after,app_id,action,idempotency_key,tx_hash,gas_amount,created_at")
    .eq("network", network)
    .eq("wallet_address", wallet)
    .order("id", { ascending: false })
    .limit(limit);
  if (eventsErr) return error(500, "failed to load history", "DB_ERROR", req);

  return json(
    {
      wallet,
      network,
      balance: Number(balanceRow?.balance ?? 0),
      total_purchased: Number(balanceRow?.total_purchased ?? 0),
      total_spent: Number(balanceRow?.total_spent ?? 0),
      total_exited: Number(balanceRow?.total_exited ?? 0),
      updated_at: balanceRow?.updated_at ?? null,
      events: events ?? [],
    },
    {},
    req,
  );
}

async function handleSpend(req: Request, wallet: string): Promise<Response> {
  const bodyOrErr = await readJsonBody<SpendBody>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const network = parseCreditsNetwork(body.network);
  if (!network) return error(400, "network must be mainnet or testnet", "INVALID_NETWORK", req);

  const bodyWallet = String(body.wallet ?? "").trim();
  if (bodyWallet && bodyWallet !== wallet) {
    return error(403, "wallet must match authenticated primary wallet", "ADDRESS_MISMATCH", req);
  }

  const appId = String(body.app_id ?? body.appId ?? "").trim();
  if (!APP_ID_RE.test(appId)) return error(400, "app_id required (1-64 chars, [a-z0-9-])", "APP_ID_INVALID", req);

  const actionRaw = String(body.action ?? "").trim();
  if (actionRaw && !ACTION_RE.test(actionRaw)) {
    return error(400, "action must match [\\w.:-]{1,64}", "ACTION_INVALID", req);
  }
  const action = actionRaw || null;

  const idempotencyKey = String(body.idempotency_key ?? body.idempotencyKey ?? "").trim();
  if (!IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    return error(400, "idempotency_key required (8-128 chars, [-_a-zA-Z0-9:.])", "IDEMPOTENCY_KEY_INVALID", req);
  }

  const amountRaw = String(body.amount ?? "").trim();
  if (!/^\d+$/.test(amountRaw)) {
    return error(400, "amount must be a positive integer credit count", "AMOUNT_INVALID", req);
  }
  const amount = BigInt(amountRaw);
  if (amount <= 0n) return error(400, "amount must be > 0", "AMOUNT_INVALID", req);
  if (amount > maxSpendPerCall()) return error(400, "amount exceeds per-call maximum", "AMOUNT_TOO_LARGE", req);

  const supabase = supabaseServiceClient();
  const { data, error: rpcErr } = await supabase.rpc("credits_spend", {
    p_network: network,
    p_wallet: wallet,
    p_app_id: appId.toLowerCase(),
    p_action: action,
    p_amount: Number(amount),
    p_idempotency_key: idempotencyKey,
  });
  if (rpcErr) return error(500, "spend failed", "DB_ERROR", req);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return error(500, "spend returned no result", "DB_ERROR", req);

  if (!row.success) {
    if (String(row.error_code ?? "") === "insufficient_credits") {
      return error(402, "insufficient credits", "INSUFFICIENT_CREDITS", req);
    }
    return error(400, String(row.error_code ?? "spend rejected"), "SPEND_REJECTED", req);
  }

  return json(
    {
      wallet,
      network,
      app_id: appId.toLowerCase(),
      action,
      spent: Number(amount),
      balance: Number(row.new_balance ?? 0),
      event_id: row.event_id ?? null,
      deduped: Boolean(row.deduped),
    },
    { status: Boolean(row.deduped) ? 200 : 201 },
    req,
  );
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET" && req.method !== "POST") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "credits-ledger", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "credits-ledger");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  if (req.method === "GET") return handleBalance(req, walletCheck.address);
  return handleSpend(req, walletCheck.address);
}

if (import.meta.main) {
  Deno.serve(handler);
}
