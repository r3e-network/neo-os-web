// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { normalizeUInt160 } from "../_shared/hex.ts";
import { getEnv, mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { enforceUsageCaps, fetchMiniAppPolicy, permissionEnabled } from "../_shared/apps.ts";

type VoteGovernanceRequest = {
  app_id: string;
  chain_id?: string;
  chainId?: string;
  proposal_id: string;
  neo_amount?: string;
  bneo_amount?: string;
  neoAmount?: string;
  bneoAmount?: string;
  support?: boolean;
};

// Thin gateway:
// - validates auth + basic shape
// - enforces NEO-only governance
// - returns an invocation "intent" for the SDK/wallet to sign and submit
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "vote-bneo", auth);
  if (rl) return rl;
  const scopeCheckLegacy = requireScope(req, auth, "vote-bneo");
  if (scopeCheckLegacy) {
    const scopeCheckNeo = requireScope(req, auth, "vote-neo");
    if (scopeCheckNeo) return scopeCheckLegacy;
  }
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  let body: VoteGovernanceRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const appId = (body.app_id ?? "").trim();
  if (!appId) return validationError("app_id", "app_id required", req);

  const policy = await fetchMiniAppPolicy(appId, req);
  if (policy instanceof Response) return policy;
  if (policy && !permissionEnabled(policy.permissions, "governance")) {
    return errorResponse("AUTH_004", { message: "app is not allowed to request governance" }, req);
  }

  const proposalId = String(body.proposal_id ?? "").trim();
  if (!proposalId) return validationError("proposal_id", "proposal_id required", req);

  const support = body.support ?? true;

  const amountStr = String(body.neo_amount ?? body.bneo_amount ?? body.neoAmount ?? body.bneoAmount ?? "").trim();
  if (!/^\d+$/.test(amountStr)) {
    return validationError("neo_amount", "neo_amount must be an integer string", req);
  }
  const amount = BigInt(amountStr);
  if (amount <= 0n) return validationError("neo_amount", "neo_amount must be > 0", req);
  if (policy?.limits.governanceCap && amount > policy.limits.governanceCap) {
    return errorResponse("VAL_009", { message: "neo_amount exceeds manifest limit" }, req);
  }

  const requestedChainId = String(body.chain_id ?? body.chainId ?? "")
    .trim()
    .toLowerCase();
  const chainId = requestedChainId || policy?.supportedChains?.[0] || "neo-n3-mainnet";
  if (policy?.supportedChains?.length && !policy.supportedChains.includes(chainId)) {
    return errorResponse("VAL_006", { chain_id: chainId }, req);
  }
  const chain = getChainConfig(chainId);
  if (!chain) return notFoundError("chain", req);
  if (chain.type !== "neo-n3") {
    return errorResponse("VAL_008", { message: "governance is only supported on neo-n3 chains" }, req);
  }

  const usageMode = getEnv("MINIAPP_USAGE_MODE_GOVERNANCE");
  const usageErr = await enforceUsageCaps({
    appId,
    userId: auth.userId,
    chainId,
    governanceDelta: amount,
    governanceCap: policy?.limits.governanceCap,
    mode: usageMode,
    req,
  });
  if (usageErr) return usageErr;

  const governanceAddress = normalizeUInt160(chain.contracts?.governance || mustGetEnv("CONTRACT_GOVERNANCE_ADDRESS"));

  const requestId = crypto.randomUUID();

  return json(
    {
      request_id: requestId,
      user_id: auth.userId,
      intent: "governance",
      constraints: { governance: "NEO_ONLY" },
      chain_id: chainId,
      chain_type: chain.type,
      invocation: {
        chain_id: chainId,
        chain_type: chain.type,
        contract_address: governanceAddress,
        method: "vote",
        params: [
          { type: "String", value: proposalId },
          { type: "Boolean", value: support },
          { type: "Integer", value: amount.toString() },
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
