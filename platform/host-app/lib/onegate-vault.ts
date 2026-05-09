import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addressToScriptHash } from "@/lib/chain";
import { isValidWalletAddress } from "@/lib/wallet-user";

export const ONEGATE_VAULT_MIN_REWARD_FIXED8 = 100000000n;
export const ONEGATE_VAULT_MAX_REWARD_FIXED8 = 5000000000n;

export type OneGateVaultNetwork = "mainnet" | "testnet";
export type OneGateVaultCampaignStatus = "active" | "paused" | "expired";
export type OneGateVaultClaimStatus =
  | "unused"
  | "pending"
  | "submitted"
  | "paid"
  | "failed";

export type OneGateVaultCampaign = {
  id: string;
  appId?: string | null;
  oneGateAppId?: string | null;
  network: OneGateVaultNetwork;
  status: OneGateVaultCampaignStatus;
  minAmountFixed8: string;
  maxAmountFixed8: string;
  remainingAmountFixed8: string;
  maxClaims: number;
  claimedCount: number;
  rewardSource?: string | null;
  expiresAt?: string | null;
};

export type OneGateVaultClaimKey = {
  keyHash: string;
  campaignId: string;
  claimKeyId?: string | null;
  oneGateAppId?: string | null;
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
  rewardSource?: string | null;
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

export type OneGateVaultLaunchIdentity = {
  poolId?: string;
  oneGateAppId?: string;
  appId?: string;
};

export interface OneGateVaultRepository {
  reserveClaim(input: {
    keyHash: string;
    address: string;
    network: OneGateVaultNetwork;
    requestId: string;
    randomInt: (min: bigint, max: bigint) => bigint;
  } & OneGateVaultLaunchIdentity): Promise<ReservedOneGateVaultClaim>;
  markSubmitted(input: {
    keyHash: string;
    network: OneGateVaultNetwork;
    txHash: string;
    requestId: string;
  }): Promise<void>;
  markPaid(input: {
    keyHash: string;
    network: OneGateVaultNetwork;
    txHash: string;
    requestId: string;
  }): Promise<void>;
  markFailed(input: {
    keyHash: string;
    network: OneGateVaultNetwork;
    requestId: string;
    errorMessage: string;
  }): Promise<void>;
  getClaimStatus(input: {
    keyHash: string;
    address?: string;
    network: OneGateVaultNetwork;
  } & OneGateVaultLaunchIdentity): Promise<ReservedOneGateVaultClaim | null>;
}

export interface OneGateVaultPaymentService {
  sendGas(input: {
    requestId: string;
    network: OneGateVaultNetwork;
    toAddress: string;
    amountFixed8: string;
    rewardSource?: string | null;
  }): Promise<{ txHash: string; status: "submitted" | "paid" }>;
}

type OneGateVaultPayoutCheck = {
  ok: boolean;
  reason?: string;
};

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
  throw new OneGateVaultError(
    "INVALID_NETWORK",
    "network must be mainnet or testnet",
  );
}

function normalizeOptionalVaultId(
  value: unknown,
  code: string,
  label: string,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  if (/^[A-Za-z0-9_.:-]{1,128}$/.test(normalized)) return normalized;
  throw new OneGateVaultError(code, `${label} is invalid`);
}

function normalizeLaunchIdentity(input: {
  poolId?: unknown;
  oneGateAppId?: unknown;
  appId?: unknown;
}): OneGateVaultLaunchIdentity {
  return {
    poolId: normalizeOptionalVaultId(input.poolId, "INVALID_POOL_ID", "pool id"),
    oneGateAppId: normalizeOptionalVaultId(
      input.oneGateAppId,
      "INVALID_ONEGATE_APP_ID",
      "OneGate app id",
    ),
    appId: normalizeOptionalVaultId(input.appId, "INVALID_APP_ID", "miniapp id"),
  };
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
  const fraction = String(absolute % 100000000n)
    .padStart(8, "0")
    .replace(/0+$/, "");
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

export function calculateOneGateVaultLuckPercent(
  value: string | bigint | number,
): string {
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
    throw new OneGateVaultError(
      "INVALID_REWARD_RANGE",
      "reward range must stay within 1-50 GAS",
    );
  }
}

