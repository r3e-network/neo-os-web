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

const DEFAULT_RPC: Record<OneGateVaultNetwork, string> = {
  mainnet: "https://api.n3index.dev/mainnet",
  testnet: "https://testnet1.neo.coz.io:443",
};

function getNeoRpcUrl(network: OneGateVaultNetwork): string {
  if (network === "mainnet") {
    return String(
      process.env.NEO_MAINNET_RPC_URL ||
        process.env.NEO_RPC_MAINNET ||
        DEFAULT_RPC.mainnet,
    ).trim();
  }
  return String(
    process.env.NEO_TESTNET_RPC_URL ||
      process.env.NEO_RPC_TESTNET ||
      process.env.NEO_RPC_URL ||
      DEFAULT_RPC.testnet,
  ).trim();
}

async function isTxConfirmed(
  network: OneGateVaultNetwork,
  txHash: string,
): Promise<boolean> {
  if (!/^0x[0-9a-f]{64}$/i.test(txHash)) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(getNeoRpcUrl(network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getrawtransaction",
        params: [txHash, 1],
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      result?: {
        blockhash?: unknown;
        confirmations?: unknown;
        vmstate?: unknown;
      };
    } | null;
    const tx = body?.result;
    const confirmations = Number(tx?.confirmations ?? 0);
    const vmstate = String(tx?.vmstate ?? "HALT").toUpperCase();
    return Boolean(tx?.blockhash) && confirmations > 0 && vmstate === "HALT";
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
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

  const claimKey = normalizeClaimKey(req.query.claimKey ?? req.query.key);
  if (!claimKey) return apiError.badRequest(res, "claim key is invalid");

  const network = normalizeNetwork(req.query.network);
  if (!network) return apiError.badRequest(res, "network must be mainnet or testnet");

  const address = String(req.query.address || "").trim();
  if (address && !isValidWalletAddress(address)) return apiError.badRequest(res, "Neo N3 address is invalid");

  try {
    const repository = createSupabaseOneGateVaultRepository(supabase);
    const keyHash = hashClaimKey(claimKey, keyPepper);
    let status = await repository.getClaimStatus({
      keyHash,
      address: address || undefined,
      network,
      poolId: String(req.query.poolId ?? req.query.pool ?? req.query.campaignId ?? "").trim() || undefined,
      oneGateAppId: String(req.query.oneGateAppId ?? req.query.oneGateId ?? req.query.onegateAppId ?? "").trim() || undefined,
      appId: String(req.query.appId ?? req.query.miniappId ?? "").trim() || undefined,
    });
    if (!status) return apiError.notFound(res, "claim key has not been claimed yet");
    if (
      status.status === "submitted" &&
      status.txHash &&
      (await isTxConfirmed(network, status.txHash))
    ) {
      await repository.markPaid({
        keyHash,
        network,
        txHash: status.txHash,
        requestId: status.requestId,
      });
      status = { ...status, status: "paid" };
    }
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
    if (
      error instanceof OneGateVaultError &&
      [
        "CLAIM_KEY_USED",
        "POOL_MISMATCH",
        "ONEGATE_APP_ID_REQUIRED",
        "ONEGATE_APP_ID_MISMATCH",
        "APP_ID_MISMATCH",
      ].includes(error.code)
    ) {
      return apiError.forbidden(res, error.message);
    }
    return apiError.internal(res, error instanceof Error ? error.message : "status lookup failed");
  }
}
