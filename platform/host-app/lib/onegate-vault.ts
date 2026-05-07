import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidWalletAddress } from "@/lib/wallet-user";

export const ONEGATE_VAULT_MIN_REWARD_FIXED8 = 100000000n;
export const ONEGATE_VAULT_MAX_REWARD_FIXED8 = 5000000000n;

export type OneGateVaultNetwork = "mainnet" | "testnet";
export type OneGateVaultCampaignStatus = "active" | "paused" | "expired";
export type OneGateVaultClaimStatus = "unused" | "pending" | "submitted" | "paid" | "failed";

export type OneGateVaultCampaign = {
  id: string;
  network: OneGateVaultNetwork;
  status: OneGateVaultCampaignStatus;
  minAmountFixed8: string;
  maxAmountFixed8: string;
  remainingAmountFixed8: string;
  maxClaims: number;
  claimedCount: number;
  expiresAt?: string | null;
};

export type OneGateVaultClaimKey = {
  keyHash: string;
  campaignId: string;
  network: OneGateVaultNetwork;
  status: OneGateVaultClaimStatus;
  walletAddress?: string | null;
  amountFixed8?: string | null;
  txHash?: string | null;
  requestId?: string | null;
  errorMessage?: string | null;
};

export type ReservedOneGateVaultClaim = {
  keyHash: string;
  campaignId: string;
  network: OneGateVaultNetwork;
  status: OneGateVaultClaimStatus;
  walletAddress: string;
  amountFixed8: string;
  txHash?: string | null;
  requestId: string;
};

export type OneGateVaultClaimResult = {
  status: "submitted" | "paid";
  claimKey: string;
  address: string;
  network: OneGateVaultNetwork;
  amount: string;
  amountFixed8: string;
  luckPercent: string;
  txHash: string;
  requestId: string;
};

export interface OneGateVaultRepository {
  reserveClaim(input: {
    keyHash: string;
    address: string;
    network: OneGateVaultNetwork;
    requestId: string;
    randomInt: (min: bigint, max: bigint) => bigint;
  }): Promise<ReservedOneGateVaultClaim>;
  markSubmitted(input: {
    keyHash: string;
    txHash: string;
    requestId: string;
  }): Promise<void>;
  markPaid(input: {
    keyHash: string;
    txHash: string;
    requestId: string;
  }): Promise<void>;
  markFailed(input: {
    keyHash: string;
    requestId: string;
    errorMessage: string;
  }): Promise<void>;
  getClaimStatus(input: {
    keyHash: string;
    address?: string;
    network: OneGateVaultNetwork;
  }): Promise<ReservedOneGateVaultClaim | null>;
}

export interface OneGateVaultPaymentService {
  sendGas(input: {
    requestId: string;
    network: OneGateVaultNetwork;
    toAddress: string;
    amountFixed8: string;
  }): Promise<{ txHash: string; status: "submitted" | "paid" }>;
}

export class OneGateVaultError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OneGateVaultError";
    this.code = code;
  }
}

function asFixed8BigInt(value: unknown): bigint {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

function assertNetwork(value: unknown): OneGateVaultNetwork {
  const network = String(value || "").trim();
  if (network === "mainnet" || network === "testnet") return network;
  throw new OneGateVaultError("INVALID_NETWORK", "network must be mainnet or testnet");
}

export function normalizeClaimKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^[A-Za-z0-9_:-]{6,128}$/.test(raw) ? raw : "";
}

export function hashClaimKey(claimKey: string, pepper: string): string {
  return crypto
    .createHash("sha256")
    .update(`${pepper}:${claimKey}`, "utf8")
    .digest("hex");
}