export function secureRandomFixed8(min: bigint, max: bigint): bigint {
  if (min > max)
    throw new OneGateVaultError(
      "INVALID_REWARD_RANGE",
      "minimum reward exceeds maximum reward",
    );
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

function secureRandomUint64String(): string {
  return BigInt(`0x${crypto.randomBytes(8).toString("hex")}`).toString();
}

export function normalizeOneGateVaultHash160(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^N[A-Za-z0-9]{33}$/.test(raw)) {
    return addressToScriptHash(raw);
  }
  const hex = String(value || "").trim().replace(/^0x/i, "").toLowerCase();
  return /^[0-9a-f]{40}$/.test(hex) ? `0x${hex}` : "";
}

function hash160NotificationBytes(hash160: string): string {
  const normalized = normalizeOneGateVaultHash160(hash160);
  if (!normalized) return "";
  return Buffer.from(normalized.replace(/^0x/i, ""), "hex")
    .reverse()
    .toString("base64");
}

function normalizeOneGateVaultTransferAccount(value: string): string {
  return normalizeOneGateVaultHash160(value);
}

function getAppLogExecutions(appLog: unknown): Array<Record<string, unknown>> {
  if (!appLog || typeof appLog !== "object") return [];
  const source = appLog as Record<string, unknown>;
  const result =
    source.result && typeof source.result === "object"
      ? (source.result as Record<string, unknown>)
      : source;
  return Array.isArray(result.executions)
    ? (result.executions as Array<Record<string, unknown>>)
    : [];
}

function stackTopIsTrue(execution: Record<string, unknown>): boolean {
  const stack = Array.isArray(execution.stack)
    ? (execution.stack as Array<Record<string, unknown>>)
    : [];
  const top = stack[0];
  return (
    top &&
    String(top.type || "").toLowerCase() === "boolean" &&
    (top.value === true || String(top.value).toLowerCase() === "true")
  );
}

function notificationMatchesPayout(
  notification: Record<string, unknown>,
  toHash160: string,
  amountFixed8: string,
): boolean {
  if (
    String(notification.contract || "").toLowerCase() !==
      "0xd2a4cff31913016155e38e474a2c06d08be276cf" ||
    String(notification.eventname || notification.eventName || "").toLowerCase() !==
      "transfer"
  ) {
    return false;
  }
  const state = notification.state as Record<string, unknown> | undefined;
  const values = Array.isArray(state?.value)
    ? (state?.value as Array<Record<string, unknown>>)
    : [];
  const expectedTo = hash160NotificationBytes(toHash160);
  return (
    String(values[1]?.value || "") === expectedTo &&
    String(values[2]?.value || "") === String(amountFixed8)
  );
}

export function validateOneGateVaultPayoutAppLog(input: {
  appLog: unknown;
  toAddressOrHash: string;
  amountFixed8: string;
}): OneGateVaultPayoutCheck {
  const executions = getAppLogExecutions(input.appLog);
  const execution = executions.find(
    (item) => String(item.trigger || "").toLowerCase() === "application",
  ) ?? executions[0];
  if (!execution) return { ok: false, reason: "application log is unavailable" };
  if (String(execution.vmstate || "").toUpperCase() !== "HALT") {
    return {
      ok: false,
      reason: String(execution.exception || "transaction did not HALT"),
    };
  }
  if (!stackTopIsTrue(execution)) {
    return { ok: false, reason: "GAS transfer returned false" };
  }
  const toHash160 = normalizeOneGateVaultHash160(input.toAddressOrHash);
  const notifications = Array.isArray(execution.notifications)
    ? (execution.notifications as Array<Record<string, unknown>>)
    : [];
  if (
    !notifications.some((notification) =>
      notificationMatchesPayout(notification, toHash160, input.amountFixed8),
    )
  ) {
    return { ok: false, reason: "GAS Transfer event was not emitted" };
  }
  return { ok: true };
}

