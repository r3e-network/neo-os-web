import { handleCorsPreflight } from "../_shared/cors.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { normalizeUInt160 } from "../_shared/contracts.ts";
import { mustGetEnv, getEnv } from "../_shared/env.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { enforceUsageCaps, fetchMiniAppPolicy, permissionEnabled } from "../_shared/apps.ts";
import { buildEVMPaymentInvocation } from "../_shared/evm.ts";

type PayGasRequest = {
  app_id: string;
  chain_id?: string;
  chainId?: string;
  /** Amount in native token (GAS for Neo, ETH/native for EVM) */
  amount_gas: string;
  /** Amount in wei for EVM chains (alternative to amount_gas) */
  amount_wei?: string;
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

  // Determine chain first to know the decimal precision
  const requestedChainId = String(body.chain_id ?? body.chainId ?? "")
    .trim()
    .toLowerCase();
  const chainId = requestedChainId || policy?.supportedChains?.[0] || "neo-n3-mainnet";
  if (policy?.supportedChains?.length && !policy.supportedChains.includes(chainId)) {
    return error(400, `chain_id not supported by app: ${chainId}`, "CHAIN_NOT_SUPPORTED", req);
  }
  const chain = getChainConfig(chainId);
  if (!chain) return error(400, `unknown chain_id: ${chainId}`, "CHAIN_NOT_FOUND", req);

  // Validate chain type is supported
  if (chain.type !== "neo-n3" && chain.type !== "evm") {
    return error(400, `unsupported chain type: ${chain.type}`, "CHAIN_TYPE_UNSUPPORTED", req);
  }

  // Parse amount based on chain type
  // Neo N3: 8 decimals (GAS), EVM: 18 decimals (ETH/native)
  let amount: bigint;
  const decimals = chain.type === "neo-n3" ? 8 : 18;

  if (chain.type === "evm" && body.amount_wei) {
    // EVM: accept wei directly if provided
    try {
      amount = BigInt(body.amount_wei);
    } catch {
      return error(400, "amount_wei must be a valid integer string", "AMOUNT_INVALID", req);
    }
  } else if (body.amount_gas) {
    // Parse decimal amount with appropriate precision
    try {
      amount = parseDecimalToInt(String(body.amount_gas), decimals);
    } catch (e) {
      return error(400, `amount_gas invalid: ${(e as Error).message}`, "AMOUNT_INVALID", req);
    }
  } else {
    return error(400, "amount_gas or amount_wei required", "AMOUNT_REQUIRED", req);
  }

  if (amount <= 0n) return error(400, "amount must be > 0", "AMOUNT_INVALID", req);
  if (policy?.limits.maxGasPerTx && amount > policy.limits.maxGasPerTx) {
    return error(403, "amount exceeds manifest limit", "LIMIT_EXCEEDED", req);
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

  // Build chain-specific invocation
  if (chain.type === "evm") {
    // EVM Payment Flow:
    // User calls PaymentHub.payApp(appId) or payAppWithMemo(appId, memo) with value
    const paymentHubAddress = chain.contracts?.payment_hub;
    if (!paymentHubAddress) {
      return error(500, "payment_hub contract not configured for chain", "CONFIG_ERROR", req);
    }

    const evmInvocation = buildEVMPaymentInvocation(chainId, paymentHubAddress, appId, amount.toString(), body.memo);

    return json(
      {
        request_id: requestId,
        user_id: auth.userId,
        intent: "payments",
        constraints: { settlement: "NATIVE_TOKEN" },
        chain_id: chainId,
        chain_type: chain.type,
        invocation: evmInvocation,
      },
      {},
      req,
    );
  }

  // Neo N3 Payment Flow:
  // Direct GAS.Transfer(from, PaymentHub, amount, appId)
  const paymentHubAddress = normalizeUInt160(
    chain.contracts?.payment_hub || mustGetEnv("CONTRACT_PAYMENT_HUB_ADDRESS"),
  );
  const gasContractAddress = normalizeUInt160(
    chain.contracts?.gas || getEnv("CONTRACT_GAS_ADDRESS") || NEO_TESTNET_GAS_ADDRESS,
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
    req,
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
