/**
 * useGovMercPool -- React hook for Gov Merc domain logic.
 *
 * Equivalent to the Vue composable but uses createObservable instead of ref/computed.
 * All contract interaction is delegated to OS services (PaymentProxy, StorageProxy).
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { formatNum } from "@shared/utils/format";

export interface UseGovMercPoolOptions {
  paymentService: PaymentProxy;
  storageService: StorageProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useGovMercPool({ paymentService, storageService, t }: UseGovMercPoolOptions) {
  const depositAmount = createObservable("");
  const withdrawAmount = createObservable("");
  const bidAmount = createObservable("");
  const totalPool = createObservable(0);
  const currentEpoch = createObservable(0);
  const userDeposits = createObservable(0);
  const bids = createObservable<{ address: string; amount: number }[]>([]);
  const dataLoading = createObservable(false);
  const address = createObservable("");
  const isProcessing = createObservable(false);

  const isBusy: Observable<boolean> = {
    get: () => isProcessing.get() || dataLoading.get(),
    set: () => {},
    subscribe: (fn) => {
      const u1 = isProcessing.subscribe(fn);
      const u2 = dataLoading.subscribe(fn);
      return () => { u1(); u2(); };
    },
  };

  let isMounted = true;

  const loadPoolData = async () => {
    try {
      const raw = await storageService.get("pool-state");
      if (raw && typeof raw === "object") {
        const data = raw as Record<string, unknown>;
        totalPool.set(Number(data.totalPool || 0));
        currentEpoch.set(Number(data.currentEpoch || 0));
      }
    } catch (e) {
      console.warn("[useGovMercPool] loadPoolData failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadUserDeposits = async () => {
    if (!address.get()) return;
    try {
      const raw = await storageService.get("user-deposits");
      userDeposits.set(Number(raw || 0));
    } catch (e) {
      console.warn("[useGovMercPool] loadUserDeposits failed:", e instanceof Error ? e.message : String(e));
      userDeposits.set(0);
    }
  };

  const loadBids = async () => {
    try {
      const raw = await storageService.list("bid:");
      if (raw && typeof raw === "object") {
        const map = new Map<string, number>();
        for (const [, value] of Object.entries(raw)) {
          if (!value || typeof value !== "object") continue;
          const entry = value as Record<string, unknown>;
          const candidate = String(entry.address || "");
          const amount = Number(entry.amount || 0);
          if (!candidate) continue;
          map.set(candidate, (map.get(candidate) || 0) + amount);
        }
        bids.set(
          Array.from(map.entries())
            .map(([addr, amount]) => ({ address: addr, amount }))
            .sort((a, b) => b.amount - a.amount),
        );
      }
    } catch (e) {
      console.warn("[useGovMercPool] loadBids failed:", e instanceof Error ? e.message : String(e));
      bids.set([]);
    }
  };

  const loadData = async () => {
    if (!isMounted) return;
    try {
      dataLoading.set(true);
      await loadPoolData();
      if (!isMounted) return;
      await loadUserDeposits();
      if (!isMounted) return;
      await loadBids();
    } catch (e) {
      console.warn("[useGovMercPool] loadData failed:", e instanceof Error ? e.message : String(e));
    } finally {
      dataLoading.set(false);
    }
  };

  const depositNeo = async () => {
    if (isBusy.get()) return;
    const amount = Number(depositAmount.get());
    if (!(amount > 0)) throw new Error(t("enterAmount"));
    try {
      isProcessing.set(true);
      await storageService.set("deposit", { depositor: address.get(), amount });
      depositAmount.set("");
      await loadData();
    } finally {
      isProcessing.set(false);
    }
  };

  const withdrawNeo = async () => {
    if (isBusy.get()) return;
    const amount = Number(withdrawAmount.get());
    if (!(amount > 0)) throw new Error(t("enterAmount"));
    try {
      isProcessing.set(true);
      await storageService.set("withdraw", { withdrawer: address.get(), amount });
      withdrawAmount.set("");
      await loadData();
    } finally {
      isProcessing.set(false);
    }
  };

  const placeBid = async () => {
    if (isBusy.get()) return;
    const amount = parseFloat(bidAmount.get());
    if (!(amount > 0)) throw new Error(t("enterAmount"));
    try {
      isProcessing.set(true);
      await paymentService.deposit(bidAmount.get(), `govmerc:bid:${currentEpoch.get()}`);
      if (!isMounted) return;
      await storageService.set("bid", {
        bidder: address.get(),
        amount: bidAmount.get(),
        epoch: currentEpoch.get(),
      });
      bidAmount.set("");
      await loadData();
    } finally {
      isProcessing.set(false);
    }
  };

  return {
    address,
    depositAmount,
    withdrawAmount,
    bidAmount,
    totalPool,
    currentEpoch,
    userDeposits,
    bids,
    dataLoading,
    isBusy,
    formatNum,
    depositNeo,
    withdrawNeo,
    placeBid,
    loadData,
    setAddress: (addr: string) => { address.set(addr); },
  };
}