export async function claimOneGateVaultReward(
  input: {
    claimKey: unknown;
    address: unknown;
    network: unknown;
    poolId?: unknown;
    oneGateAppId?: unknown;
    appId?: unknown;
  },
  deps: {
    repository: OneGateVaultRepository;
    payment: OneGateVaultPaymentService;
    keyPepper: string;
    randomInt?: (min: bigint, max: bigint) => bigint;
  },
): Promise<OneGateVaultClaimResult> {
  const claimKey = normalizeClaimKey(input.claimKey);
  if (!claimKey)
    throw new OneGateVaultError("INVALID_CLAIM_KEY", "claim key is invalid");

  const address = String(input.address ?? "").trim();
  if (!isValidWalletAddress(address)) {
    throw new OneGateVaultError("INVALID_ADDRESS", "Neo N3 address is invalid");
  }

  const network = assertNetwork(input.network);
  const launchIdentity = normalizeLaunchIdentity(input);
  const keyHash = hashClaimKey(claimKey, deps.keyPepper);
  const requestId = `ogv_${Date.now().toString(36)}_${keyHash.slice(0, 16)}`;
  const reserved = await deps.repository.reserveClaim({
    keyHash,
    address,
    network,
    requestId,
    ...launchIdentity,
    randomInt: deps.randomInt ?? secureRandomFixed8,
  });

  if (
    reserved.txHash &&
    (reserved.status === "paid" || reserved.status === "submitted")
  ) {
    return toClaimResult({ claimKey, address, reserved });
  }

  try {
    const payment = await deps.payment.sendGas({
      requestId: reserved.requestId,
      network,
      toAddress: address,
      amountFixed8: reserved.amountFixed8,
      rewardSource: reserved.rewardSource,
    });
    if (payment.status === "paid") {
      await deps.repository.markPaid({
        keyHash,
        network,
        txHash: payment.txHash,
        requestId: reserved.requestId,
      });
    } else {
      await deps.repository.markSubmitted({
        keyHash,
        network,
        txHash: payment.txHash,
        requestId: reserved.requestId,
      });
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
    const errorMessage =
      error instanceof Error ? error.message : "payment failed";
    await deps.repository
      .markFailed({
        keyHash,
        network,
        requestId: reserved.requestId,
        errorMessage,
      })
      .catch(() => undefined);
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
  const campaignIdentityKey = (campaignId: string, network: OneGateVaultNetwork) =>
    `${network}:${campaignId}`;
  const claimIdentityKey = (keyHash: string, network: OneGateVaultNetwork) =>
    `${network}:${keyHash}`;
  const campaigns = new Map(
    seed.campaigns.map((campaign) => [
      campaignIdentityKey(campaign.id, campaign.network),
      { ...campaign },
    ]),
  );
  const claimKeys = new Map(
    seed.claimKeys.map((claimKey) => [
      claimIdentityKey(claimKey.keyHash, claimKey.network),
      { ...claimKey },
    ]),
  );

  return {
    async reserveClaim(input) {
      const claimKey = claimKeys.get(
        claimIdentityKey(input.keyHash, input.network),
      );
      if (!claimKey) {
        throw new OneGateVaultError(
          "CLAIM_KEY_NOT_FOUND",
          "claim key was not found",
        );
      }
      if (input.poolId && claimKey.campaignId !== input.poolId) {
        throw new OneGateVaultError(
          "POOL_MISMATCH",
          "claim key does not belong to this reward pool",
        );
      }
      if (claimKey.walletAddress && claimKey.walletAddress !== input.address) {
        throw new OneGateVaultError(
          "CLAIM_KEY_USED",
          "claim key has already been used by another wallet",
        );
      }

      const campaign = campaigns.get(
        campaignIdentityKey(claimKey.campaignId, input.network),
      );
      if (!campaign) {
        throw new OneGateVaultError(
          "VAULT_NOT_FOUND",
          "reward vault was not found",
        );
      }
      validateLaunchIdentity(input, claimKey, campaign);
      if (campaign.status !== "active") {
        throw new OneGateVaultError(
          "VAULT_INACTIVE",
          "reward vault is not active",
        );
      }
      if (campaign.expiresAt && Date.parse(campaign.expiresAt) <= Date.now()) {
        throw new OneGateVaultError(
          "VAULT_EXPIRED",
          "reward vault has expired",
        );
      }

      if (
        claimKey.walletAddress === input.address &&
        claimKey.amountFixed8 &&
        claimKey.requestId
      ) {
        if (claimKey.status === "failed") {
          claimKey.status = "pending";
          claimKey.requestId = input.requestId;
          claimKey.txHash = null;
          claimKey.errorMessage = null;
        }
        return {
          keyHash: claimKey.keyHash,
          campaignId: claimKey.campaignId,
          network: claimKey.network,
          status: claimKey.status === "unused" ? "pending" : claimKey.status,
          walletAddress: input.address,
          amountFixed8: claimKey.amountFixed8,
          txHash: claimKey.txHash ?? null,
          requestId: claimKey.requestId,
          rewardSource: campaign.rewardSource ?? null,
        };
      }

      const remaining = asFixed8BigInt(campaign.remainingAmountFixed8);
      const min = asFixed8BigInt(campaign.minAmountFixed8);
      const max = asFixed8BigInt(campaign.maxAmountFixed8);
      assertOneGateVaultRewardRange(min, max);
      if (campaign.claimedCount >= campaign.maxClaims || remaining < min) {
        throw new OneGateVaultError(
          "VAULT_EMPTY",
          "reward vault has no claimable GAS left",
        );
      }

      const cappedMax = max > remaining ? remaining : max;
      const amount = input.randomInt(min, cappedMax);
      if (amount < min || amount > cappedMax) {
        throw new OneGateVaultError(
          "INVALID_REWARD_RANGE",
          "generated reward is outside the configured range",
        );
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
        rewardSource: campaign.rewardSource ?? null,
      };
    },

    async markSubmitted(input) {
      const claimKey = claimKeys.get(
        claimIdentityKey(input.keyHash, input.network),
      );
      if (!claimKey) return;
      claimKey.status = "submitted";
      claimKey.txHash = input.txHash;
      claimKey.requestId = input.requestId;
    },

    async markPaid(input) {
      const claimKey = claimKeys.get(
        claimIdentityKey(input.keyHash, input.network),
      );
      if (!claimKey) return;
      claimKey.status = "paid";
      claimKey.txHash = input.txHash;
      claimKey.requestId = input.requestId;
    },

    async markFailed(input) {
      const claimKey = claimKeys.get(
        claimIdentityKey(input.keyHash, input.network),
      );
      if (!claimKey) return;
      claimKey.status = "failed";
      claimKey.errorMessage = input.errorMessage;
      claimKey.requestId = input.requestId;
    },

    async getClaimStatus(input) {
      const claimKey = claimKeys.get(
        claimIdentityKey(input.keyHash, input.network),
      );
      if (!claimKey) return null;
      if (input.poolId && claimKey.campaignId !== input.poolId) {
        throw new OneGateVaultError(
          "POOL_MISMATCH",
          "claim key does not belong to this reward pool",
        );
      }
      const campaign = campaigns.get(
        campaignIdentityKey(claimKey.campaignId, input.network),
      );
      if (campaign) validateLaunchIdentity(input, claimKey, campaign);
      if (
        input.address &&
        claimKey.walletAddress &&
        claimKey.walletAddress !== input.address
      ) {
        throw new OneGateVaultError(
          "CLAIM_KEY_USED",
          "claim key has already been used by another wallet",
        );
      }
      if (
        !claimKey.walletAddress ||
        !claimKey.amountFixed8 ||
        !claimKey.requestId
      )
        return null;
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

function validateLaunchIdentity(
  input: OneGateVaultLaunchIdentity,
  claimKey: OneGateVaultClaimKey,
  campaign: OneGateVaultCampaign,
) {
  if (input.appId && campaign.appId && campaign.appId !== input.appId) {
    throw new OneGateVaultError(
      "APP_ID_MISMATCH",
      "miniapp id does not match this reward pool",
    );
  }

  const expectedOneGateAppId =
    claimKey.oneGateAppId || campaign.oneGateAppId || undefined;
  if (!expectedOneGateAppId) return;
  if (!input.oneGateAppId) {
    throw new OneGateVaultError(
      "ONEGATE_APP_ID_REQUIRED",
      "OneGate app id is required for this reward pool",
    );
  }
  if (expectedOneGateAppId !== input.oneGateAppId) {
    throw new OneGateVaultError(
      "ONEGATE_APP_ID_MISMATCH",
      "OneGate app id does not match this reward pool",
    );
  }
}

function mapReservedClaim(
  row: Record<string, unknown>,
): ReservedOneGateVaultClaim {
  return {
    keyHash: String(row.key_hash ?? row.keyHash ?? ""),
    campaignId: String(row.campaign_id ?? row.campaignId ?? ""),
    network: assertNetwork(row.network),
    status: String(row.status ?? "pending") as OneGateVaultClaimStatus,
    walletAddress: String(row.wallet_address ?? row.walletAddress ?? ""),
    amountFixed8: String(row.amount_fixed8 ?? row.amountFixed8 ?? "0"),
    txHash:
      row.tx_hash || row.txHash ? String(row.tx_hash ?? row.txHash) : null,
    requestId: String(row.request_id ?? row.requestId ?? ""),
    rewardSource:
      row.reward_source || row.rewardSource
        ? String(row.reward_source ?? row.rewardSource)
        : null,
  };
}

export function createSupabaseOneGateVaultRepository(
  supabase: SupabaseClient,
): OneGateVaultRepository {
  return {
    async reserveClaim(input) {
      const { data, error } = await supabase.rpc(
        "onegate_vault_reserve_claim_v3",
        {
          p_key_hash: input.keyHash,
          p_wallet_address: input.address,
          p_network: input.network,
          p_request_id: input.requestId,
          p_random_u64: secureRandomUint64String(),
          p_pool_id: input.poolId ?? null,
          p_onegate_app_id: input.oneGateAppId ?? null,
          p_app_id: input.appId ?? null,
        },
      );
      if (error) throw mapSupabaseVaultError(error);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row)
        throw new OneGateVaultError(
          "CLAIM_KEY_NOT_FOUND",
          "claim key was not found",
        );
      const reserved = mapReservedClaim(row as Record<string, unknown>);
      if (typeof (supabase as { from?: unknown }).from !== "function") {
        return reserved;
      }
      const { data: campaign, error: campaignError } = await supabase
        .from("onegate_vault_campaigns")
        .select("reward_source")
        .eq("id", reserved.campaignId)
        .eq("network", reserved.network)
        .maybeSingle();
      if (campaignError) throw mapSupabaseVaultError(campaignError);
      return {
        ...reserved,
        rewardSource:
          campaign && typeof campaign.reward_source === "string"
            ? campaign.reward_source
            : null,
      };
    },

    async markSubmitted(input) {
      await updateSupabaseClaim(
        supabase,
        input.keyHash,
        input.network,
        {
          status: "submitted",
          tx_hash: input.txHash,
          request_id: input.requestId,
          error_message: null,
          submitted_at: new Date().toISOString(),
          failed_at: null,
        },
        input.requestId,
        ["pending", "submitted", "failed"],
      );
    },

    async markPaid(input) {
      await updateSupabaseClaim(
        supabase,
        input.keyHash,
        input.network,
        {
          status: "paid",
          tx_hash: input.txHash,
          request_id: input.requestId,
          error_message: null,
          paid_at: new Date().toISOString(),
          failed_at: null,
        },
        input.requestId,
        ["pending", "submitted", "paid", "failed"],
      );
    },

    async markFailed(input) {
      await updateSupabaseClaim(
        supabase,
        input.keyHash,
        input.network,
        {
          status: "failed",
          error_message: input.errorMessage.slice(0, 500),
          request_id: input.requestId,
          failed_at: new Date().toISOString(),
        },
        input.requestId,
        ["pending", "submitted", "failed"],
      );
    },

    async getClaimStatus(input) {
      const { data, error } = await supabase
        .from("onegate_vault_claim_keys")
        .select(
          "key_hash,campaign_id,network,status,wallet_address,amount_fixed8,tx_hash,request_id,onegate_app_id",
        )
        .eq("key_hash", input.keyHash)
        .eq("network", input.network)
        .maybeSingle();
      if (error) throw mapSupabaseVaultError(error);
      if (!data) return null;
      const row = data as Record<string, unknown>;
      if (input.poolId && String(row.campaign_id ?? "") !== input.poolId) {
        throw new OneGateVaultError(
          "POOL_MISMATCH",
          "claim key does not belong to this reward pool",
        );
      }
      const expectedOneGateAppId = String(row.onegate_app_id ?? "").trim();
      if (expectedOneGateAppId && !input.oneGateAppId) {
        throw new OneGateVaultError(
          "ONEGATE_APP_ID_REQUIRED",
          "OneGate app id is required for this reward pool",
        );
      }
      if (
        expectedOneGateAppId &&
        input.oneGateAppId &&
        expectedOneGateAppId !== input.oneGateAppId
      ) {
        throw new OneGateVaultError(
          "ONEGATE_APP_ID_MISMATCH",
          "OneGate app id does not match this reward pool",
        );
      }
      const walletAddress = String(row.wallet_address ?? "");
      if (input.address && walletAddress && walletAddress !== input.address) {
        throw new OneGateVaultError(
          "CLAIM_KEY_USED",
          "claim key has already been used by another wallet",
        );
      }
      if (!walletAddress || !row.amount_fixed8 || !row.request_id) return null;
      return mapReservedClaim(row);
    },
  };
}

async function updateSupabaseClaim(
  supabase: SupabaseClient,
  keyHash: string,
  network: OneGateVaultNetwork,
  values: Record<string, unknown>,
  requestId: string,
  allowedStatuses: OneGateVaultClaimStatus[],
) {
  const { data, error } = await supabase
    .from("onegate_vault_claim_keys")
    .update(values)
    .eq("key_hash", keyHash)
    .eq("network", network)
    .eq("request_id", requestId)
    .in("status", allowedStatuses)
    .select("key_hash,network")
    .maybeSingle();
  if (error) throw mapSupabaseVaultError(error);
  if (!data) {
    throw new OneGateVaultError(
      "CLAIM_STATE_CONFLICT",
      "claim state changed before status update",
    );
  }
}

function mapSupabaseVaultError(error: {
  message?: string;
  code?: string;
}): OneGateVaultError {
  const message = String(error.message || "vault storage error");
  if (/already.*used|CLAIM_KEY_USED/i.test(message))
    return new OneGateVaultError("CLAIM_KEY_USED", message);
  if (/not.*found|CLAIM_KEY_NOT_FOUND/i.test(message))
    return new OneGateVaultError("CLAIM_KEY_NOT_FOUND", message);
  if (/inactive|paused|VAULT_INACTIVE/i.test(message))
    return new OneGateVaultError("VAULT_INACTIVE", message);
  if (/expired|VAULT_EXPIRED/i.test(message))
    return new OneGateVaultError("VAULT_EXPIRED", message);
  if (/empty|insufficient|VAULT_EMPTY/i.test(message))
    return new OneGateVaultError("VAULT_EMPTY", message);
  if (/reward.*range|INVALID_REWARD_RANGE/i.test(message))
    return new OneGateVaultError("INVALID_REWARD_RANGE", message);
  if (/state.*changed|CLAIM_STATE_CONFLICT/i.test(message))
    return new OneGateVaultError("CLAIM_STATE_CONFLICT", message);
  if (/INVALID_POOL_ID/i.test(message))
    return new OneGateVaultError("INVALID_POOL_ID", message);
  if (/INVALID_ONEGATE_APP_ID/i.test(message))
    return new OneGateVaultError("INVALID_ONEGATE_APP_ID", message);
  if (/INVALID_APP_ID/i.test(message))
    return new OneGateVaultError("INVALID_APP_ID", message);
  if (/POOL_MISMATCH|pool.*match|pool.*belong/i.test(message))
    return new OneGateVaultError("POOL_MISMATCH", message);
  if (/ONEGATE_APP_ID_REQUIRED|onegate.*required/i.test(message))
    return new OneGateVaultError("ONEGATE_APP_ID_REQUIRED", message);
  if (/ONEGATE_APP_ID_MISMATCH|onegate.*match/i.test(message))
    return new OneGateVaultError("ONEGATE_APP_ID_MISMATCH", message);
  if (/APP_ID_MISMATCH|miniapp.*match|app.*match/i.test(message))
    return new OneGateVaultError("APP_ID_MISMATCH", message);
  return new OneGateVaultError("VAULT_STORAGE_ERROR", message);
}

export function createTxProxyOneGateVaultPaymentService(
  options: {
    txProxyUrl?: string;
    rewardSource?: string;
  } = {},
): OneGateVaultPaymentService {
  const gasContractHash = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

  return {
    async sendGas(input) {
      const txProxyUrl = resolveOneGateVaultTxProxyUrl(
        input.network,
        options.txProxyUrl,
      );
      if (!txProxyUrl) {
        throw new OneGateVaultError(
          "PAYMENT_NOT_CONFIGURED",
          "OneGate Vault tx-proxy is not configured",
        );
      }
      const rewardSource = await resolveOneGateVaultRewardSource(
        input.network,
        input.rewardSource || options.rewardSource,
      );
      if (!rewardSource) {
        throw new OneGateVaultError(
          "PAYMENT_NOT_CONFIGURED",
          "OneGate Vault reward source is not configured",
        );
      }
      const rewardSourceHash = normalizeOneGateVaultTransferAccount(rewardSource);
      const recipientHash = normalizeOneGateVaultHash160(input.toAddress);
      if (!rewardSourceHash || !recipientHash) {
        throw new OneGateVaultError(
          "PAYMENT_NOT_CONFIGURED",
          "OneGate Vault reward source or recipient is not a valid Neo Hash160",
        );
      }
      const response = await fetch(`${txProxyUrl.replace(/\/+$/, "")}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: input.requestId,
          network: input.network,
          intent: "gas-sponsor",
          contract_hash: gasContractHash,
          method: "transfer",
          params: [
            { type: "Hash160", value: rewardSourceHash },
            { type: "Hash160", value: recipientHash },
            { type: "Integer", value: input.amountFixed8 },
            { type: "Any", value: null },
          ],
          wait: true,
        }),
      });
      const responseText =
        typeof response.text === "function"
          ? await response.text().catch(() => "")
          : JSON.stringify(await response.json().catch(() => ({})));
      const body = parseTxProxyJson(responseText);
      if (!response.ok) {
        const errorMessage = getTxProxyErrorMessage(
          body,
          response.status,
          responseText,
        );
        throw new OneGateVaultError("PAYMENT_FAILED", errorMessage);
      }
      const txHash = String(body.tx_hash || body.txid || body.txHash || "");
      if (!txHash)
        throw new OneGateVaultError(
          "PAYMENT_FAILED",
          "tx-proxy did not return a transaction hash",
        );
      if (body.app_log || body.appLog) {
        const payout = validateOneGateVaultPayoutAppLog({
          appLog: body.app_log || body.appLog,
          toAddressOrHash: recipientHash,
          amountFixed8: input.amountFixed8,
        });
        if (!payout.ok) {
          throw new OneGateVaultError(
            "PAYMENT_FAILED",
            payout.reason || "GAS transfer was not confirmed",
          );
        }
        return { txHash, status: "paid" };
      }
      const status = body.status === "paid" ? "paid" : "submitted";
      return { txHash, status };
    },
  };
}

function resolveOneGateVaultTxProxyUrl(
  network: OneGateVaultNetwork,
  optionTxProxyUrl?: string,
): string {
  const networkSuffix = network === "mainnet" ? "MAINNET" : "TESTNET";
  const explicit = String(
    optionTxProxyUrl ||
      process.env[`ONEGATE_VAULT_TX_PROXY_URL_${networkSuffix}`] ||
      process.env.ONEGATE_VAULT_TX_PROXY_URL ||
      process.env[`TX_PROXY_URL_${networkSuffix}`] ||
      process.env.TX_PROXY_URL ||
      process.env.TXPROXY_URL ||
      "",
  ).trim();
  if (explicit) return explicit;

  const configuredEdgeBase = String(
    process.env.ONEGATE_VAULT_EDGE_BASE ||
      process.env.MORPHEUS_EDGE_BASE ||
      process.env.NEXT_PUBLIC_MORPHEUS_EDGE_BASE ||
      "",
  ).trim();
  if (configuredEdgeBase) {
    return `${configuredEdgeBase.replace(/\/+$/, "")}/${network}/txproxy`;
  }

  const legacyEdgeBase = String(process.env.EDGE_API_BASE || "").trim();
  if (/meshmini\.app/i.test(legacyEdgeBase)) {
    const normalized = legacyEdgeBase.replace(/\/+$/, "");
    return /\/(mainnet|testnet)$/i.test(normalized)
      ? `${normalized}/txproxy`
      : `${normalized}/${network}/txproxy`;
  }

  return `https://edge.meshmini.app/${network}/txproxy`;
}

function parseTxProxyJson(responseText: string): Record<string, unknown> {
  if (!responseText.trim()) return {};
  try {
    const parsed = JSON.parse(responseText);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function formatTxProxyHttpError(status: number, responseText: string): string {
  const compact = responseText
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return compact
    ? `tx-proxy rejected OneGate Vault payout (${status}): ${compact}`
    : `tx-proxy rejected OneGate Vault payout (${status})`;
}

function getTxProxyErrorMessage(
  body: Record<string, unknown>,
  status: number,
  responseText: string,
): string {
  const error = body.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return formatTxProxyHttpError(status, responseText);
}

async function resolveOneGateVaultRewardSource(
  network: OneGateVaultNetwork,
  optionRewardSource?: string,
): Promise<string> {
  const networkSuffix = network === "mainnet" ? "MAINNET" : "TESTNET";
  const explicit = String(
    optionRewardSource ||
      process.env[`ONEGATE_VAULT_REWARD_SOURCE_${networkSuffix}`] ||
      process.env[`ONEGATE_VAULT_REWARD_SOURCE_HASH_${networkSuffix}`] ||
      process.env.ONEGATE_VAULT_REWARD_SOURCE ||
      process.env.ONEGATE_VAULT_REWARD_SOURCE_HASH ||
      "",
  ).trim();
  if (explicit && explicit !== "PLATFORM_SPONSOR") return explicit;

  const rewardWif = String(
    process.env[`ONEGATE_VAULT_REWARD_WIF_${networkSuffix}`] ||
      process.env.ONEGATE_VAULT_REWARD_WIF ||
      "",
  ).trim();
  if (!rewardWif) return "";

  try {
    const sdk = await import("@r3e/neo-js-sdk/browser");
    const account = sdk.Account.fromWIF(rewardWif);
    return normalizeOneGateVaultHash160(account.address || account.scriptHash);
  } catch {
    return "";
  }
}
