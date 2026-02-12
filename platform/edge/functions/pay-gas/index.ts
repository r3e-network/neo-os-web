// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { normalizeUInt160 } from "../_shared/hex.ts";
import { mustGetEnv, getEnv } from "../_shared/env.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { enforceUsageCaps, fetchMiniAppPolicy, permissionEnabled } from "../_shared/apps.ts";
import { buildLogContext, logRequest, logResponse, createTimer, logError } from "../_shared/logging.ts";

type PayGasRequest = {
  app_id: string;
  chain_id?: string;
  chainId?: string;
  /** Amount in GAS */
  amount_gas: string;
  memo?: string;
};

// Neo N3 Testnet GAS contract address (native contract)
const NEO_TESTNET_GAS_ADDRESS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

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
  const timer = createTimer();
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "pay-gas", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "pay-gas");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  // Build log context and log incoming request
  const logCtx = buildLogContext(req, auth.userId);
  logRequest(logCtx, { endpoint: "pay-gas" });

  let body: PayGasRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const appId = (body.app_id ?? "").trim();
  if (!appId) return validationError("app_id", "app_id required", req);

  const policy = await fetchMiniAppPolicy(appId, req);
  if (policy instanceof Response) return policy;
  if (policy && !permissionEnabled(policy.permissions, "payments")) {
    return errorResponse("AUTH_004", { message: "app is not allowed to request payments" }, req);
  }

  // Determine chain first to know the decimal precision
  const requestedChainId = String(body.chain_id ?? body.chainId ?? "")
    .trim()
    .toLowerCase();
  const chainId = requestedChainId || policy?.supportedChains?.[0] || "neo-n3-mainnet";
  if (policy?.supportedChains?.length && !policy.supportedChains.includes(chainId)) {
    return errorResponse("VAL_006", { chain_id: chainId }, req);
  }
  const chain = getChainConfig(chainId);
  if (!chain) return notFoundError("chain", req);

  // Validate chain type is supported
  if (chain.type !== "neo-n3") {
    return errorResponse("VAL_008", { message: `unsupported chain type: ${chain.type}` }, req);
  }

  // Parse amount (Neo N3: 8 decimals)
  let amount: bigint;
  try {
    amount = parseDecimalToInt(String(body.amount_gas), 8);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return validationError("amount_gas", `amount_gas invalid: ${message}`, req);
  }

  if (amount <= 0n) return validationError("amount_gas", "amount must be > 0", req);
  if (policy?.limits.maxGasPerTx && amount > policy.limits.maxGasPerTx) {
    return errorResponse("VAL_009", { message: "amount exceeds manifest limit" }, req);
  }

  const usageMode = getEnv("MINIAPP_USAGE_MODE_PAYMENTS");
  const usageErr = await enforceUsageCaps({
    appId,
    userId: auth.userId,
    chainId,
    gasDelta: amount,
    gasCap: policy?.limits.dailyGasCapPerUser,
    mode: usageMode,
    req,
  });
  if (usageErr) return usageErr;

  const requestId = crypto.randomUUID();

  // Neo N3 Payment Flow:
  // Direct GAS.Transfer(from, PaymentHub, amount, appId)
  const paymentHubAddress = normalizeUInt160(
    chain.contracts?.payment_hub || mustGetEnv("CONTRACT_PAYMENT_HUB_ADDRESS")
  );
  const gasContractAddress = normalizeUInt160(
    chain.contracts?.gas || getEnv("CONTRACT_GAS_ADDRESS") || NEO_TESTNET_GAS_ADDRESS
  );

  return json(
    {
      request_id: requestId,
      user_id: auth.userId,
      intent: "payments",
      constraints: { settlement: "GAS_ONLY" },
      chain_id: chainId,
      chain_type: chain.type,
      invocation: {
        chain_id: chainId,
        chain_type: chain.type,
        contract_address: gasContractAddress,
        method: "transfer",
        params: [
          { type: "Hash160", value: "SENDER" },
          { type: "Hash160", value: paymentHubAddress },
          { type: "Integer", value: amount.toString() },
          { type: "String", value: appId },
        ],
      },
    },
    {},
    req
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