export function formatFixed8Gas(value: string | bigint | number): string {
  const fixed8 = asFixed8BigInt(value);
  const sign = fixed8 < 0n ? "-" : "";
  const absolute = fixed8 < 0n ? -fixed8 : fixed8;
  const whole = absolute / 100000000n;
  const fraction = String(absolute % 100000000n).padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

export function calculateOneGateVaultLuckPercent(value: string | bigint | number): string {
  const amount = asFixed8BigInt(value);
  const clamped =
    amount < 0n
      ? 0n
      : amount > ONEGATE_VAULT_MAX_REWARD_FIXED8
        ? ONEGATE_VAULT_MAX_REWARD_FIXED8
        : amount;
  const basisPoints = (clamped * 10000n) / ONEGATE_VAULT_MAX_REWARD_FIXED8;
  const whole = basisPoints / 100n;
  const fraction = String(basisPoints % 100n).padStart(2, "0");
  return `${whole}.${fraction}`;
}

function assertOneGateVaultRewardRange(min: bigint, max: bigint) {
  if (
    min < ONEGATE_VAULT_MIN_REWARD_FIXED8 ||
    max > ONEGATE_VAULT_MAX_REWARD_FIXED8 ||
    min > max
  ) {
    throw new OneGateVaultError("INVALID_REWARD_RANGE", "reward range must stay within 1-50 GAS");
  }
}

export function secureRandomFixed8(min: bigint, max: bigint): bigint {
  if (min > max) throw new OneGateVaultError("INVALID_REWARD_RANGE", "minimum reward exceeds maximum reward");
  const span = max - min + 1n;
  if (span <= 0n) return min;
  const bytes = Math.max(8, Math.ceil(span.toString(2).length / 8));
  const limit = (1n << BigInt(bytes * 8)) - ((1n << BigInt(bytes * 8)) % span);
  let sample = 0n;
  do {
    sample = BigInt(`0x${crypto.randomBytes(bytes).toString("hex")}`);
  } while (sample >= limit);
  return min + (sample % span);
}

export async function claimOneGateVaultReward(
  input: { claimKey: unknown; address: unknown; network: unknown },
  deps: {
    repository: OneGateVaultRepository;
    payment: OneGateVaultPaymentService;
    keyPepper: string;
    randomInt?: (min: bigint, max: bigint) => bigint;
  },
): Promise<OneGateVaultClaimResult> {
  const claimKey = normalizeClaimKey(input.claimKey);
  if (!claimKey) throw new OneGateVaultError("INVALID_CLAIM_KEY", "claim key is invalid");

  const address = String(input.address ?? "").trim();
  if (!isValidWalletAddress(address)) {
    throw new OneGateVaultError("INVALID_ADDRESS", "Neo N3 address is invalid");
  }

  const network = assertNetwork(input.network);
  const keyHash = hashClaimKey(claimKey, deps.keyPepper);
  const requestId = `ogv_${Date.now().toString(36)}_${keyHash.slice(0, 16)}`;
  const reserved = await deps.repository.reserveClaim({
    keyHash,
    address,
    network,
    requestId,
    randomInt: deps.randomInt ?? secureRandomFixed8,
  });

  if (reserved.txHash && (reserved.status === "paid" || reserved.status === "submitted")) {
    return toClaimResult({ claimKey, address, reserved });
  }

  try {
    const payment = await deps.payment.sendGas({
      requestId: reserved.requestId,
      network,
      toAddress: address,
      amountFixed8: reserved.amountFixed8,
    });
    if (payment.status === "paid") {
      await deps.repository.markPaid({ keyHash, txHash: payment.txHash, requestId: reserved.requestId });
    } else {
      await deps.repository.markSubmitted({ keyHash, txHash: payment.txHash, requestId: reserved.requestId });
    }
    return toClaimResult({
      claimKey,
      address,
      reserved: {
        ...reserved,
        status: payment.status,
        txHash: payment.txHash,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "payment failed";
    await deps.repository.markFailed({ keyHash, requestId: reserved.requestId, errorMessage }).catch(() => undefined);
    throw new OneGateVaultError("PAYMENT_FAILED", errorMessage);
  }
}

function toClaimResult(input: {
  claimKey: string;
  address: string;
  reserved: ReservedOneGateVaultClaim;
}): OneGateVaultClaimResult {
  return {
    status: input.reserved.status === "paid" ? "paid" : "submitted",
    claimKey: input.claimKey,
    address: input.address,
    network: input.reserved.network,
    amount: formatFixed8Gas(input.reserved.amountFixed8),
    amountFixed8: input.reserved.amountFixed8,
    luckPercent: calculateOneGateVaultLuckPercent(input.reserved.amountFixed8),
    txHash: input.reserved.txHash || "",
    requestId: input.reserved.requestId,
  };
}

export function createInMemoryOneGateVaultRepository(seed: {
  campaigns: OneGateVaultCampaign[];
  claimKeys: OneGateVaultClaimKey[];
}): OneGateVaultRepository {
  const campaigns = new Map(seed.campaigns.map((campaign) => [campaign.id, { ...campaign }]));
  const claimKeys = new Map(seed.claimKeys.map((claimKey) => [claimKey.keyHash, { ...claimKey }]));

  return {
    async reserveClaim(input) {
      const claimKey = claimKeys.get(input.keyHash);
      if (!claimKey || claimKey.network !== input.network) {
        throw new OneGateVaultError("CLAIM_KEY_NOT_FOUND", "claim key was not found");
      }
      if (claimKey.walletAddress && claimKey.walletAddress !== input.address) {
        throw new OneGateVaultError("CLAIM_KEY_USED", "claim key has already been used by another wallet");
      }

      const campaign = campaigns.get(claimKey.campaignId);
      if (!campaign || campaign.network !== input.network) {
        throw new OneGateVaultError("VAULT_NOT_FOUND", "reward vault was not found");
      }
      if (campaign.status !== "active") {
        throw new OneGateVaultError("VAULT_INACTIVE", "reward vault is not active");
      }
      if (campaign.expiresAt && Date.parse(campaign.expiresAt) <= Date.now()) {
        throw new OneGateVaultError("VAULT_EXPIRED", "reward vault has expired");
      }

      if (claimKey.walletAddress === input.address && claimKey.amountFixed8 && claimKey.requestId) {
        return {
          keyHash: claimKey.keyHash,
          campaignId: claimKey.campaignId,
          network: claimKey.network,
          status: claimKey.status === "unused" ? "pending" : claimKey.status,
          walletAddress: input.address,
          amountFixed8: claimKey.amountFixed8,
          txHash: claimKey.txHash ?? null,
          requestId: claimKey.requestId,
        };
      }

      const remaining = asFixed8BigInt(campaign.remainingAmountFixed8);
      const min = asFixed8BigInt(campaign.minAmountFixed8);
      const max = asFixed8BigInt(campaign.maxAmountFixed8);
      assertOneGateVaultRewardRange(min, max);
      if (campaign.claimedCount >= campaign.maxClaims || remaining < min) {
        throw new OneGateVaultError("VAULT_EMPTY", "reward vault has no claimable GAS left");
      }

      const cappedMax = max > remaining ? remaining : max;
      const amount = input.randomInt(min, cappedMax);
      if (amount < min || amount > cappedMax) {
        throw new OneGateVaultError("INVALID_REWARD_RANGE", "generated reward is outside the configured range");
      }

      campaign.remainingAmountFixed8 = String(remaining - amount);
      campaign.claimedCount += 1;
      claimKey.status = "pending";
      claimKey.walletAddress = input.address;
      claimKey.amountFixed8 = String(amount);
      claimKey.requestId = input.requestId;
      claimKey.errorMessage = null;

      return {
        keyHash: claimKey.keyHash,
        campaignId: claimKey.campaignId,
        network: claimKey.network,
        status: "pending",
        walletAddress: input.address,
        amountFixed8: claimKey.amountFixed8,
        txHash: claimKey.txHash ?? null,
        requestId: input.requestId,
      };
    },

    async markSubmitted(input) {
      const claimKey = claimKeys.get(input.keyHash);
      if (!claimKey) return;
      claimKey.status = "submitted";
      claimKey.txHash = input.txHash;
      claimKey.requestId = input.requestId;
    },

    async markPaid(input) {
      const claimKey = claimKeys.get(input.keyHash);
      if (!claimKey) return;
      claimKey.status = "paid";
      claimKey.txHash = input.txHash;
      claimKey.requestId = input.requestId;
    },

    async markFailed(input) {
      const claimKey = claimKeys.get(input.keyHash);
      if (!claimKey) return;
      claimKey.status = "failed";
      claimKey.errorMessage = input.errorMessage;
      claimKey.requestId = input.requestId;
    },

    async getClaimStatus(input) {
      const claimKey = claimKeys.get(input.keyHash);
      if (!claimKey || claimKey.network !== input.network) return null;
      if (input.address && claimKey.walletAddress && claimKey.walletAddress !== input.address) {
        throw new OneGateVaultError("CLAIM_KEY_USED", "claim key has already been used by another wallet");
      }
      if (!claimKey.walletAddress || !claimKey.amountFixed8 || !claimKey.requestId) return null;
      return {
        keyHash: claimKey.keyHash,
        campaignId: claimKey.campaignId,
        network: claimKey.network,
        status: claimKey.status,
        walletAddress: claimKey.walletAddress,
        amountFixed8: claimKey.amountFixed8,
        txHash: claimKey.txHash ?? null,
        requestId: claimKey.requestId,
      };
    },
  };
}

function mapReservedClaim(row: Record<string, unknown>): ReservedOneGateVaultClaim {
  return {
    keyHash: String(row.key_hash ?? row.keyHash ?? ""),
    campaignId: String(row.campaign_id ?? row.campaignId ?? ""),
    network: assertNetwork(row.network),
    status: String(row.status ?? "pending") as OneGateVaultClaimStatus,
    walletAddress: String(row.wallet_address ?? row.walletAddress ?? ""),
    amountFixed8: String(row.amount_fixed8 ?? row.amountFixed8 ?? "0"),
    txHash: row.tx_hash || row.txHash ? String(row.tx_hash ?? row.txHash) : null,
    requestId: String(row.request_id ?? row.requestId ?? ""),
  };
}

export function createSupabaseOneGateVaultRepository(supabase: SupabaseClient): OneGateVaultRepository {
  return {
    async reserveClaim(input) {
      const { data, error } = await supabase.rpc("onegate_vault_reserve_claim", {
        p_key_hash: input.keyHash,
        p_wallet_address: input.address,
        p_network: input.network,
        p_request_id: input.requestId,
      });
      if (error) throw mapSupabaseVaultError(error);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new OneGateVaultError("CLAIM_KEY_NOT_FOUND", "claim key was not found");
      return mapReservedClaim(row as Record<string, unknown>);
    },

    async markSubmitted(input) {
      await updateSupabaseClaim(supabase, input.keyHash, {
        status: "submitted",
        tx_hash: input.txHash,
        request_id: input.requestId,
        submitted_at: new Date().toISOString(),
      });
    },

    async markPaid(input) {
      await updateSupabaseClaim(supabase, input.keyHash, {
        status: "paid",
        tx_hash: input.txHash,
        request_id: input.requestId,
        paid_at: new Date().toISOString(),
      });
    },

    async markFailed(input) {
      await updateSupabaseClaim(supabase, input.keyHash, {
        status: "failed",
        error_message: input.errorMessage.slice(0, 500),
        request_id: input.requestId,
        failed_at: new Date().toISOString(),
      });
    },

    async getClaimStatus(input) {
      const { data, error } = await supabase
        .from("onegate_vault_claim_keys")
        .select("key_hash,campaign_id,network,status,wallet_address,amount_fixed8,tx_hash,request_id")
        .eq("key_hash", input.keyHash)
        .eq("network", input.network)
        .maybeSingle();
      if (error) throw mapSupabaseVaultError(error);
      if (!data) return null;
      const row = data as Record<string, unknown>;
      const walletAddress = String(row.wallet_address ?? "");
      if (input.address && walletAddress && walletAddress !== input.address) {
        throw new OneGateVaultError("CLAIM_KEY_USED", "claim key has already been used by another wallet");
      }
      if (!walletAddress || !row.amount_fixed8 || !row.request_id) return null;
      return mapReservedClaim(row);
    },
  };
}

async function updateSupabaseClaim(supabase: SupabaseClient, keyHash: string, values: Record<string, unknown>) {
  const { error } = await supabase
    .from("onegate_vault_claim_keys")
    .update(values)
    .eq("key_hash", keyHash);
  if (error) throw mapSupabaseVaultError(error);
}

function mapSupabaseVaultError(error: { message?: string; code?: string }): OneGateVaultError {
  const message = String(error.message || "vault storage error");
  if (/already.*used|CLAIM_KEY_USED/i.test(message)) return new OneGateVaultError("CLAIM_KEY_USED", message);
  if (/not.*found|CLAIM_KEY_NOT_FOUND/i.test(message)) return new OneGateVaultError("CLAIM_KEY_NOT_FOUND", message);
  if (/inactive|paused|VAULT_INACTIVE/i.test(message)) return new OneGateVaultError("VAULT_INACTIVE", message);
  if (/expired|VAULT_EXPIRED/i.test(message)) return new OneGateVaultError("VAULT_EXPIRED", message);
  if (/empty|insufficient|VAULT_EMPTY/i.test(message)) return new OneGateVaultError("VAULT_EMPTY", message);
  if (/reward.*range|INVALID_REWARD_RANGE/i.test(message)) return new OneGateVaultError("INVALID_REWARD_RANGE", message);
  return new OneGateVaultError("VAULT_STORAGE_ERROR", message);
}

export function createTxProxyOneGateVaultPaymentService(options: {
  txProxyUrl?: string;
  rewardSource?: string;
} = {}): OneGateVaultPaymentService {
  const txProxyUrl =
    options.txProxyUrl ||
    process.env.ONEGATE_VAULT_TX_PROXY_URL ||
    process.env.TX_PROXY_URL ||
    process.env.TXPROXY_URL ||
    "";
  const rewardSource = options.rewardSource || process.env.ONEGATE_VAULT_REWARD_SOURCE || "PLATFORM_SPONSOR";
  const gasContractHash = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

  return {
    async sendGas(input) {
      if (!txProxyUrl) {
        throw new OneGateVaultError("PAYMENT_NOT_CONFIGURED", "OneGate Vault tx-proxy is not configured");
      }
      const response = await fetch(`${txProxyUrl.replace(/\/+$/, "")}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: input.requestId,
          network: input.network,
          intent: "onegate-vault-reward",
          contract_hash: gasContractHash,
          operation: "transfer",
          params: [
            { type: "Hash160", value: rewardSource },
            { type: "Hash160", value: input.toAddress },
            { type: "Integer", value: input.amountFixed8 },
            { type: "Any", value: null },
          ],
          wait: true,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage =
          typeof body?.error === "string"
            ? body.error
            : typeof body?.error?.message === "string"
              ? body.error.message
              : "tx-proxy rejected OneGate Vault payout";
        throw new OneGateVaultError("PAYMENT_FAILED", errorMessage);
      }
      const txHash = String(body.tx_hash || body.txid || body.txHash || "");
      if (!txHash) throw new OneGateVaultError("PAYMENT_FAILED", "tx-proxy did not return a transaction hash");
      const status = body.status === "paid" || body.confirmed === true ? "paid" : "submitted";
      return { txHash, status };
    },
  };
}
