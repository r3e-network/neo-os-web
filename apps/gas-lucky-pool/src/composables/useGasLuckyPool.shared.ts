import type { MiniAppFramework } from "@shared/react";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { parseHash160 } from "@shared/utils/neo";

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
  app: MiniAppFramework;
  launchContext: MiniAppLaunchContext;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Runtime compatibility gate; production passes false until v2 is verified. */
  paidLaneEnabled?: boolean;
  /** Separate OneGate server-claim attestation gate. */
  oneGateClaimEnabled?: boolean;
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

function asChainBoolean(value: unknown): boolean | null {
  if (value === true || value === 1 || value === 1n || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === 0n || value === "0" || value === "false") return false;
  return null;
}

export function parsePoolAccount(value: unknown): string {
  return parseHash160(value) || String(value ?? "").trim();
}

export function parsePool(id: string, raw: unknown): GasLuckyPool | null {
  if (!Array.isArray(raw) || raw.length < 11) return null;
  const creator = parsePoolAccount(raw[0]);
  const totalAmount = asBigInt(raw[1]);
  const minClaimAmount = asBigInt(raw[2]);
  const maxClaimAmount = asBigInt(raw[3]);
  const expiryTime = asNumber(raw[9]);
  const claimedCount = asNumber(raw[5]);
  const maxClaims = asNumber(raw[4]);
  const remainingAmount = asBigInt(raw[6]);
  const bestLuckAmount = asBigInt(raw[8]);
  const active = asChainBoolean(raw[10]);
  if (
    !creator ||
    totalAmount <= 0n ||
    minClaimAmount <= 0n ||
    maxClaimAmount < minClaimAmount ||
    !Number.isSafeInteger(maxClaims) ||
    maxClaims < 1 ||
    !Number.isSafeInteger(claimedCount) ||
    claimedCount < 0 ||
    claimedCount > maxClaims ||
    remainingAmount < 0n ||
    remainingAmount > totalAmount ||
    bestLuckAmount < 0n ||
    bestLuckAmount > maxClaimAmount ||
    !Number.isSafeInteger(expiryTime) ||
    expiryTime <= 0 ||
    active === null
  ) {
    return null;
  }
  // ExpiryTime is stored in MILLISECONDS on-chain (Runtime.Time is ms on Neo N3),
  // so compare against Date.now() directly — dividing by 1000 made every live
  // pool's expiry look ~1000× in the past and rendered expired pools as active.
  const expired = expiryTime > 0 && Date.now() > expiryTime;
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
    creator,
    totalAmount,
    minClaimAmount,
    maxClaimAmount,
    maxClaims,
    claimedCount,
    remainingAmount,
    bestLuckAddress: parsePoolAccount(raw[7]),
    bestLuckAmount,
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
