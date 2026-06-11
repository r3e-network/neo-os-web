import type { ChainService } from "@shared/services/ChainService";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";

export const APP_ID = "miniapp-gas-lucky-pool";
export const ONEGATE_VAULT_DAPP_ID = "23";
export const ONEGATE_VAULT_APP_URL = `https://onegate.space/app/${ONEGATE_VAULT_DAPP_ID}`;
export const ONE_GAS_FIXED8 = 100000000n;
export const MAX_VAULT_REWARD_FIXED8 = 50n * ONE_GAS_FIXED8;

export type GasPoolStatus =
  | "draft"
  | "active"
  | "empty"
  | "expired"
  | "unknown";
export type GasPoolSuccessType =
  | ""
  | "create"
  | "claim"
  | "refund"
  | "fund"
  | "withdraw";
export type GasPoolClaimProgress =
  | ""
  | "wallet"
  | "submitting"
  | "confirming"
  | "paid"
  | "failed";

export interface GasLuckyPool {
  id: string;
  creator: string;
  totalAmount: bigint;
  minClaimAmount: bigint;
  maxClaimAmount: bigint;
  maxClaims: number;
  claimedCount: number;
  remainingAmount: bigint;
  bestLuckAddress: string;
  bestLuckAmount: bigint;
  expiryTime: number;
  active: boolean;
  status: GasPoolStatus;
}

export interface GasLuckyClaim {
  id: string;
  poolId: string;
  claimer: string;
  amount: bigint;
  txid?: string;
}

export interface CreatePoolForm {
  totalAmount?: string;
  minClaim?: string;
  maxClaim?: string;
  maxClaims?: string;
  expiryHours?: string;
}

export interface TopUpPoolForm {
  poolId?: string;
  amount?: string;
}

export interface ClaimLaunchIdentity {
  poolId?: string;
  oneGateAppId?: string;
  appId?: string;
  walletAddress?: string;
}

export interface UseGasLuckyPoolOptions {
  chain: ChainService;
  launchContext: MiniAppLaunchContext;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function asBigInt(value: unknown): bigint {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

export function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parsePool(id: string, raw: unknown): GasLuckyPool | null {
  if (!Array.isArray(raw) || raw.length < 11) return null;
  const expiryTime = asNumber(raw[9]);
  const claimedCount = asNumber(raw[5]);
  const maxClaims = asNumber(raw[4]);
  const remainingAmount = asBigInt(raw[6]);
  const active = Boolean(raw[10]);
  const expired = expiryTime > 0 && Math.floor(Date.now() / 1000) > expiryTime;
  const empty = remainingAmount <= 0n || claimedCount >= maxClaims;
  const status: GasPoolStatus = empty
    ? "empty"
    : expired
      ? "expired"
      : active
        ? "active"
        : "unknown";

  return {
    id,
    creator: String(raw[0] ?? ""),
    totalAmount: asBigInt(raw[1]),
    minClaimAmount: asBigInt(raw[2]),
    maxClaimAmount: asBigInt(raw[3]),
    maxClaims,
    claimedCount,
    remainingAmount,
    bestLuckAddress: String(raw[7] ?? ""),
    bestLuckAmount: asBigInt(raw[8]),
    expiryTime,
    active,
    status,
  };
}

export { eventValue } from "@shared/utils/chain-events";

export function isWalletUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /wallet (not detected|unavailable|not connected)|install a nep-21|neoline extension/i.test(
    message,
  );
}

export function normalizePoolId(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^\d{1,32}$/.test(raw) ? raw : "";
}

export function normalizeClaimKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^[A-Za-z0-9_:-]{6,128}$/.test(raw) ? raw : "";
}

export function normalizeNeoAddress(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^N[1-9A-HJ-NP-Za-km-z]{33}$/.test(raw) ? raw : "";
}

export function normalizeClaimIdentity(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(raw) ? raw : "";
}
