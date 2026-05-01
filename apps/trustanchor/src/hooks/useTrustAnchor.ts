/**
 * useTrustAnchor -- React hook for TrustAnchor staking logic.
 *
 * Uses createObservable instead of Vue ref.
 */

import { createObservable } from "@shared/react/context";
import type { ChainService, EventBus } from "@shared/services";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";

const APP_ID = "miniapp-trustanchor";
const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_DECIMALS = TOKEN_CONSTANTS.GAS_MULTIPLIER;

export interface TrustAnchorStats {
  totalStaked: number;
  rps: string;
}

export interface UseTrustAnchorOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type StackLike = { value?: unknown; key?: unknown };

function valueOf(input: unknown): unknown {
  if (input && typeof input === "object" && "value" in input) {
    return valueOf((input as StackLike).value);
  }
  return input;
}

function asNumber(input: unknown): number {
  const value = valueOf(input);
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function asMapValue(input: unknown, key: string): unknown {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  if (key in record) return record[key];
  if (Array.isArray(record.value)) {
    for (const entry of record.value as StackLike[]) {
      if (String(valueOf(entry.key)) === key) return valueOf(entry.value);
    }
  }
  if (Array.isArray(input)) {
    for (const entry of input as StackLike[]) {
      if (String(valueOf(entry.key)) === key) return valueOf(entry.value);
    }
  }
  if ("value" in record) return asMapValue(record.value, key);
  return undefined;
}

export function useTrustAnchor({ chain, eventBus, t }: UseTrustAnchorOptions) {
  const isLoading = createObservable(false);
  const error = createObservable<string | null>(null);
  const myStake = createObservable(0);
  const pendingRewards = createObservable(0);
  const pendingWithdraw = createObservable(0);
  const stats = createObservable<TrustAnchorStats | null>(null);

  const loadMyStake = async () => {
    const addr = chain.address.get();
    if (!addr) { myStake.set(0); return; }
    try {
      const result = await chain.read("getUserStake", [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: addr },
      ]);
      myStake.set(asNumber(result));
    } catch (e) {
      console.warn("[useTrustAnchor] loadMyStake failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadPendingRewards = async () => {
    const addr = chain.address.get();
    if (!addr) { pendingRewards.set(0); return; }
    try {
      const result = await chain.read("getPendingRewards", [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: addr },
      ]);
      pendingRewards.set(asNumber(result) / GAS_DECIMALS);
    } catch (e) {
      console.warn("[useTrustAnchor] loadPendingRewards failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadPendingWithdraw = async () => {
    const addr = chain.address.get();
    if (!addr) { pendingWithdraw.set(0); return; }
    try {
      const result = await chain.read("getCredit", [
        { type: "Hash160", value: addr },
        { type: "String", value: "NEO" },
      ]);
      pendingWithdraw.set(asNumber(result));
    } catch (e) {
      console.warn("[useTrustAnchor] loadPendingWithdraw failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadStats = async () => {
    try {
      const result = await chain.read("getAnchorStats", [
        { type: "String", value: APP_ID },
      ]);
      stats.set({
        totalStaked: asNumber(asMapValue(result, "totalStaked")),
        rps: String(asNumber(asMapValue(result, "rewardPerNeo"))),
      });
    } catch (e) {
      console.warn("[useTrustAnchor] loadStats failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadAll = async () => {
    isLoading.set(true);
    error.set(null);
    try {
      await Promise.all([loadMyStake(), loadPendingRewards(), loadPendingWithdraw(), loadStats()]);
    } finally {
      isLoading.set(false);
    }
  };

  const stake = async (amount: number) => {
    if (amount <= 0 || !Number.isInteger(amount)) throw new Error(t("invalidAmount"));
    const addr = await chain.ensureWallet();
    const contractAddr = chain.contractAddress.get();
    if (!contractAddr) throw new Error(t("contractUnavailable"));
    await chain.invoke("transfer", [
      { type: "Hash160", value: addr },
      { type: "Hash160", value: contractAddr },
      { type: "Integer", value: amount },
      { type: "String", value: APP_ID },
    ], { scriptHash: NEO_HASH });
    eventBus.emit("stake:completed", { amount });
    await loadAll();
  };

  const unstake = async (amount: number) => {
    if (amount <= 0 || !Number.isInteger(amount)) throw new Error(t("invalidAmount"));
    const addr = await chain.ensureWallet();
    await chain.invoke("withdraw", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: addr },
      { type: "Integer", value: amount },
    ]);
    eventBus.emit("unstake:completed", { amount });
    await loadAll();
  };

  const claimPendingWithdraw = async () => {
    const addr = await chain.ensureWallet();
    const amount = pendingWithdraw.get();
    if (amount <= 0) return;
    await chain.invoke("withdrawCredit", [
      { type: "Hash160", value: addr },
      { type: "String", value: "NEO" },
      { type: "Integer", value: amount },
    ]);
    eventBus.emit("withdraw:claimed", {});
    await loadAll();
  };

  const claimRewards = async () => {
    const addr = await chain.ensureWallet();
    await chain.invoke("claimRewards", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: addr },
    ]);
    eventBus.emit("rewards:claimed", {});
    await loadAll();
  };

  return {
    isLoading, error, myStake, pendingRewards, pendingWithdraw, stats,
    loadAll, stake, unstake, claimRewards, claimPendingWithdraw,
  };
}
