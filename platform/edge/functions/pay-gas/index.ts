import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { error, json } from "../_shared/response.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";

type PayGasRequest = {
  app_id: string;
  amount_gas: string;
  memo?: string;
};

// Thin gateway:
// - validates auth + basic shape
// - enforces GAS-only settlement
// - returns an invocation "intent" for the SDK/wallet to sign and submit
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const walletCheck = await requirePrimaryWallet(auth.userId);
  if (walletCheck instanceof Response) return walletCheck;

  let body: PayGasRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON");
  }

  const appId = (body.app_id ?? "").trim();
  if (!appId) return error(400, "app_id required", "APP_ID_REQUIRED");

  let amount;
  try {
    amount = parseDecimalToInt(String(body.amount_gas ?? ""), 8);
  } catch (e) {
    return error(400, `amount_gas invalid: ${(e as Error).message}`, "AMOUNT_INVALID");
  }
  if (amount <= 0n) return error(400, "amount_gas must be > 0", "AMOUNT_INVALID");

  const paymentHubHash = mustGetEnv("CONTRACT_PAYMENTHUB_HASH").replace(/^0x/i, "");

  const requestId = crypto.randomUUID();
  const memo = (body.memo ?? "").slice(0, 256);

  return json({
    request_id: requestId,
    user_id: auth.userId,
    intent: "payments",
    constraints: { settlement: "GAS_ONLY" },
    invocation: {
      contract_hash: paymentHubHash,
      method: "Pay",
      params: [
        { type: "String", value: appId },
        { type: "Integer", value: amount.toString() },
        { type: "String", value: memo },
      ],
    },
  });
});
