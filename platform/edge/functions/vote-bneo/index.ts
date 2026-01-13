import { handleCorsPreflight } from "../_shared/cors.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { normalizeUInt160 } from "../_shared/contracts.ts";
import { getEnv, mustGetEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { enforceUsageCaps, fetchMiniAppPolicy, permissionEnabled } from "../_shared/apps.ts";

type VoteBneoRequest = {
  app_id: string;
  chain_id?: string;
  chainId?: string;
  proposal_id: string;
  bneo_amount: string;
  support?: boolean;
};

// Thin gateway:
// - validates auth + basic shape
// - enforces bNEO-only governance
// - returns an invocation "intent" for the SDK/wallet to sign and submit
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "vote-bneo", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "vote-bneo");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  let body: VoteBneoRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON", req);
  }

  const appId = (body.app_id ?? "").trim();
  if (!appId) return error(400, "app_id required", "APP_ID_REQUIRED", req);

  const policy = await fetchMiniAppPolicy(appId, req);
  if (policy instanceof Response) return policy;
  if (policy && !permissionEnabled(policy.permissions, "governance")) {
    return error(403, "app is not allowed to request governance", "PERMISSION_DENIED", req);
  }

  const proposalId = String(body.proposal_id ?? "").trim();
  if (!proposalId) return error(400, "proposal_id required", "PROPOSAL_ID_REQUIRED", req);

  const support = body.support ?? true;

  const amountStr = String(body.bneo_amount ?? "").trim();
  if (!/^\d+$/.test(amountStr)) return error(400, "bneo_amount must be an integer string", "AMOUNT_INVALID", req);
  const amount = BigInt(amountStr);
  if (amount <= 0n) return error(400, "bneo_amount must be > 0", "AMOUNT_INVALID", req);
  if (policy?.limits.governanceCap && amount > policy.limits.governanceCap) {
    return error(403, "bneo_amount exceeds manifest limit", "LIMIT_EXCEEDED", req);
  }

  const requestedChainId = String(body.chain_id ?? body.chainId ?? "").trim().toLowerCase();
  const chainId = requestedChainId || policy?.supportedChains?.[0] || "neo-n3-mainnet";
  if (policy?.supportedChains?.length && !policy.supportedChains.includes(chainId)) {
    return error(400, `chain_id not supported by app: ${chainId}`, "CHAIN_NOT_SUPPORTED", req);
  }
  const chain = getChainConfig(chainId);
  if (!chain) return error(400, `unknown chain_id: ${chainId}`, "CHAIN_NOT_FOUND", req);
  if (chain.type !== "neo-n3") {
    return error(400, `governance is only supported on neo-n3 chains`, "CHAIN_TYPE_UNSUPPORTED", req);
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

  const governanceAddress = normalizeUInt160(
    chain.contracts?.governance || mustGetEnv("CONTRACT_GOVERNANCE_ADDRESS"),
  );

  const requestId = crypto.randomUUID();

  return json(
    {
      request_id: requestId,
      user_id: auth.userId,
      intent: "governance",
      constraints: { governance: "BNEO_ONLY" },
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
    req,
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
