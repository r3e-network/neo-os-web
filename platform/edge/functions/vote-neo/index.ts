import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";
import { requirePrimaryWallet, requireUser } from "../_shared/supabase.ts";

type VoteNeoRequest = {
  app_id: string;
  proposal_id: string;
  neo_amount: string;
  support?: boolean;
};

// Thin gateway:
// - validates auth + basic shape
// - enforces NEO-only governance
// - returns an invocation "intent" for the SDK/wallet to sign and submit
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const walletCheck = await requirePrimaryWallet(auth.userId);
  if (walletCheck instanceof Response) return walletCheck;

  let body: VoteNeoRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON");
  }

  const appId = (body.app_id ?? "").trim();
  if (!appId) return error(400, "app_id required", "APP_ID_REQUIRED");

  const proposalId = String(body.proposal_id ?? "").trim();
  if (!proposalId) return error(400, "proposal_id required", "PROPOSAL_ID_REQUIRED");

  const support = body.support ?? true;

  const amountStr = String(body.neo_amount ?? "").trim();
  if (!/^\d+$/.test(amountStr)) return error(400, "neo_amount must be an integer string", "AMOUNT_INVALID");
  const amount = BigInt(amountStr);
  if (amount <= 0n) return error(400, "neo_amount must be > 0", "AMOUNT_INVALID");

  const governanceHash = mustGetEnv("CONTRACT_GOVERNANCE_HASH").replace(/^0x/i, "");

  const requestId = crypto.randomUUID();

  return json({
    request_id: requestId,
    user_id: auth.userId,
    intent: "governance",
    constraints: { governance: "NEO_ONLY" },
    invocation: {
      contract_hash: governanceHash,
      method: "Vote",
      params: [
        { type: "String", value: proposalId },
        { type: "Boolean", value: support },
        { type: "Integer", value: amount.toString() },
      ],
    },
  });
});
