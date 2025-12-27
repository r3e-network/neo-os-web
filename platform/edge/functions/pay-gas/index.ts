import { handleCorsPreflight } from "../_shared/cors.ts";
import { normalizeUInt160 } from "../_shared/contracts.ts";
import { mustGetEnv, getEnv } from "../_shared/env.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { enforceUsageCaps, fetchMiniAppPolicy, permissionEnabled } from "../_shared/apps.ts";

type PayGasRequest = {
  app_id: string;
  amount_gas: string;
  memo?: string;
};

// Neo N3 Testnet GAS contract hash (native contract)
const NEO_TESTNET_GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

// Thin gateway:
// - validates auth + basic shape
// - enforces GAS-only settlement
// - returns an invocation "intent" for the SDK/wallet to sign and submit
//
// Payment Flow (Direct GAS.Transfer):
// 1. User calls GAS.Transfer(from, PaymentHub, amount, appId)
// 2. GAS contract transfers GAS to PaymentHub
// 3. PaymentHub.OnNEP17Payment callback is triggered
// 4. PaymentHub validates appId and updates balance
// 5. Receipt is created and PaymentReceived event is emitted
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "pay-gas", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "pay-gas");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  let body: PayGasRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON", req);
  }

  const appId = (body.app_id ?? "").trim();
  if (!appId) return error(400, "app_id required", "APP_ID_REQUIRED", req);

  const policy = await fetchMiniAppPolicy(appId, req);
  if (policy instanceof Response) return policy;
  if (policy && !permissionEnabled(policy.permissions, "payments")) {
    return error(403, "app is not allowed to request payments", "PERMISSION_DENIED", req);
  }

  let amount;
  try {
    amount = parseDecimalToInt(String(body.amount_gas ?? ""), 8);
  } catch (e) {
    return error(400, `amount_gas invalid: ${(e as Error).message}`, "AMOUNT_INVALID", req);
  }
  if (amount <= 0n) return error(400, "amount_gas must be > 0", "AMOUNT_INVALID", req);
  if (policy?.limits.maxGasPerTx && amount > policy.limits.maxGasPerTx) {
    return error(403, "amount_gas exceeds manifest limit", "LIMIT_EXCEEDED", req);
  }
  const usageMode = getEnv("MINIAPP_USAGE_MODE_PAYMENTS");
  const usageErr = await enforceUsageCaps({
    appId,
    userId: auth.userId,
    gasDelta: amount,
    gasCap: policy?.limits.dailyGasCapPerUser,
    mode: usageMode,
    req,
  });
  if (usageErr) return usageErr;

  const paymentHubHash = normalizeUInt160(mustGetEnv("CONTRACT_PAYMENTHUB_HASH"));
  const gasContractHash = normalizeUInt160(getEnv("CONTRACT_GAS_HASH") ?? NEO_TESTNET_GAS_HASH);

  const requestId = crypto.randomUUID();

  // Direct GAS.Transfer flow:
  // The wallet will call GAS.Transfer(from, to, amount, data)
  // - from: user's wallet address (filled by wallet at signing time)
  // - to: PaymentHub contract address
  // - amount: payment amount in GAS fractions (8 decimals)
  // - data: appId string (used by OnNEP17Payment to identify the MiniApp)
  //
  // Note: memo is not passed through GAS.Transfer to keep the data simple
  // and avoid Neo VM CONVERT errors. The appId is sufficient for routing.
  return json(
    {
      request_id: requestId,
      user_id: auth.userId,
      intent: "payments",
      constraints: { settlement: "GAS_ONLY" },
      invocation: {
        contract_hash: gasContractHash,
        method: "transfer",
        params: [
          // from: will be filled by wallet with user's address
          { type: "Hash160", value: "SENDER" },
          // to: PaymentHub contract
          { type: "Hash160", value: paymentHubHash },
          // amount: GAS amount in fractions (8 decimals)
          { type: "Integer", value: amount.toString() },
          // data: appId for OnNEP17Payment callback
          { type: "String", value: appId },
        ],
      },
    },
    {},
    req,
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
