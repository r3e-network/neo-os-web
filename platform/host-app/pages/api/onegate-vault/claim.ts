import type { NextApiRequest, NextApiResponse } from "next";
import { apiError, getRequestId, setRequestIdHeader } from "@/lib/api-response";
import {
  claimOneGateVaultReward,
  createSupabaseOneGateVaultRepository,
  createTxProxyOneGateVaultPaymentService,
  OneGateVaultError,
} from "@/lib/onegate-vault";
import { standardLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient } from "@/lib/server-supabase";

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" ? body as Record<string, unknown> : {};
}

function sendVaultError(res: NextApiResponse, error: OneGateVaultError) {
  if (["INVALID_CLAIM_KEY", "INVALID_ADDRESS", "INVALID_NETWORK", "INVALID_REWARD_RANGE"].includes(error.code)) {
    return apiError.badRequest(res, error.message);
  }
  if (error.code === "CLAIM_KEY_NOT_FOUND" || error.code === "VAULT_NOT_FOUND") {
    return apiError.notFound(res, error.message);
  }
  if (["CLAIM_KEY_USED", "VAULT_INACTIVE", "VAULT_EXPIRED", "VAULT_EMPTY"].includes(error.code)) {
    return apiError.forbidden(res, error.message);
  }
  if (error.code === "PAYMENT_NOT_CONFIGURED") {
    return apiError.configError(res, error.message);
  }
  if (error.code === "PAYMENT_FAILED") {
    return apiError.gatewayError(res, error.message);
  }
  return apiError.internal(res, error.message);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = getRequestId(req);
  setRequestIdHeader(res, requestId);

  if (req.method !== "POST") return apiError.methodNotAllowed(res);
  if (standardLimit(req, res)) return;

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) return apiError.configError(res, "Supabase service role is required for OneGate Vault claims");

  const keyPepper = String(process.env.ONEGATE_VAULT_KEY_PEPPER || "").trim();
  if (!keyPepper) return apiError.configError(res, "OneGate Vault key pepper is not configured");

  try {
    const body = parseBody(req.body);
    const result = await claimOneGateVaultReward({
      claimKey: body.claimKey,
      address: body.address,
      network: body.network,
    }, {
      repository: createSupabaseOneGateVaultRepository(supabase),
      payment: createTxProxyOneGateVaultPaymentService(),
      keyPepper,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof OneGateVaultError) return sendVaultError(res, error);
    return apiError.internal(res, error instanceof Error ? error.message : "claim failed");
  }
}
