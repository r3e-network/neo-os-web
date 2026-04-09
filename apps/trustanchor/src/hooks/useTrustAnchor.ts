/**
 * useTrustAnchor -- React hook for TrustAnchor staking logic.
 *
 * Uses createObservable instead of Vue ref.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, EventBus } from "@shared/services";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_DECIMALS = TOKEN_CONSTANTS.GAS_MULTIPLIER;

export interface TrustAnchorStats {
  totalStaked: number;
  rps: string;
}

export interface UseTrustAnchorOptions {
  chain: ChainService;
  eventBus: EventBus;
  storage: StorageProxy;
  payment: PaymentProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useTrustAnchor({ chain, eventBus, storage, payment, t }: UseTrustAnchorOptions) {
  const isLoading = createObservable(false);
  const error = createObservable<string | null>(null);
  const myStake = createObservable(0);
  const pendingRewards = createObservable(0);
  const pendingWithdraw = createObservable(0);
  const stats = createObservable<TrustAnchorStats | null>(null);

  const loadMyStake = async () => {
    if (!chain.address.value) { myStake.set(0); return; }
    try {
      const result = await storage.get(`stake:${chain.address.value}`);
      if (result != null) myStake.set(Number(result));
    } catch (e) {
      console.warn("[useTrustAnchor] loadMyStake failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadPendingRewards = async () => {
    if (!chain.address.value) { pendingRewards.set(0); return; }
    try {
      const result = await storage.get(`reward:${chain.address.value}`);
      if (result != null) pendingRewards.set(Number(result) / GAS_DECIMALS);
    } catch (e) {
      console.warn("[useTrustAnchor] loadPendingRewards failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadPendingWithdraw = async () => {
    if (!chain.address.value) { pendingWithdraw.set(0); return; }
    try {
      const result = await storage.get(`pendingWithdraw:${chain.address.value}`);
      if (result != null) pendingWithdraw.set(Number(result));
    } catch (e) {
      console.warn("[useTrustAnchor] loadPendingWithdraw failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadStats = async () => {
    try {
      const [totalStake, rps] = await Promise.all([
        storage.get("stats:totalStake"),
        storage.get("stats:rps"),
      ]);
      stats.set({ totalStaked: Number(totalStake ?? 0), rps: String(rps ?? "0") });
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
    const contractAddr = chain.contractAddress.value;
    if (!contractAddr) throw new Error(t("contractUnavailable"));
    await chain.invoke("transfer", [
      { type: "Hash160", value: addr },
      { type: "Hash160", value: contractAddr },
      { type: "Integer", value: amount },
    ], { scriptHash: NEO_HASH });
    eventBus.emit("stake:completed", { amount });
    await loadAll();
  };

  const unstake = async (amount: number) => {
    if (amount <= 0 || !Number.isInteger(amount)) throw new Error(t("invalidAmount"));
    await chain.ensureWallet();
    await payment.withdraw(String(amount));
    eventBus.emit("unstake:completed", { amount });
    await loadAll();
  };

  const claimPendingWithdraw = async () => {
    await chain.ensureWallet();
    await payment.withdraw("0");
    eventBus.emit("withdraw:claimed", {});
    await loadAll();
  };

  const claimRewards = async () => {
    await chain.ensureWallet();
    const bal = await payment.getBalance();
    if (parseFloat(bal) > 0) await payment.withdraw(bal);
    eventBus.emit("rewards:claimed", {});
    await loadAll();
  };

  return {
    isLoading, error, myStake, pendingRewards, pendingWithdraw, stats,
    loadAll, stake, unstake, claimRewards, claimPendingWithdraw,
  };
}
