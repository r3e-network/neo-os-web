import { handleCorsPreflight } from "../_shared/cors.ts";
import { normalizeUInt160 } from "../_shared/contracts.ts";
import { getEnv } from "../_shared/env.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { readJsonBody } from "../_shared/request.ts";
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
// Current scope:
// - require direct prepaid GAS transfer to the MiniApp contract
// - do not route through removed intermediary settlement layers
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

  const bodyOrErr = await readJsonBody<PayGasRequest>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

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
    return error(400, "invalid amount_gas", "AMOUNT_INVALID", req);
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

  const gasContractHash = normalizeUInt160(getEnv("CONTRACT_GAS_HASH") ?? NEO_TESTNET_GAS_HASH);
  const directTargetHash = normalizeUInt160(policy?.contractHash ?? "");
  if (!directTargetHash) {
    return error(409, "app contract hash required for direct prepaid GAS", "CONTRACT_TARGET_REQUIRED", req);
  }
  const paymentMode = "direct_prepaid";
  const transferData = String(body.memo ?? "").trim() || appId;

  const requestId = crypto.randomUUID();

  // GAS.Transfer flow:
  // The wallet will call GAS.Transfer(from, to, amount, data)
  // - from: user's wallet address (filled by wallet at signing time)
  // - to: MiniApp contract
  // - amount: payment amount in GAS fractions (8 decimals)
  // - data: app-specific memo or appId for OnNEP17Payment routing
  return json(
    {
      request_id: requestId,
      user_id: auth.userId,
      intent: "payments",
      constraints: {
        settlement: "GAS_ONLY",
        payment_mode: paymentMode,
      },
      invocation: {
        contract_hash: gasContractHash,
        method: "transfer",
        params: [
          // from: will be filled by wallet with user's address
          { type: "Hash160", value: "SENDER" },
          // to: MiniApp contract
          { type: "Hash160", value: directTargetHash },
          // amount: GAS amount in fractions (8 decimals)
          { type: "Integer", value: amount.toString() },
          // data: app-specific payment routing string
          { type: "String", value: transferData },
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
