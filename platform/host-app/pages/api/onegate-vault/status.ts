import type { NextApiRequest, NextApiResponse } from "next";
import { apiError, getRequestId, setRequestIdHeader } from "@/lib/api-response";
import {
  calculateOneGateVaultLuckPercent,
  formatFixed8Gas,
  hashClaimKey,
  normalizeClaimKey,
  createSupabaseOneGateVaultRepository,
  OneGateVaultError,
  type OneGateVaultNetwork,
} from "@/lib/onegate-vault";
import { standardLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient } from "@/lib/server-supabase";
import { isValidWalletAddress } from "@/lib/wallet-user";

function normalizeNetwork(value: unknown): OneGateVaultNetwork | "" {
  const network = String(value || "").trim();
  return network === "mainnet" || network === "testnet" ? network : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = getRequestId(req);
  setRequestIdHeader(res, requestId);

  if (req.method !== "GET") return apiError.methodNotAllowed(res);
  if (standardLimit(req, res)) return;

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) return apiError.configError(res, "Supabase service role is required for OneGate Vault status");

  const keyPepper = String(process.env.ONEGATE_VAULT_KEY_PEPPER || "").trim();
  if (!keyPepper) return apiError.configError(res, "OneGate Vault key pepper is not configured");

  const claimKey = normalizeClaimKey(req.query.claimKey);
  if (!claimKey) return apiError.badRequest(res, "claim key is invalid");

  const network = normalizeNetwork(req.query.network);
  if (!network) return apiError.badRequest(res, "network must be mainnet or testnet");

  const address = String(req.query.address || "").trim();
  if (address && !isValidWalletAddress(address)) return apiError.badRequest(res, "Neo N3 address is invalid");

  try {
    const repository = createSupabaseOneGateVaultRepository(supabase);
    const status = await repository.getClaimStatus({
      keyHash: hashClaimKey(claimKey, keyPepper),
      address: address || undefined,
      network,
    });
    if (!status) return apiError.notFound(res, "claim key has not been claimed yet");
    return res.status(200).json({
      status: status.status,
      claimKey,
      address: status.walletAddress,
      network: status.network,
      amount: formatFixed8Gas(status.amountFixed8),
      amountFixed8: status.amountFixed8,
      luckPercent: calculateOneGateVaultLuckPercent(status.amountFixed8),
      txHash: status.txHash || "",
      requestId: status.requestId,
    });
  } catch (error) {
    if (error instanceof OneGateVaultError && error.code === "CLAIM_KEY_USED") {
      return apiError.forbidden(res, error.message);
    }
    return apiError.internal(res, error instanceof Error ? error.message : "status lookup failed");
  }
}
